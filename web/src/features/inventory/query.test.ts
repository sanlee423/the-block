import { describe, expect, it } from 'vitest'
import { createAuctionState } from '@/domain/auction'
import { buyNowAvailable, phase } from '@/domain/lot'
import { NOW, fixedRng } from '@/domain/test-helpers'
import { HOUR } from '@/domain/time'
import { vehicles } from '@/domain/vehicles'
import {
  activeFilterCount,
  DEFAULT_QUERY,
  displayPrice,
  modelKey,
  NO_FILTERS,
  parseQuery,
  runQuery,
  toParams,
  updateFilters,
  type InventoryFilters,
  type InventoryQuery,
} from './query'

const state = createAuctionState(vehicles, NOW, fixedRng(0.5))
const items = vehicles.map((vehicle) => ({ vehicle, lot: state.lots[vehicle.lot] }))
const run = (q: Partial<Omit<InventoryQuery, 'filters'>> = {}, filters: Partial<InventoryFilters> = {}) =>
  runQuery(items, { ...DEFAULT_QUERY, ...q, filters: { ...NO_FILTERS, ...filters } }, NOW)

describe('parseQuery / toParams', () => {
  it('falls back to defaults for missing or unknown values', () => {
    expect(parseQuery(new URLSearchParams('sort=bogus&status=nope&yearMin=abc'))).toEqual(DEFAULT_QUERY)
  })

  it('round-trips every field through the URL', () => {
    const query: InventoryQuery = {
      q: 'bronco',
      status: 'live',
      sort: 'price-asc',
      filters: {
        makes: ['Ford', 'Toyota'],
        models: ['Ford|Bronco'],
        bodies: ['SUV'],
        drivetrains: ['4WD'],
        fuels: ['gasoline', 'hybrid'],
        yearMin: 2020,
        yearMax: 2024,
        priceMin: 10_000,
        priceMax: 40_000,
        kmMax: 100_000,
        noReserve: true,
        buyNow: true,
        endingSoon: true,
      },
    }
    const params = toParams(query)
    expect(params.get('make')).toBe('Ford,Toyota')
    expect(parseQuery(params)).toEqual(query)
  })

  it('writes nothing for the default query', () => {
    expect(toParams(DEFAULT_QUERY).toString()).toBe('')
  })
})

describe('updateFilters', () => {
  it('drops models whose make is deselected', () => {
    const filters = { ...NO_FILTERS, makes: ['Ford', 'Toyota'], models: ['Ford|Bronco', 'Toyota|RAV4'] }
    expect(updateFilters(filters, { makes: ['Toyota'] }).models).toEqual(['Toyota|RAV4'])
    expect(updateFilters(filters, { makes: [] }).models).toEqual([])
  })

  it('counts active filters, with each range counting once', () => {
    expect(activeFilterCount({ ...NO_FILTERS, makes: ['Ford'], yearMin: 2020, yearMax: 2022, noReserve: true })).toBe(3)
  })
})

describe('runQuery: status and search', () => {
  it('hides ended lots by default (P18)', () => {
    const result = run()
    expect(result.some((i) => phase(i.lot, NOW) === 'ended')).toBe(false)
    expect(result.length).toBe(vehicles.length - 20)
  })

  it('shows only ended lots with the ended tab', () => {
    expect(run({ status: 'ended' }).every((i) => phase(i.lot, NOW) === 'ended')).toBe(true)
  })

  it('matches every search term, case-insensitively', () => {
    const result = run({ q: 'FORD bronco' })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((i) => i.vehicle.make === 'Ford' && i.vehicle.model === 'Bronco')).toBe(true)
  })

  it('finds a lot by lot number', () => {
    const lot = items.find((i) => phase(i.lot, NOW) !== 'ended')!.vehicle.lot
    expect(run({ q: lot.toLowerCase() }).map((i) => i.vehicle.lot)).toEqual([lot])
  })
})

describe('runQuery: filters (P6, P31)', () => {
  it('filters by make', () => {
    const result = run({}, { makes: ['Honda', 'Kia'] })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((i) => ['Honda', 'Kia'].includes(i.vehicle.make))).toBe(true)
  })

  it('a model narrows only its own make', () => {
    const result = run({}, { makes: ['Ford', 'Toyota'], models: [modelKey('Ford', 'Bronco')] })
    const fords = result.filter((i) => i.vehicle.make === 'Ford')
    expect(fords.length).toBeGreaterThan(0)
    expect(fords.every((i) => i.vehicle.model === 'Bronco')).toBe(true)
    expect(result.some((i) => i.vehicle.make === 'Toyota')).toBe(true)
  })

  it('filters by year, price and km ranges (price = current bid, or starting bid)', () => {
    const result = run({}, { yearMin: 2020, yearMax: 2023, priceMin: 10_000, priceMax: 30_000, kmMax: 80_000 })
    expect(result.length).toBeGreaterThan(0)
    for (const { vehicle, lot } of result) {
      expect(vehicle.year).toBeGreaterThanOrEqual(2020)
      expect(vehicle.year).toBeLessThanOrEqual(2023)
      expect(displayPrice(lot)).toBeGreaterThanOrEqual(10_000)
      expect(displayPrice(lot)).toBeLessThanOrEqual(30_000)
      expect(vehicle.odometer_km).toBeLessThanOrEqual(80_000)
    }
  })

  it('filters by body, drivetrain and fuel', () => {
    const result = run({}, { bodies: ['truck'], drivetrains: ['4WD'], fuels: ['diesel', 'gasoline'] })
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((i) => i.vehicle.body_style === 'truck' && i.vehicle.drivetrain === '4WD')).toBe(true)
  })

  it('no reserve, Buy Now available, ending within 24 hours', () => {
    expect(run({}, { noReserve: true }).every((i) => i.lot.reservePrice === null)).toBe(true)
    expect(run({}, { buyNow: true }).every((i) => buyNowAvailable(i.lot, NOW))).toBe(true)
    const ending = run({}, { endingSoon: true })
    expect(ending.length).toBeGreaterThan(0)
    expect(ending.every((i) => phase(i.lot, NOW) === 'live' && i.lot.endsAt - NOW <= 24 * HOUR)).toBe(true)
  })
})

describe('runQuery: sort (P19)', () => {
  it('ending soonest: live by end time, then upcoming', () => {
    const result = run()
    const phases = result.map((i) => phase(i.lot, NOW))
    expect(phases.indexOf('upcoming')).toBe(phases.lastIndexOf('live') + 1)
    const live = result.filter((i) => phase(i.lot, NOW) === 'live').map((i) => i.lot.endsAt)
    expect(live).toEqual([...live].sort((a, b) => a - b))
  })

  it('price low to high', () => {
    const prices = run({ sort: 'price-asc' }).map((i) => displayPrice(i.lot))
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
  })
})
