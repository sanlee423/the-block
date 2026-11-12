import { hashString, seededRng } from './random'
import type { Vehicle } from './vehicle'

/**
 * P36 and P37: an estimated market value per car, a High / Fair / Low price
 * rating against it, and a 12-month price trend per make and model.
 *
 * There's no market data in the dataset, so the value is built from the
 * public starting bid, adjusted for year, km, grade and title, plus seeded
 * noise. It never uses the reserve, so the rating can't leak it (P4).
 * The UI labels it as an estimate and demo data.
 */

export const MARKET = {
  /**
   * Market value as a multiple of the starting bid, before adjustments. Starting
   * bids sit well below market on purpose, and reserves average about 1.47x the
   * starting bid. At 1.35, most lots open as a Low price and drift to Fair or
   * High as bidding nears the reserve.
   */
  startingBidMultiple: 1.35,
  /** Each grade point above or below 3.0 moves the value 4%. */
  perGradePoint: 0.04,
  /** Typical km driven per year. More than that lowers the value, less raises it. */
  kmPerYear: 18_000,
  /** Per 10,000 km above or below typical, capped at ±10%. */
  per10kKm: 0.015,
  title: { clean: 1, rebuilt: 0.92, salvage: 0.85 },
  /** Seeded noise, ±15%. */
  noise: 0.15,
  /** Rating bands, as a share of the value. */
  lowBelow: 0.9,
  highAbove: 1.1,
} as const

/** The dataset's "current" model year, for age. */
const CURRENT_YEAR = 2026

export function marketValue(vehicle: Vehicle): number {
  const m = MARKET
  const rng = seededRng(hashString(`market:${vehicle.id}`))
  const age = Math.max(1, CURRENT_YEAR - vehicle.year)
  const kmDelta = (vehicle.odometer_km - age * m.kmPerYear) / 10_000
  const kmFactor = 1 - Math.max(-0.1, Math.min(0.1, kmDelta * m.per10kKm))
  const gradeFactor = 1 + (vehicle.condition_grade - 3) * m.perGradePoint
  const noise = 1 + (rng() * 2 - 1) * m.noise
  const value =
    vehicle.starting_bid * m.startingBidMultiple * kmFactor * gradeFactor * m.title[vehicle.title_status] * noise
  return Math.round(value / 100) * 100
}

export type DealRating = 'low' | 'fair' | 'high'

export function dealRating(price: number, value: number): DealRating {
  const ratio = price / value
  if (ratio < MARKET.lowBelow) return 'low'
  if (ratio > MARKET.highAbove) return 'high'
  return 'fair'
}

/** Price vs value as a whole percent: -12 means 12% below the estimate. */
export function percentFromValue(price: number, value: number): number {
  return Math.round((price / value - 1) * 100)
}

export interface TrendPoint {
  /** First day of the month, as a timestamp. */
  month: number
  price: number
}

/**
 * P37: 12 monthly average sale prices for a make and model, all trims and
 * years, ending this month at the model's average market value. Drifts down
 * gently (cars depreciate) with some noise. Seeded by make and model, so every
 * car of that model shows the same line.
 */
export function modelPriceTrend(make: string, model: string, vehicles: readonly Vehicle[], now: number): TrendPoint[] {
  const same = vehicles.filter((v) => v.make === make && v.model === model)
  if (same.length === 0) return []
  const average = same.reduce((sum, v) => sum + marketValue(v), 0) / same.length

  const rng = seededRng(hashString(`trend:${make}|${model}`))
  // Monthly change between -1.2% and +0.2%: mostly depreciation, the odd flat month.
  const drifts = Array.from({ length: 11 }, () => -0.012 + rng() * 0.014)
  const prices = [average]
  for (const drift of drifts) prices.unshift(prices[0] / (1 + drift) * (1 + (rng() - 0.5) * 0.02))

  const d = new Date(now)
  return prices.map((price, i) => ({
    month: new Date(d.getFullYear(), d.getMonth() - (prices.length - 1 - i), 1).getTime(),
    price: Math.round(price / 100) * 100,
  }))
}
