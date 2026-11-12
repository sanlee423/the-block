import { outcome, phase, type LotState } from '@/domain/lot'
import { dealRating, marketValue, percentFromValue, type DealRating } from '@/domain/market'
import type { Vehicle } from '@/domain/vehicle'
import { vehicles } from '@/domain/vehicles'

/** Market values are fixed per car, so work them out once. */
const valueByLot = new Map(vehicles.map((v) => [v.lot, marketValue(v)]))

export interface Deal {
  rating: DealRating
  value: number
  price: number
  /** -12 means 12% below the estimated value. */
  percent: number
}

/**
 * The deal rating for a lot right now (P36): the current bid (or starting bid)
 * against the estimated value. Sold lots are rated on their final price. Lots
 * that ended unsold have no rating.
 */
export function dealFor(vehicle: Vehicle, lot: LotState, now: number): Deal | null {
  const value = valueByLot.get(vehicle.lot) ?? marketValue(vehicle)
  let price: number
  if (phase(lot, now) === 'ended') {
    const result = outcome(lot)
    if (result.kind !== 'sold') return null
    price = result.price
  } else {
    price = lot.currentBid ?? lot.startingBid
  }
  return { rating: dealRating(price, value), value, price, percent: percentFromValue(price, value) }
}

export const DEAL_LABELS: Record<DealRating, string> = {
  low: 'Low price',
  fair: 'Fair price',
  high: 'High price',
}

/** "12% below", "3% above", "right at" the estimated value. */
export function differenceText(percent: number): string {
  if (percent === 0) return 'right at'
  return `${Math.abs(percent)}% ${percent < 0 ? 'below' : 'above'}`
}
