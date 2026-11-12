/**
 * The all-in price (P39): bid + buyer fee + transport estimate. Taxes are left
 * out, since dealers usually claim sales tax back. All figures are demo values.
 */

/** Buyer fee by sale price. Each band applies from its `from` price up to the next band. */
export const BUYER_FEE_BANDS = [
  { from: 0, fee: 300 },
  { from: 10_000, fee: 450 },
  { from: 25_000, fee: 600 },
  { from: 50_000, fee: 800 },
] as const

export function buyerFee(price: number): number {
  let fee: number = BUYER_FEE_BANDS[0].fee
  for (const band of BUYER_FEE_BANDS) if (price >= band.from) fee = band.fee
  return fee
}

/**
 * Each province is placed at its largest city. Province-to-province is coarse
 * (Toronto to Ottawa counts as the same province), which is fine for an estimate.
 */
export const PROVINCES = {
  Alberta: { code: 'AB', lat: 51.05, lng: -114.07 },
  'British Columbia': { code: 'BC', lat: 49.28, lng: -123.12 },
  Manitoba: { code: 'MB', lat: 49.9, lng: -97.14 },
  'New Brunswick': { code: 'NB', lat: 46.09, lng: -64.78 },
  'Newfoundland and Labrador': { code: 'NL', lat: 47.56, lng: -52.71 },
  'Nova Scotia': { code: 'NS', lat: 44.65, lng: -63.58 },
  Ontario: { code: 'ON', lat: 43.65, lng: -79.38 },
  'Prince Edward Island': { code: 'PE', lat: 46.24, lng: -63.13 },
  Quebec: { code: 'QC', lat: 45.5, lng: -73.57 },
  Saskatchewan: { code: 'SK', lat: 52.13, lng: -106.67 },
} as const

export type Province = keyof typeof PROVINCES
export const PROVINCE_NAMES = Object.keys(PROVINCES) as Province[]
export const DEFAULT_DELIVER_TO: Province = 'Ontario'

export function isProvince(value: string): value is Province {
  return value in PROVINCES
}

export const TRANSPORT = {
  /** Flat price within one province. Also the minimum anywhere. */
  sameProvince: 250,
  base: 150,
  perKm: 0.6,
  /** Roads are longer than a straight line. */
  roadFactor: 1.25,
  roundTo: 25,
} as const

/** Straight-line distance in km (haversine). */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Estimated road distance between two provinces, in km. 0 within one province. */
export function roadKm(from: Province, to: Province): number {
  if (from === to) return 0
  return Math.round(distanceKm(PROVINCES[from], PROVINCES[to]) * TRANSPORT.roadFactor)
}

/** Transport estimate from where the car is to the buyer's province. */
export function transportEstimate(from: string, to: Province): number {
  // A province we don't know (shouldn't happen with this dataset) is treated as local.
  if (!isProvince(from) || from === to) return TRANSPORT.sameProvince
  const t = TRANSPORT
  const raw = t.base + t.perKm * roadKm(from, to)
  return Math.max(t.sameProvince, Math.round(raw / t.roundTo) * t.roundTo)
}

export interface AllInPrice {
  price: number
  fee: number
  transport: number
  total: number
}

export function allInPrice(price: number, carProvince: string, deliverTo: Province): AllInPrice {
  const fee = buyerFee(price)
  const transport = transportEstimate(carProvince, deliverTo)
  return { price, fee, transport, total: price + fee + transport }
}
