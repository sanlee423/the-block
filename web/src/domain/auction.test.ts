import { describe, expect, it } from 'vitest'
import {
  buyNowLot,
  createAuctionState,
  placeBuyerBid,
  STATE_VERSION,
  tick,
  toggleWatch,
  type AuctionState,
} from './auction'
import { NOW, fixedRng, makeLot, rivalLeading } from './test-helpers'
import { HOUR, MINUTE, SECOND } from './time'
import { rivalsSnipe } from './rivals'
import { vehicles } from './vehicles'

/** A state containing just the given lots, with background bids far in the future. */
function stateWith(...lots: ReturnType<typeof makeLot>[]): AuctionState {
  return {
    version: STATE_VERSION,
    createdAt: NOW,
    lots: Object.fromEntries(lots.map((l) => [l.lot, l])),
    watchlist: [],
    pendingRivalBids: [],
    nextBackgroundBidAt: NOW + 60 * MINUTE,
    deliverTo: 'Ontario',
    claims: [],
    questions: [],
    notifications: [],
    endingNotified: [],
  }
}

const OUTMAX = fixedRng(0) // rng below the 1-in-3 chance: the rival out-maxes you
const GIVE_UP = fixedRng(0.999) // rng above it: the rival tries and gives up

describe('createAuctionState', () => {
  const state = createAuctionState(vehicles, NOW, fixedRng(0.5))

  it('creates a lot for every vehicle', () => {
    expect(Object.keys(state.lots)).toHaveLength(vehicles.length)
  })

  it('treats existing dataset bids as a rival leading at the current bid', () => {
    const v = vehicles.find((x) => x.current_bid !== null)!
    expect(state.lots[v.lot]).toMatchObject({ leader: 'rival', leaderMax: v.current_bid, currentBid: v.current_bid, bidCount: v.bid_count })
  })

  it('leaves lots without bids with no leader', () => {
    const v = vehicles.find((x) => x.current_bid === null)!
    expect(state.lots[v.lot]).toMatchObject({ leader: null, currentBid: null })
  })
})

describe('rival response (P20)', () => {
  it('plans nothing when the buyer bids but does not lead', () => {
    const { state } = placeBuyerBid(stateWith(rivalLeading(40_000)), 'T-0001', 37_000, NOW, GIVE_UP)
    expect(state.pendingRivalBids).toEqual([])
  })

  it('a rival that gives up bids a few times, pushes the price up, and the buyer keeps the lead', () => {
    let { state } = placeBuyerBid(stateWith(rivalLeading(35_000)), 'T-0001', 38_000, NOW, GIVE_UP)
    expect(state.pendingRivalBids.length).toBeGreaterThanOrEqual(2)
    expect(state.pendingRivalBids.every((p) => p.kind === 'try')).toBe(true)

    const priceBefore = state.lots['T-0001'].currentBid!
    const result = tick(state, NOW + 2 * MINUTE, GIVE_UP)
    state = result.state

    expect(state.lots['T-0001'].leader).toBe('you')
    expect(state.lots['T-0001'].currentBid!).toBeGreaterThan(priceBefore)
    expect(state.lots['T-0001'].currentBid!).toBeLessThanOrEqual(38_000)
    expect(result.events.some((e) => e.type === 'outbid')).toBe(false)
    expect(state.pendingRivalBids).toEqual([])
  })

  it('a rival that out-maxes the buyer takes the lead and fires an outbid event', () => {
    let { state } = placeBuyerBid(stateWith(rivalLeading(35_000)), 'T-0001', 38_000, NOW, OUTMAX)
    expect(state.pendingRivalBids).toEqual([expect.objectContaining({ kind: 'outmax', max: 38_100 })])

    const result = tick(state, NOW + MINUTE, OUTMAX)
    state = result.state
    expect(state.lots['T-0001']).toMatchObject({ leader: 'rival', currentBid: 38_100, yourMax: 38_000 })
    expect(result.events).toContainEqual({ type: 'outbid', lot: 'T-0001', currentBid: 38_100 })
  })

  it('a rival never out-maxes past the Buy Now price', () => {
    const lot = rivalLeading(35_000, { buyNowPrice: 38_000, reservePrice: 45_000 })
    const { state } = placeBuyerBid(stateWith(lot), 'T-0001', 38_000, NOW, OUTMAX)
    expect(state.pendingRivalBids.every((p) => p.kind === 'try')).toBe(true)
  })

  it('does nothing before the response is due', () => {
    const { state } = placeBuyerBid(stateWith(rivalLeading(35_000)), 'T-0001', 38_000, NOW, OUTMAX)
    expect(tick(state, NOW + SECOND, OUTMAX).state.lots['T-0001'].leader).toBe('you')
  })

  it('drops responses for lots that ended before they fired', () => {
    const { state } = placeBuyerBid(stateWith(rivalLeading(35_000)), 'T-0001', 38_000, NOW, OUTMAX)
    // End the lot before the response is due (5-15 s after the bid).
    const ended = { ...state, lots: { 'T-0001': { ...state.lots['T-0001'], endsAt: NOW + 2 * SECOND } } }
    const after = tick(ended, NOW + MINUTE, OUTMAX).state
    expect(after.lots['T-0001'].leader).toBe('you')
    expect(after.pendingRivalBids).toEqual([])
  })

  it('a new buyer bid replaces the pending response on that lot', () => {
    const first = placeBuyerBid(stateWith(rivalLeading(35_000)), 'T-0001', 38_000, NOW, GIVE_UP).state
    const second = placeBuyerBid(first, 'T-0001', 50_000, NOW + SECOND, OUTMAX).state
    expect(second.pendingRivalBids).toEqual([expect.objectContaining({ kind: 'outmax' })])
  })
})

describe('rival snipes and the soft close (P38)', () => {
  // Whether rivals snipe is fixed per lot and demo. Find lot ids on each side.
  const ids = Array.from({ length: 40 }, (_, i) => `S-${i}`)
  const sniped = ids.find((id) => rivalsSnipe(`${NOW}:${id}`))!
  const calm = ids.find((id) => !rivalsSnipe(`${NOW}:${id}`))!

  it('snipes on roughly 40% of lots', () => {
    const share = Array.from({ length: 2000 }, (_, i) => rivalsSnipe(`${NOW}:L-${i}`)).filter(Boolean).length / 2000
    expect(share).toBeGreaterThan(0.35)
    expect(share).toBeLessThan(0.45)
  })

  it('plans a last-minute bid 10-50 s before the end on a sniped lot', () => {
    const lot = rivalLeading(35_000, { lot: sniped, endsAt: NOW + HOUR })
    const { state } = placeBuyerBid(stateWith(lot), sniped, 38_000, NOW, GIVE_UP)
    const snipe = state.pendingRivalBids.find((p) => p.at > NOW + 10 * MINUTE)!
    expect(snipe).toBeDefined()
    expect(snipe.at).toBeGreaterThanOrEqual(NOW + HOUR - 50 * SECOND)
    expect(snipe.at).toBeLessThanOrEqual(NOW + HOUR - 10 * SECOND)
  })

  it('plans no snipe on other lots', () => {
    const lot = rivalLeading(35_000, { lot: calm, endsAt: NOW + HOUR })
    const { state } = placeBuyerBid(stateWith(lot), calm, 38_000, NOW, GIVE_UP)
    expect(state.pendingRivalBids.every((p) => p.at < NOW + MINUTE)).toBe(true)
  })

  it('an out-maxing snipe takes the lead, fires an outbid event and extends the auction', () => {
    const lot = rivalLeading(35_000, { lot: sniped, endsAt: NOW + HOUR })
    let { state } = placeBuyerBid(stateWith(lot), sniped, 38_000, NOW, OUTMAX)
    // Drop the normal response so only the snipe is left.
    state = { ...state, pendingRivalBids: state.pendingRivalBids.filter((p) => p.at > NOW + MINUTE) }
    const snipeAt = state.pendingRivalBids[0].at

    const result = tick(state, snipeAt, OUTMAX)
    expect(result.state.lots[sniped]).toMatchObject({ leader: 'rival', endsAt: snipeAt + 2 * MINUTE, extensions: 1 })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'outbid', lot: sniped }))
  })
})

describe('background rival bids', () => {
  it('bids on a live lot the buyer is not leading', () => {
    const state = { ...stateWith(rivalLeading(35_000)), nextBackgroundBidAt: NOW }
    const result = tick(state, NOW, fixedRng(0))
    expect(result.state.lots['T-0001'].currentBid).toBe(35_100)
    expect(result.events).toContainEqual({ type: 'rival-bid', lot: 'T-0001', currentBid: 35_100 })
    expect(result.state.nextBackgroundBidAt).toBeGreaterThan(NOW)
  })

  it('never bids on lots the buyer is leading', () => {
    const leading = placeBuyerBid(stateWith(rivalLeading(35_000)), 'T-0001', 38_000, NOW, GIVE_UP).state
    const state = { ...leading, pendingRivalBids: [], nextBackgroundBidAt: NOW }
    expect(tick(state, NOW, fixedRng(0)).state.lots['T-0001']).toEqual(leading.lots['T-0001'])
  })

  it('stays under the Buy Now price', () => {
    const lot = rivalLeading(35_000, { buyNowPrice: 35_100 })
    const state = { ...stateWith(lot), nextBackgroundBidAt: NOW }
    expect(tick(state, NOW, fixedRng(0)).state.lots['T-0001'].currentBid).toBe(35_000)
  })
})

describe('tick', () => {
  it('returns the same state object when nothing happens', () => {
    const state = stateWith(makeLot())
    expect(tick(state, NOW, fixedRng(0)).state).toBe(state)
  })
})

describe('buy now and watchlist', () => {
  it('buying now cancels pending rival bids on that lot', () => {
    const lot = makeLot({ buyNowPrice: 30_000, reservePrice: 25_000 })
    const bidding = placeBuyerBid(stateWith(lot), 'T-0001', 15_000, NOW, GIVE_UP).state
    const { state, result } = buyNowLot(bidding, 'T-0001', NOW + SECOND)
    expect(result.ok).toBe(true)
    expect(state.pendingRivalBids).toEqual([])
  })

  it('toggles a lot on and off the watchlist', () => {
    const on = toggleWatch(stateWith(makeLot()), 'T-0001')
    expect(on.watchlist).toEqual(['T-0001'])
    expect(toggleWatch(on, 'T-0001').watchlist).toEqual([])
  })
})
