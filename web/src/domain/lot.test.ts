import { describe, expect, it } from 'vitest'
import {
  buyNow,
  buyNowAvailable,
  buyerStatus,
  minimumMaxBid,
  outcome,
  phase,
  placeBid,
  quickBidAmount,
  reserveStatus,
  SOFT_CLOSE,
  type LotState,
} from './lot'
import { NOW, makeLot, rivalLeading } from './test-helpers'
import { DAY, MINUTE } from './time'

function bid(lot: LotState, bidder: 'you' | 'rival', max: number): LotState {
  const result = placeBid(lot, bidder, max, NOW)
  if (!result.ok) throw new Error(`bid rejected: ${result.reason}`)
  return result.lot
}

describe('phase', () => {
  it('is upcoming before start, live during, ended after', () => {
    const lot = makeLot({ startsAt: NOW + MINUTE, endsAt: NOW + DAY })
    expect(phase(lot, NOW)).toBe('upcoming')
    expect(phase(lot, NOW + MINUTE)).toBe('live')
    expect(phase(lot, NOW + DAY)).toBe('ended')
  })

  it('is ended once closed early by Buy Now', () => {
    expect(phase(makeLot({ closedAt: NOW - 1 }), NOW)).toBe('ended')
  })
})

describe('placeBid: proxy bidding (P2)', () => {
  it('opens at the starting bid, whatever the max', () => {
    const lot = bid(makeLot(), 'you', 18_000)
    expect(lot).toMatchObject({ currentBid: 10_000, leader: 'you', leaderMax: 18_000, yourMax: 18_000, bidCount: 1 })
  })

  it('a higher max takes the lead at $100 over the old max', () => {
    const lot = bid(rivalLeading(36_000), 'you', 40_000)
    expect(lot).toMatchObject({ currentBid: 36_100, leader: 'you', bidCount: 7 })
  })

  it('caps the price at the winner\'s own max, even off the $100 grid (P23)', () => {
    const lot = bid(rivalLeading(36_000), 'you', 36_050)
    expect(lot).toMatchObject({ currentBid: 36_050, leader: 'you' })
  })

  it('a lower max loses, and pushes the price to $100 over it', () => {
    const lot = bid(rivalLeading(40_000), 'you', 37_000)
    expect(lot).toMatchObject({ currentBid: 37_100, leader: 'rival', yourMax: 37_000, bidCount: 7 })
  })

  it('on a tie, the earlier bidder keeps the lead at that price', () => {
    const lot = bid(rivalLeading(37_000), 'you', 37_000)
    expect(lot).toMatchObject({ currentBid: 37_000, leader: 'rival' })
  })

  it('raising your own max does not move the price', () => {
    const leading = bid(rivalLeading(35_000), 'you', 38_000)
    const raised = bid(leading, 'you', 45_000)
    expect(raised).toMatchObject({ currentBid: leading.currentBid, leaderMax: 45_000, yourMax: 45_000, bidCount: leading.bidCount })
  })
})

describe('placeBid: validation (P23)', () => {
  it('accepts any whole-dollar max above the current bid', () => {
    expect(placeBid(rivalLeading(35_000), 'you', 35_001, NOW).ok).toBe(true)
  })

  it('rejects a max at or below the current bid', () => {
    expect(placeBid(rivalLeading(35_000), 'you', 35_000, NOW)).toEqual({ ok: false, reason: 'too-low', minimum: 35_001 })
  })

  it('rejects a first bid below the starting bid', () => {
    expect(placeBid(makeLot(), 'you', 9_999, NOW)).toEqual({ ok: false, reason: 'too-low', minimum: 10_000 })
  })

  it('rejects cents and non-numbers', () => {
    expect(placeBid(makeLot(), 'you', 10_000.5, NOW)).toMatchObject({ ok: false, reason: 'invalid-amount' })
    expect(placeBid(makeLot(), 'you', Number.NaN, NOW)).toMatchObject({ ok: false, reason: 'invalid-amount' })
  })

  it('rejects bids on upcoming and ended lots', () => {
    expect(placeBid(makeLot({ startsAt: NOW + MINUTE }), 'you', 20_000, NOW)).toMatchObject({ ok: false, reason: 'not-live' })
    expect(placeBid(makeLot({ endsAt: NOW }), 'you', 20_000, NOW)).toMatchObject({ ok: false, reason: 'not-live' })
  })

  it('a leading buyer must raise above their own max', () => {
    const leading = bid(makeLot(), 'you', 15_000)
    expect(minimumMaxBid(leading, 'you')).toBe(15_001)
    expect(minimumMaxBid(leading, 'rival')).toBe(10_001)
  })

  it('quick bid is the starting bid, then $100 over the current bid (P12)', () => {
    expect(quickBidAmount(makeLot())).toBe(10_000)
    expect(quickBidAmount(rivalLeading(35_000))).toBe(35_100)
  })
})

describe('reserve (P4, P24)', () => {
  it('reports none, not met and met', () => {
    expect(reserveStatus(makeLot())).toBe('none')
    expect(reserveStatus(rivalLeading(35_000, { reservePrice: 40_000 }))).toBe('not-met')
    expect(reserveStatus(rivalLeading(35_000, { reservePrice: 35_000 }))).toBe('met')
  })

  it('jumps the price to the reserve when the leader\'s max covers it', () => {
    const lot = bid(makeLot({ reservePrice: 25_000 }), 'you', 30_000)
    expect(lot.currentBid).toBe(25_000)
    expect(reserveStatus(lot)).toBe('met')
  })

  it('leaves the price alone when the max is below the reserve', () => {
    expect(bid(makeLot({ reservePrice: 25_000 }), 'you', 20_000).currentBid).toBe(10_000)
  })
})

describe('Buy Now (P8)', () => {
  const withBuyNow = (overrides: Partial<LotState> = {}) =>
    makeLot({ reservePrice: 25_000, buyNowPrice: 30_000, ...overrides })

  it('is available until bidding reaches the reserve', () => {
    expect(buyNowAvailable(withBuyNow(), NOW)).toBe(true)
    expect(buyNowAvailable(withBuyNow({ currentBid: 24_900, leader: 'rival', leaderMax: 24_900 }), NOW)).toBe(true)
    expect(buyNowAvailable(withBuyNow({ currentBid: 25_000, leader: 'rival', leaderMax: 25_000 }), NOW)).toBe(false)
  })

  it('without a reserve, is available until bidding reaches the Buy Now price', () => {
    const lot = withBuyNow({ reservePrice: null, currentBid: 29_900, leader: 'rival', leaderMax: 29_900 })
    expect(buyNowAvailable(lot, NOW)).toBe(true)
  })

  it('is not offered on lots without a Buy Now price, or that are not live', () => {
    expect(buyNowAvailable(makeLot(), NOW)).toBe(false)
    expect(buyNowAvailable(withBuyNow({ startsAt: NOW + MINUTE }), NOW)).toBe(false)
  })

  it('ends the auction immediately, sold to the buyer', () => {
    const result = buyNow(withBuyNow(), NOW)
    if (!result.ok) throw new Error('buy now rejected')
    expect(phase(result.lot, NOW)).toBe('ended')
    expect(outcome(result.lot)).toEqual({ kind: 'sold', price: 30_000, winner: 'you', viaBuyNow: true })
    expect(buyerStatus(result.lot, NOW)).toBe('won')
  })

  it('is refused once unavailable', () => {
    expect(buyNow(makeLot(), NOW)).toEqual({ ok: false })
  })
})

describe('outcome and buyer status (P14, P18)', () => {
  const ended = { endsAt: NOW - MINUTE }

  it('no bids', () => {
    expect(outcome(makeLot(ended))).toEqual({ kind: 'no-bids' })
  })

  it('reserve not met', () => {
    expect(outcome(rivalLeading(35_000, { ...ended, reservePrice: 40_000 }))).toEqual({ kind: 'reserve-not-met', highBid: 35_000 })
  })

  it('tracks the buyer from winning to won', () => {
    const lot = bid(makeLot(), 'you', 15_000)
    expect(buyerStatus(lot, NOW)).toBe('winning')
    expect(buyerStatus(lot, lot.endsAt)).toBe('won')
  })

  it('tracks the buyer from outbid to lost', () => {
    const lot = bid(rivalLeading(40_000), 'you', 37_000)
    expect(buyerStatus(lot, NOW)).toBe('outbid')
    expect(buyerStatus(lot, lot.endsAt)).toBe('lost')
  })

  it('a winning bid below the reserve is lost', () => {
    const lot = bid(makeLot({ reservePrice: 25_000 }), 'you', 20_000)
    expect(buyerStatus(lot, lot.endsAt)).toBe('lost')
  })

  it('is null for lots the buyer never bid on', () => {
    expect(buyerStatus(rivalLeading(35_000), NOW)).toBeNull()
  })
})

describe('soft close (P38)', () => {
  it('a bid in the last 2 minutes resets the end to 2 minutes from the bid', () => {
    const lot = rivalLeading(35_000, { endsAt: NOW + 30_000 })
    const result = placeBid(lot, 'you', 36_000, NOW)
    expect(result.ok && result.lot).toMatchObject({ endsAt: NOW + SOFT_CLOSE, extensions: 1 })
  })

  it('a bid with more than 2 minutes left changes nothing', () => {
    const lot = rivalLeading(35_000, { endsAt: NOW + 3 * MINUTE })
    const result = placeBid(lot, 'you', 36_000, NOW)
    expect(result.ok && result.lot).toMatchObject({ endsAt: NOW + 3 * MINUTE, extensions: 0 })
  })

  it('a rival bid extends too, and extensions keep counting', () => {
    let lot = rivalLeading(35_000, { endsAt: NOW + 10_000 })
    lot = bid(lot, 'you', 36_000)
    const later = placeBid(lot, 'rival', 37_000, NOW + 100_000)
    expect(later.ok && later.lot).toMatchObject({ endsAt: NOW + 100_000 + SOFT_CLOSE, extensions: 2 })
  })

  it('raising your own max while leading does not extend', () => {
    const lot = makeLot({ endsAt: NOW + 30_000, currentBid: 10_000, leader: 'you', leaderMax: 12_000, yourMax: 12_000 })
    const result = placeBid(lot, 'you', 15_000, NOW)
    expect(result.ok && result.lot).toMatchObject({ endsAt: NOW + 30_000, extensions: 0 })
  })
})
