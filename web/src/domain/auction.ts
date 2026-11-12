import {
  buyNow,
  phase,
  placeBid,
  type BidResult,
  type BuyNowResult,
  type LotState,
} from './lot'
import type { Rng } from './random'
import {
  backgroundRivalMax,
  canBidInBackground,
  nextBackgroundBidAt,
  planRivalResponse,
  planRivalSnipe,
  resolveRivalMax,
  rivalsSnipe,
  type PendingRivalBid,
} from './rivals'
import { buildSchedule } from './schedule'
import { DEFAULT_DELIVER_TO, type Province } from './fees'
import { fileClaim, type Claim, type ClaimInput, type FileClaimResult } from './guarantee'
import { addNotifications, lotsEndingSoon, markRead, type Notification } from './notifications'
import { askQuestion, type AskResult, type Question } from './questions'
import type { Vehicle } from './vehicle'

/**
 * The whole auction: every lot's state, the watchlist and scheduled rival bids.
 * This is what gets saved to localStorage (P9). All functions are pure:
 * they take a state and return a new one.
 */

/** Bump when the shape changes, so old saved state is discarded instead of misread. */
export const STATE_VERSION = 5

export interface AuctionState {
  version: typeof STATE_VERSION
  createdAt: number
  lots: Record<string, LotState>
  watchlist: string[]
  pendingRivalBids: PendingRivalBid[]
  nextBackgroundBidAt: number
  /** Where the buyer wants cars delivered, for the transport estimate (P39). */
  deliverTo: Province
  /** Block Guarantee claims on won lots (P35). */
  claims: Claim[]
  /** The buyer's own questions to sellers (P40). Seeded ones aren't stored. */
  questions: Question[]
  /** The bell's history, newest first (P42). */
  notifications: Notification[]
  /** Watched lots already announced as ending soon, so each is announced once. */
  endingNotified: string[]
}

/** Things the UI may want to announce, e.g. the outbid toast (P16). */
export type AuctionEvent =
  | { type: 'outbid'; lot: string; currentBid: number }
  | { type: 'rival-bid'; lot: string; currentBid: number }
  | { type: 'claim-decided'; lot: string; claimId: string; status: 'approved' | 'denied' }
  | { type: 'question-answered'; lot: string; questionId: string }
  | { type: 'ending-soon'; lot: string; endsAt: number }

export function createAuctionState(vehicles: readonly Vehicle[], now: number, rng: Rng): AuctionState {
  const schedule = buildSchedule(vehicles, now)
  const lots: Record<string, LotState> = {}
  for (const v of vehicles) {
    const { startsAt, endsAt } = schedule.get(v.lot)!
    lots[v.lot] = {
      lot: v.lot,
      startsAt,
      endsAt,
      startingBid: v.starting_bid,
      reservePrice: v.reserve_price,
      buyNowPrice: v.buy_now_price,
      currentBid: v.current_bid,
      bidCount: v.bid_count,
      // Bids already in the dataset belong to an earlier bidder. We don't know
      // their max, so assume it equals the current bid.
      leader: v.current_bid === null ? null : 'rival',
      leaderMax: v.current_bid,
      yourMax: null,
      closedAt: null,
      extensions: 0,
    }
  }
  return {
    version: STATE_VERSION,
    createdAt: now,
    lots,
    watchlist: [],
    pendingRivalBids: [],
    nextBackgroundBidAt: nextBackgroundBidAt(now, rng),
    deliverTo: DEFAULT_DELIVER_TO,
    claims: [],
    questions: [],
    notifications: [],
    endingNotified: [],
  }
}

/** The buyer places a max bid (P2). If they take the lead, a rival plans a response (P20). */
export function placeBuyerBid(
  state: AuctionState,
  lotId: string,
  max: number,
  now: number,
  rng: Rng,
): { state: AuctionState; result: BidResult } {
  const result = placeBid(getLot(state, lotId), 'you', max, now)
  if (!result.ok) return { state, result }

  // A new bid replaces any rival response still pending on this lot.
  const otherPending = state.pendingRivalBids.filter((p) => p.lot !== lotId)
  const response = [
    ...planRivalResponse(result.lot, now, rng),
    ...(rivalsSnipe(`${state.createdAt}:${lotId}`) ? planRivalSnipe(result.lot, now, rng) : []),
  ]
  return {
    state: {
      ...state,
      lots: { ...state.lots, [lotId]: result.lot },
      pendingRivalBids: [...otherPending, ...response],
    },
    result,
  }
}

export function buyNowLot(
  state: AuctionState,
  lotId: string,
  now: number,
): { state: AuctionState; result: BuyNowResult } {
  const result = buyNow(getLot(state, lotId), now)
  if (!result.ok) return { state, result }
  return {
    state: {
      ...state,
      lots: { ...state.lots, [lotId]: result.lot },
      pendingRivalBids: state.pendingRivalBids.filter((p) => p.lot !== lotId),
    },
    result,
  }
}

export function toggleWatch(state: AuctionState, lotId: string): AuctionState {
  const watched = state.watchlist.includes(lotId)
  return {
    ...state,
    watchlist: watched ? state.watchlist.filter((l) => l !== lotId) : [...state.watchlist, lotId],
  }
}

/**
 * Advance the simulation to `now`: fire any rival bids that are due, and maybe
 * one background rival bid. Call this every second or so.
 */
export function tick(
  state: AuctionState,
  now: number,
  rng: Rng,
): { state: AuctionState; events: AuctionEvent[] } {
  const events: AuctionEvent[] = []
  const lots = { ...state.lots }

  const rivalBid = (lotId: string, max: number) => {
    const before = lots[lotId]
    const result = placeBid(before, 'rival', max, now)
    if (!result.ok) return
    lots[lotId] = result.lot
    events.push({ type: 'rival-bid', lot: lotId, currentBid: result.lot.currentBid! })
    if (before.leader === 'you' && result.lot.leader !== 'you') {
      events.push({ type: 'outbid', lot: lotId, currentBid: result.lot.currentBid! })
    }
  }

  // 1. Rival responses that are due, oldest first.
  const due = state.pendingRivalBids.filter((p) => p.at <= now).sort((a, b) => a.at - b.at)
  for (const pending of due) {
    const lot = lots[pending.lot]
    if (!lot || phase(lot, now) !== 'live') continue
    const max = resolveRivalMax(lot, pending)
    if (max !== null) rivalBid(pending.lot, max)
  }
  const pendingRivalBids = state.pendingRivalBids.filter((p) => p.at > now)

  // 2. Background market activity, never on lots the buyer is leading.
  let nextAt = state.nextBackgroundBidAt
  if (now >= nextAt) {
    const candidates = Object.values(lots).filter(
      (l) => phase(l, now) === 'live' && l.leader !== 'you' && canBidInBackground(l),
    )
    if (candidates.length > 0) {
      const target = candidates[Math.floor(rng() * candidates.length)]
      rivalBid(target.lot, backgroundRivalMax(target, rng))
    }
    nextAt = nextBackgroundBidAt(now, rng)
  }

  // 3. Claim reviews that have finished.
  let claims = state.claims
  if (claims.some((c) => c.status === 'review' && c.decideAt <= now)) {
    claims = claims.map((c) => {
      if (c.status !== 'review' || c.decideAt > now) return c
      events.push({ type: 'claim-decided', lot: c.lot, claimId: c.id, status: c.decision.status })
      return { ...c, status: c.decision.status }
    })
  }

  // 4. Seller answers that are due.
  let questions = state.questions
  if (questions.some((q) => !q.answered && q.answerAt !== null && q.answerAt <= now)) {
    questions = questions.map((q) => {
      if (q.answered || q.answerAt === null || q.answerAt > now) return q
      events.push({ type: 'question-answered', lot: q.lot, questionId: q.id })
      return { ...q, answered: true }
    })
  }

  // 5. Watched lots that just came within 5 minutes of ending.
  const ending = lotsEndingSoon(lots, state.watchlist, state.endingNotified, now)
  for (const id of ending) events.push({ type: 'ending-soon', lot: id, endsAt: lots[id].endsAt })
  const endingNotified = ending.length > 0 ? [...state.endingNotified, ...ending] : state.endingNotified

  // 6. Save the events worth keeping to the bell (P42).
  const notifications = addNotifications(state.notifications, events.flatMap((e, i) => toNotification(e, now, i)))

  // Nothing happened: return the same object so React can skip re-rendering.
  const unchanged =
    claims === state.claims &&
    questions === state.questions &&
    events.length === 0 &&
    pendingRivalBids.length === state.pendingRivalBids.length &&
    nextAt === state.nextBackgroundBidAt
  if (unchanged) return { state, events }
  return {
    state: {
      ...state,
      lots,
      pendingRivalBids,
      nextBackgroundBidAt: nextAt,
      claims,
      questions,
      notifications,
      endingNotified,
    },
    events,
  }
}

function toNotification(event: AuctionEvent, now: number, index: number): Notification[] {
  const id = `${event.type}-${event.lot}-${now}-${index}`
  switch (event.type) {
    case 'outbid':
      return [{ id, kind: 'outbid', lot: event.lot, at: now, read: false, currentBid: event.currentBid }]
    case 'ending-soon':
      return [{ id, kind: 'ending-soon', lot: event.lot, at: now, read: false }]
    case 'question-answered':
      return [{ id, kind: 'answer', lot: event.lot, at: now, read: false, questionId: event.questionId }]
    default:
      return []
  }
}

/** Mark one notification read, or all of them when `id` is left out. */
export function markNotificationsRead(state: AuctionState, id?: string): AuctionState {
  const notifications = markRead(state.notifications, id)
  return notifications === state.notifications ? state : { ...state, notifications }
}

/** The buyer files a Block Guarantee claim on a lot they won (P35). */
export function fileBuyerClaim(
  state: AuctionState,
  vehicle: Vehicle,
  input: ClaimInput,
  now: number,
  rng: Rng,
): { state: AuctionState; result: FileClaimResult } {
  const result = fileClaim(vehicle, getLot(state, vehicle.lot), state.claims, input, now, rng)
  if (!result.ok) return { state, result }
  return { state: { ...state, claims: [...state.claims, result.claim] }, result }
}

/** The buyer asks the seller a question (P40). Rejected if it breaks the posting rules. */
export function askSeller(
  state: AuctionState,
  vehicle: Vehicle,
  text: string,
  now: number,
  rng: Rng,
): { state: AuctionState; result: AskResult } {
  // Questions close when the auction does (timed out or sold with Buy Now).
  // Upcoming lots stay open: buyers often ask before bidding starts.
  if (phase(getLot(state, vehicle.lot), now) === 'ended') return { state, result: { ok: false, reason: 'auction-ended' } }
  const result = askQuestion(vehicle, text, now, rng)
  if (!result.ok) return { state, result }
  return { state: { ...state, questions: [...state.questions, result.question] }, result }
}

export function deleteQuestion(state: AuctionState, id: string): AuctionState {
  return { ...state, questions: state.questions.filter((q) => q.id !== id) }
}

export function setDeliverTo(state: AuctionState, province: Province): AuctionState {
  return state.deliverTo === province ? state : { ...state, deliverTo: province }
}

function getLot(state: AuctionState, lotId: string): LotState {
  const lot = state.lots[lotId]
  if (!lot) throw new Error(`Unknown lot: ${lotId}`)
  return lot
}
