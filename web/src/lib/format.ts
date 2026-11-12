import { DAY, HOUR, MINUTE, SECOND } from '@/domain/time'

const price = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 0,
})
const number = new Intl.NumberFormat('en-CA')

/** $22,800 */
export function formatPrice(amount: number): string {
  return price.format(amount)
}

/** 47,731 km */
export function formatKm(km: number): string {
  return `${number.format(km)} km`
}

/**
 * Compact countdown, eBay style: "3d 4h", "4h 12m", "12m 05s", "45s".
 * Precision increases as the deadline gets closer.
 */
export function formatDuration(ms: number): string {
  const t = Math.max(0, ms)
  const d = Math.floor(t / DAY)
  const h = Math.floor((t % DAY) / HOUR)
  const m = Math.floor((t % HOUR) / MINUTE)
  const s = Math.floor((t % MINUTE) / SECOND)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

const PROVINCE_CODES: Record<string, string> = {
  Alberta: 'AB',
  'British Columbia': 'BC',
  Manitoba: 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Nova Scotia': 'NS',
  Ontario: 'ON',
  'Prince Edward Island': 'PE',
  Quebec: 'QC',
  Saskatchewan: 'SK',
}

/** Toronto, ON */
export function formatLocation(city: string, province: string): string {
  return `${city}, ${PROVINCE_CODES[province] ?? province}`
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
export function formatAgo(ms: number): string {
  const t = Math.max(0, ms)
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`
  if (t < MINUTE) return 'just now'
  if (t < HOUR) return plural(Math.floor(t / MINUTE), 'minute')
  if (t < DAY) return plural(Math.floor(t / HOUR), 'hour')
  return plural(Math.floor(t / DAY), 'day')
}
