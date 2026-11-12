import { describe, expect, it } from 'vitest'
import { fileBuyerClaim, STATE_VERSION, tick, type AuctionState } from './auction'
import { claimBlocker, decideClaim, disclosuresFor, fileClaim, GUARANTEE, type ClaimInput } from './guarantee'
import { fixedRng, makeLot, NOW } from './test-helpers'
import { DAY, MINUTE, SECOND } from './time'
import type { Vehicle } from './vehicle'
import { vehicles } from './vehicles'

const base = vehicles.find((v) => v.title_status === 'clean')!
const car = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  ...base,
  lot: 'T-0001',
  damage_notes: [],
  condition_report: 'Very clean vehicle inside and out.',
  ...overrides,
})
/** A lot the buyer won an hour ago. */
const won = makeLot({ endsAt: NOW - 60 * MINUTE, currentBid: 20_000, leader: 'you', leaderMax: 20_000, yourMax: 20_000 })
const input = (overrides: Partial<ClaimInput> = {}): ClaimInput => ({
  category: 'mechanical',
  description: 'Engine knocks under load',
  estimate: 2_400,
  ...overrides,
})
const rng = fixedRng(0)

describe('who can claim (P35)', () => {
  it('a won, clean-title lot within 7 days can be claimed', () => {
    expect(claimBlocker(car(), won, NOW)).toBeNull()
  })

  it('rebuilt and salvage cars are sold as-is', () => {
    expect(claimBlocker(car({ title_status: 'salvage' }), won, NOW)).toBe('as-is')
    expect(claimBlocker(car({ title_status: 'rebuilt' }), won, NOW)).toBe('as-is')
  })

  it('the window closes 7 days after the sale', () => {
    expect(claimBlocker(car(), won, NOW - 60 * MINUTE + GUARANTEE.windowMs - SECOND)).toBeNull()
    expect(claimBlocker(car(), won, NOW - 60 * MINUTE + GUARANTEE.windowMs)).toBe('window-closed')
  })

  it('counts from the Buy Now time for lots bought outright', () => {
    const bought = makeLot({ closedAt: NOW - 6 * DAY, currentBid: 30_000, leader: 'you', leaderMax: 30_000 })
    expect(claimBlocker(car(), bought, NOW)).toBeNull()
    expect(claimBlocker(car(), bought, NOW + DAY)).toBe('window-closed')
  })

  it('only lots the buyer won', () => {
    expect(claimBlocker(car(), makeLot(), NOW)).toBe('not-won')
    const lost = makeLot({ endsAt: NOW - MINUTE, currentBid: 20_000, leader: 'rival', leaderMax: 21_000, yourMax: 19_000 })
    expect(claimBlocker(car(), lost, NOW)).toBe('not-won')
  })
})

describe('the review', () => {
  it('approves an undisclosed problem over the minimum', () => {
    expect(decideClaim(car(), input())).toMatchObject({ status: 'approved' })
  })

  it('denies a problem disclosed in the damage notes, quoting the note', () => {
    const note = 'Transmission slips between 2nd and 3rd gear'
    expect(decideClaim(car({ damage_notes: [note] }), input())).toEqual({
      status: 'denied',
      reason: `Disclosed in the listing: “${note}”`,
    })
  })

  it('quotes every note that disclosed the category', () => {
    const notes = ['AC compressor intermittent - needs diagnosis', 'Check engine light - catalytic converter code']
    expect(decideClaim(car({ damage_notes: notes }), input()).reason).toBe(`Disclosed in the listing: “${notes[0]}”, “${notes[1]}”`)
  })

  it('denies a problem disclosed in the inspection report', () => {
    const report = 'Vehicle shows significant wear. Mechanical inspection recommended before purchase.'
    expect(decideClaim(car({ condition_report: report }), input()).reason).toContain('Mechanical inspection recommended')
  })

  it('a flood note covers water and electrical claims, not odometer ones', () => {
    const flooded = car({ damage_notes: ['Flood damage - electrical issues present'] })
    expect(disclosuresFor(flooded, 'flood')).toHaveLength(1)
    expect(disclosuresFor(flooded, 'electrical')).toHaveLength(1)
    expect(disclosuresFor(flooded, 'odometer')).toEqual([])
  })

  it('denies repairs under the minimum', () => {
    expect(decideClaim(car(), input({ estimate: 499 })).status).toBe('denied')
    expect(decideClaim(car(), input({ estimate: 500 })).status).toBe('approved')
  })
})

describe('filing', () => {
  it('rejects a second claim in the same category, but allows another category', () => {
    const first = fileClaim(car(), won, [], input(), NOW, rng)
    if (!first.ok) throw new Error('expected ok')
    expect(fileClaim(car(), won, [first.claim], input(), NOW, rng)).toEqual({ ok: false, reason: 'already-claimed' })
    expect(fileClaim(car(), won, [first.claim], input({ category: 'odometer' }), NOW, rng).ok).toBe(true)
  })

  it('needs a description and a whole-dollar estimate', () => {
    expect(fileClaim(car(), won, [], input({ description: '  ' }), NOW, rng)).toEqual({ ok: false, reason: 'missing-description' })
    expect(fileClaim(car(), won, [], input({ estimate: 0 }), NOW, rng)).toEqual({ ok: false, reason: 'invalid-estimate' })
  })

  it('stays under review until the decision is due, then fires an event', () => {
    const state: AuctionState = {
      version: STATE_VERSION,
      createdAt: NOW,
      lots: { 'T-0001': won },
      watchlist: [],
      pendingRivalBids: [],
      nextBackgroundBidAt: NOW + DAY,
      deliverTo: 'Ontario',
      claims: [],
      questions: [],
      notifications: [],
      endingNotified: [],
    }
    const filed = fileBuyerClaim(state, car(), input(), NOW, rng).state
    const claim = filed.claims[0]
    expect(claim).toMatchObject({ status: 'review', decideAt: NOW + 15 * SECOND })

    expect(tick(filed, NOW + 14 * SECOND, rng).state.claims[0].status).toBe('review')
    const decided = tick(filed, NOW + 15 * SECOND, rng)
    expect(decided.state.claims[0].status).toBe('approved')
    expect(decided.events).toContainEqual({ type: 'claim-decided', lot: 'T-0001', claimId: claim.id, status: 'approved' })
  })
})
