import type { LotState } from './lot'
import type { Rng } from './random'
import { DAY } from './time'

export const NOW = Date.UTC(2026, 10, 11, 12, 0, 0)

/** A live lot with no bids, ending in a day. Override any field. */
export function makeLot(overrides: Partial<LotState> = {}): LotState {
  return {
    lot: 'T-0001',
    startsAt: NOW - DAY,
    endsAt: NOW + DAY,
    startingBid: 10_000,
    reservePrice: null,
    buyNowPrice: null,
    currentBid: null,
    bidCount: 0,
    leader: null,
    leaderMax: null,
    yourMax: null,
    closedAt: null,
    extensions: 0,
    ...overrides,
  }
}

/** A lot where a rival leads at $35,000 with a hidden max of `rivalMax`. */
export function rivalLeading(rivalMax: number, overrides: Partial<LotState> = {}): LotState {
  return makeLot({ currentBid: 35_000, bidCount: 5, leader: 'rival', leaderMax: rivalMax, ...overrides })
}

/** An Rng that always returns the same value. 0 picks every minimum; 0.999 every maximum. */
export const fixedRng = (value: number): Rng => () => value
