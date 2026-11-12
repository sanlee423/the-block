import { BID_STEP, type LotState } from './lot'
import { hashString, randInt, seededRng, type Rng } from './random'
import { SECOND } from './time'

/**
 * Simulated rival bidders (P3, P20). Rivals go through the same proxy rules as
 * the buyer (lot.placeBid). This file only decides when they bid and how high.
 */

export const RIVAL_CONFIG = {
  /** A background rival bid lands on some live lot every 20-60 s. */
  backgroundIntervalSec: [20, 60],
  /** Background bids go 0-8 steps above the minimum. */
  backgroundExtraSteps: [0, 8],
  /** When the buyer takes the lead, a rival responds after 5-15 s. */
  responseDelaySec: [5, 15],
  /** Chance the rival out-maxes the buyer instead of trying and giving up. */
  outmaxChance: 1 / 3,
  /** An out-maxing rival goes $100-$1,500 over the buyer's max. */
  outmaxSteps: [1, 15],
  /** A rival that gives up first tries 2-3 bids... */
  tries: [2, 3],
  /** ...a few seconds apart... */
  tryGapSec: [3, 8],
  /** ...each 1-5 steps over the current bid, but never above the buyer's max. */
  trySteps: [1, 5],
  /** P38: on 40% of lots the buyer leads, a rival also plans a last-minute bid... */
  snipeChance: 0.4,
  /** ...10-50 s before the end, which triggers the soft close. */
  snipeBeforeEndSec: [10, 50],
} as const

/**
 * A rival bid waiting to happen. Stored in the auction state (not in a
 * setTimeout) so it survives navigation and reloads (P9).
 */
export type PendingRivalBid = { lot: string; at: number } & (
  | { kind: 'outmax'; max: number }
  | { kind: 'try'; steps: number }
)

/**
 * A rival max that beats the buyer by $100-$1,500, capped at the Buy Now price.
 * Null if there's no room under the cap.
 */
function outmaxFor(lot: LotState, yourMax: number, rng: Rng): number | null {
  const cap = lot.buyNowPrice ?? Infinity
  const max = Math.min(yourMax + randInt(rng, ...RIVAL_CONFIG.outmaxSteps) * BID_STEP, cap)
  return max > yourMax ? max : null
}

/** Plan how a rival responds to the buyer taking the lead on a lot. */
export function planRivalResponse(lot: LotState, now: number, rng: Rng): PendingRivalBid[] {
  const yourMax = lot.yourMax
  if (lot.leader !== 'you' || yourMax === null) return []

  const c = RIVAL_CONFIG
  let at = now + randInt(rng, ...c.responseDelaySec) * SECOND

  if (rng() < c.outmaxChance) {
    const max = outmaxFor(lot, yourMax, rng)
    if (max !== null) return [{ lot: lot.lot, at, kind: 'outmax', max }]
    // No room under the Buy Now price: fall through to a rival that tries and gives up.
  }

  const count = randInt(rng, ...c.tries)
  const plan: PendingRivalBid[] = []
  for (let i = 0; i < count; i++) {
    if (i > 0) at += randInt(rng, ...c.tryGapSec) * SECOND
    plan.push({ lot: lot.lot, at, kind: 'try', steps: randInt(rng, ...c.trySteps) })
  }
  return plan
}

/**
 * Whether rivals snipe on this lot (P38). Decided once per lot and demo, from a
 * seed, so bidding again doesn't re-roll the dice.
 */
export function rivalsSnipe(seed: string): boolean {
  return seededRng(hashString(seed))() < RIVAL_CONFIG.snipeChance
}

/**
 * P38: a rival bid 10-50 s before the end. Like a normal response, it out-maxes
 * the buyer about one time in three; otherwise it's a single try under their max.
 * Either way it lands in the last 2 minutes, so the auction extends.
 */
export function planRivalSnipe(lot: LotState, now: number, rng: Rng): PendingRivalBid[] {
  const yourMax = lot.yourMax
  if (lot.leader !== 'you' || yourMax === null) return []

  const c = RIVAL_CONFIG
  const at = lot.endsAt - randInt(rng, ...c.snipeBeforeEndSec) * SECOND
  if (at <= now) return []

  if (rng() < c.outmaxChance) {
    const max = outmaxFor(lot, yourMax, rng)
    if (max !== null) return [{ lot: lot.lot, at, kind: 'outmax', max }]
  }
  return [{ lot: lot.lot, at, kind: 'try', steps: randInt(rng, ...c.trySteps) }]
}

/**
 * The max a pending rival bid should use now, given the lot as it is when the
 * bid fires. Null means skip it (the buyer is no longer leading, or there's no room).
 */
export function resolveRivalMax(lot: LotState, pending: PendingRivalBid): number | null {
  if (lot.leader !== 'you' || lot.leaderMax === null || lot.currentBid === null) return null
  if (pending.kind === 'outmax') return pending.max

  // A "try" never goes past the buyer's max, so the buyer's proxy always holds.
  const cap = Math.min(lot.leaderMax, lot.buyNowPrice ?? Infinity)
  const max = Math.min(cap, lot.currentBid + pending.steps * BID_STEP)
  return max > lot.currentBid ? max : null
}

/** Range a background rival may bid in. Rivals stay under the Buy Now price. */
function backgroundRange(lot: LotState): { minimum: number; cap: number } {
  const minimum = lot.currentBid === null ? lot.startingBid : lot.currentBid + BID_STEP
  const cap = lot.buyNowPrice === null ? Infinity : lot.buyNowPrice - BID_STEP
  return { minimum, cap }
}

export function canBidInBackground(lot: LotState): boolean {
  const { minimum, cap } = backgroundRange(lot)
  return minimum <= cap
}

/** Max for a background rival bid. Check canBidInBackground first. */
export function backgroundRivalMax(lot: LotState, rng: Rng): number {
  const { minimum, cap } = backgroundRange(lot)
  return Math.min(cap, minimum + randInt(rng, ...RIVAL_CONFIG.backgroundExtraSteps) * BID_STEP)
}

export function nextBackgroundBidAt(now: number, rng: Rng): number {
  return now + randInt(rng, ...RIVAL_CONFIG.backgroundIntervalSec) * SECOND
}
