/**
 * One lot's auction state and the pure rules that act on it:
 * proxy bidding (P2), $100 steps (P12), any-amount max bids (P23),
 * reserve (P4, P24), Buy Now (P8) and the soft close (P38).
 *
 * Every function takes the lot and returns a new one. Nothing here touches
 * timers, storage or React.
 */

import { MINUTE } from './time'

/** Quick bids and proxy raises move in $100 steps (P12). */
export const BID_STEP = 100

/** P38: a bid with less than this left resets the end to this far from the bid. */
export const SOFT_CLOSE = 2 * MINUTE

/** Who placed a bid. Bids already in the dataset count as rivals. */
export type Bidder = 'you' | 'rival'
export type LotPhase = 'upcoming' | 'live' | 'ended'
export type ReserveStatus = 'none' | 'met' | 'not-met'

export interface LotState {
  lot: string
  startsAt: number
  endsAt: number
  startingBid: number
  reservePrice: number | null
  buyNowPrice: number | null
  /** Visible price. Null until the first bid. */
  currentBid: number | null
  bidCount: number
  leader: Bidder | null
  /** The leader's hidden max. Never shown to anyone else. */
  leaderMax: number | null
  /** The buyer's own highest max on this lot. Kept after they're outbid. */
  yourMax: number | null
  /** Set when the lot closes before endsAt (Buy Now). */
  closedAt: number | null
  /** How many times a late bid pushed endsAt back (P38). */
  extensions: number
}

export function phase(lot: LotState, now: number): LotPhase {
  if (lot.closedAt !== null) return 'ended'
  if (now < lot.startsAt) return 'upcoming'
  if (now >= lot.endsAt) return 'ended'
  return 'live'
}

export function endedAt(lot: LotState): number {
  return lot.closedAt ?? lot.endsAt
}

/** Amount for the one-tap quick bid: the starting bid, or $100 over the current bid. */
export function quickBidAmount(lot: LotState): number {
  return lot.currentBid === null ? lot.startingBid : lot.currentBid + BID_STEP
}

/**
 * Lowest max bid this bidder may enter (P23): any whole-dollar amount above the
 * current bid, or at least the starting bid when there are no bids. A buyer who
 * already leads can only raise their own max.
 */
export function minimumMaxBid(lot: LotState, bidder: Bidder): number {
  if (bidder === 'you' && lot.leader === 'you' && lot.yourMax !== null) return lot.yourMax + 1
  return lot.currentBid === null ? lot.startingBid : lot.currentBid + 1
}

export function reserveStatus(lot: LotState): ReserveStatus {
  if (lot.reservePrice === null) return 'none'
  return lot.currentBid !== null && lot.currentBid >= lot.reservePrice ? 'met' : 'not-met'
}

export type BidRejection = 'not-live' | 'invalid-amount' | 'too-low'

export type BidResult =
  | { ok: true; lot: LotState }
  | { ok: false; reason: BidRejection; minimum: number }

/**
 * Place a max bid using eBay-style proxy bidding (P2).
 *
 * - The higher max leads. The price goes to $100 over the runner-up's max,
 *   but never above the leader's own max (so prices can land off the $100 grid, P23).
 * - Ties go to whoever bid first.
 * - If the leader's max covers the reserve, the price jumps to the reserve (P24).
 */
export function placeBid(lot: LotState, bidder: Bidder, max: number, now: number): BidResult {
  const minimum = minimumMaxBid(lot, bidder)
  if (phase(lot, now) !== 'live') return { ok: false, reason: 'not-live', minimum }
  if (!Number.isInteger(max) || max <= 0) return { ok: false, reason: 'invalid-amount', minimum }
  if (max < minimum) return { ok: false, reason: 'too-low', minimum }

  const yourMax = bidder === 'you' ? max : lot.yourMax

  // The buyer raising their own max: the price stays, only the hidden max changes.
  if (bidder === 'you' && lot.leader === 'you') {
    return { ok: true, lot: applyReserve({ ...lot, leaderMax: max, yourMax }) }
  }

  let next: LotState
  if (lot.leader === null || lot.leaderMax === null || lot.currentBid === null) {
    // First bid opens at the starting bid.
    next = {
      ...lot,
      leader: bidder,
      leaderMax: max,
      currentBid: lot.startingBid,
      bidCount: lot.bidCount + 1,
      yourMax,
    }
  } else if (max > lot.leaderMax) {
    // Challenger wins. The old leader's proxy bid up to its max first, if it had room.
    const defenderBidUp = lot.leaderMax > lot.currentBid
    next = {
      ...lot,
      leader: bidder,
      leaderMax: max,
      currentBid: Math.min(max, lot.leaderMax + BID_STEP),
      bidCount: lot.bidCount + (defenderBidUp ? 2 : 1),
      yourMax,
    }
  } else {
    // Leader's proxy defends. On a tie the leader (earlier bidder) keeps it.
    next = {
      ...lot,
      currentBid: Math.min(lot.leaderMax, max + BID_STEP),
      bidCount: lot.bidCount + 2,
      yourMax,
    }
  }
  return { ok: true, lot: softClose(applyReserve(next), now) }
}

/**
 * P38: a bid in the last 2 minutes resets the clock to 2 minutes, so nobody can
 * win by bidding in the final second. Only bids that move the price count;
 * quietly raising your own max doesn't extend the auction.
 */
function softClose(lot: LotState, now: number): LotState {
  if (lot.endsAt - now >= SOFT_CLOSE) return lot
  return { ...lot, endsAt: now + SOFT_CLOSE, extensions: lot.extensions + 1 }
}

/**
 * P24: if the leader is willing to pay the reserve, the price rises to the reserve,
 * so a lot doesn't fail to sell while someone's max would have covered it.
 */
function applyReserve(lot: LotState): LotState {
  const { reservePrice, currentBid, leaderMax } = lot
  if (reservePrice === null || currentBid === null || leaderMax === null) return lot
  if (currentBid < reservePrice && leaderMax >= reservePrice) {
    return { ...lot, currentBid: reservePrice }
  }
  return lot
}

/**
 * P8, eBay rule: Buy Now is offered until bidding reaches the reserve,
 * or the Buy Now price itself for no-reserve lots.
 */
export function buyNowAvailable(lot: LotState, now: number): boolean {
  if (lot.buyNowPrice === null || phase(lot, now) !== 'live') return false
  const cutoff = lot.reservePrice ?? lot.buyNowPrice
  return lot.currentBid === null || lot.currentBid < cutoff
}

export type BuyNowResult = { ok: true; lot: LotState } | { ok: false }

/** Buy the lot outright. Ends the auction immediately, sold to the buyer. */
export function buyNow(lot: LotState, now: number): BuyNowResult {
  if (!buyNowAvailable(lot, now) || lot.buyNowPrice === null) return { ok: false }
  return {
    ok: true,
    lot: {
      ...lot,
      currentBid: lot.buyNowPrice,
      leader: 'you',
      leaderMax: lot.buyNowPrice,
      bidCount: lot.bidCount + 1,
      closedAt: now,
    },
  }
}

export type LotOutcome =
  | { kind: 'sold'; price: number; winner: Bidder; viaBuyNow: boolean }
  | { kind: 'reserve-not-met'; highBid: number }
  | { kind: 'no-bids' }

/** How an ended lot finished (P18). */
export function outcome(lot: LotState): LotOutcome {
  if (lot.currentBid === null || lot.leader === null) return { kind: 'no-bids' }
  if (reserveStatus(lot) === 'not-met') return { kind: 'reserve-not-met', highBid: lot.currentBid }
  return { kind: 'sold', price: lot.currentBid, winner: lot.leader, viaBuyNow: lot.closedAt !== null }
}

export type BuyerStatus = 'winning' | 'outbid' | 'won' | 'lost'

/** Where the buyer stands on a lot they've bid on (P14). Null if they never bid. */
export function buyerStatus(lot: LotState, now: number): BuyerStatus | null {
  if (lot.yourMax === null && !(lot.closedAt !== null && lot.leader === 'you')) return null
  if (phase(lot, now) !== 'ended') return lot.leader === 'you' ? 'winning' : 'outbid'
  const result = outcome(lot)
  return result.kind === 'sold' && result.winner === 'you' ? 'won' : 'lost'
}
