import { describe, expect, it } from 'vitest'
import { dealRating, MARKET, marketValue, modelPriceTrend, percentFromValue } from './market'
import { NOW } from './test-helpers'
import type { Vehicle } from './vehicle'
import { vehicles } from './vehicles'

const base = vehicles[0]
const car = (overrides: Partial<Vehicle>): Vehicle => ({ ...base, ...overrides })

describe('marketValue (P36)', () => {
  it('is stable for a car and rounded to $100', () => {
    expect(marketValue(base)).toBe(marketValue(base))
    expect(marketValue(base) % 100).toBe(0)
  })

  it('never looks at the reserve', () => {
    expect(marketValue(car({ reserve_price: 1 }))).toBe(marketValue(car({ reserve_price: 999_999 })))
  })

  it('a better grade, fewer km and a clean title are worth more', () => {
    expect(marketValue(car({ condition_grade: 4.5 }))).toBeGreaterThan(marketValue(car({ condition_grade: 2 })))
    expect(marketValue(car({ odometer_km: 5_000 }))).toBeGreaterThan(marketValue(car({ odometer_km: 250_000 })))
    expect(marketValue(car({ title_status: 'clean' }))).toBeGreaterThan(marketValue(car({ title_status: 'salvage' })))
  })

  it('stays within the noise band around the starting bid', () => {
    for (const v of vehicles) {
      const ratio = marketValue(v) / v.starting_bid
      expect(ratio).toBeGreaterThan(MARKET.startingBidMultiple * 0.6)
      expect(ratio).toBeLessThan(MARKET.startingBidMultiple * 1.5)
    }
  })

  it('gives every rating somewhere in the dataset at load', () => {
    const ratings = new Set(vehicles.map((v) => dealRating(v.current_bid ?? v.starting_bid, marketValue(v))))
    expect(ratings).toEqual(new Set(['low', 'fair', 'high']))
  })
})

describe('dealRating', () => {
  it.each([
    [8_900, 'low'],
    [9_000, 'fair'],
    [11_000, 'fair'],
    [11_100, 'high'],
  ] as const)('$%i against a $10,000 value is %s', (price, rating) => {
    expect(dealRating(price, 10_000)).toBe(rating)
  })

  it('reports the difference as a percent', () => {
    expect(percentFromValue(8_800, 10_000)).toBe(-12)
    expect(percentFromValue(10_500, 10_000)).toBe(5)
  })
})

describe('modelPriceTrend (P37)', () => {
  const trend = modelPriceTrend(base.make, base.model, vehicles, NOW)

  it('has 12 months, ending this month at the model average', () => {
    const same = vehicles.filter((v) => v.make === base.make && v.model === base.model)
    const average = same.reduce((n, v) => n + marketValue(v), 0) / same.length
    expect(trend).toHaveLength(12)
    expect(new Date(trend[11].month).getMonth()).toBe(new Date(NOW).getMonth())
    expect(Math.abs(trend[11].price - average)).toBeLessThanOrEqual(50)
  })

  it('is the same line for every car of that model', () => {
    expect(modelPriceTrend(base.make, base.model, vehicles, NOW)).toEqual(trend)
  })

  it('mostly depreciates over the year', () => {
    expect(trend[0].price).toBeGreaterThan(trend[11].price)
  })

  it('is empty for a model not in the data', () => {
    expect(modelPriceTrend('Nope', 'None', vehicles, NOW)).toEqual([])
  })
})
