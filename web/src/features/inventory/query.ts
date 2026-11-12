import { buyNowAvailable, endedAt, phase, type LotPhase, type LotState } from '@/domain/lot'
import { DAY } from '@/domain/time'
import type { BodyStyle, Drivetrain, FuelType, Vehicle } from '@/domain/vehicle'

/**
 * Inventory search, filters, status and sort (P6, P18, P19, P31).
 * Everything lives in the URL query string (T5), e.g.
 * /?q=bronco&make=Ford&yearMin=2020&noReserve=1&sort=price-asc
 */

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Live & upcoming' },
  { value: 'live', label: 'Live' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
] as const
export type StatusFilter = (typeof STATUS_OPTIONS)[number]['value']

export const SORT_OPTIONS = [
  { value: 'ending', label: 'Ending soonest' },
  { value: 'newest', label: 'Newly listed' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'km-asc', label: 'Kilometres: lowest' },
  { value: 'year-desc', label: 'Year: newest' },
] as const
export type SortOption = (typeof SORT_OPTIONS)[number]['value']

/** "Ending soon" filter: live lots that end within this window. */
export const ENDING_SOON_WINDOW = DAY

export interface InventoryFilters {
  makes: string[]
  models: string[]
  bodies: BodyStyle[]
  drivetrains: Drivetrain[]
  fuels: FuelType[]
  yearMin: number | null
  yearMax: number | null
  priceMin: number | null
  priceMax: number | null
  kmMax: number | null
  noReserve: boolean
  buyNow: boolean
  endingSoon: boolean
}

export interface InventoryQuery {
  q: string
  status: StatusFilter
  sort: SortOption
  filters: InventoryFilters
}

export const NO_FILTERS: InventoryFilters = {
  makes: [],
  models: [],
  bodies: [],
  drivetrains: [],
  fuels: [],
  yearMin: null,
  yearMax: null,
  priceMin: null,
  priceMax: null,
  kmMax: null,
  noReserve: false,
  buyNow: false,
  endingSoon: false,
}

/** Defaults are left out of the URL, so a plain "/" means ending soonest, live & upcoming. */
export const DEFAULT_QUERY: InventoryQuery = { q: '', status: 'active', sort: 'ending', filters: NO_FILTERS }

// ---------------------------------------------------------------------------
// URL <-> query

type ListKey = 'makes' | 'models' | 'bodies' | 'drivetrains' | 'fuels'
type NumberKey = 'yearMin' | 'yearMax' | 'priceMin' | 'priceMax' | 'kmMax'
type FlagKey = 'noReserve' | 'buyNow' | 'endingSoon'

/** URL parameter name for each list filter. Short, singular names read better in a URL. */
const LIST_PARAMS: Record<ListKey, string> = {
  makes: 'make',
  models: 'model',
  bodies: 'body',
  drivetrains: 'drive',
  fuels: 'fuel',
}
const NUMBER_KEYS: NumberKey[] = ['yearMin', 'yearMax', 'priceMin', 'priceMax', 'kmMax']
const FLAG_KEYS: FlagKey[] = ['noReserve', 'buyNow', 'endingSoon']

export function parseQuery(params: URLSearchParams): InventoryQuery {
  const filters = { ...NO_FILTERS }
  for (const [key, param] of Object.entries(LIST_PARAMS) as [ListKey, string][]) {
    const raw = params.get(param)
    ;(filters[key] as string[]) = raw ? raw.split(',').filter(Boolean) : []
  }
  for (const key of NUMBER_KEYS) {
    const value = Number(params.get(key))
    filters[key] = params.has(key) && Number.isFinite(value) && value >= 0 ? value : null
  }
  for (const key of FLAG_KEYS) filters[key] = params.get(key) === '1'

  return {
    q: params.get('q') ?? '',
    status: oneOf(params.get('status'), STATUS_OPTIONS, DEFAULT_QUERY.status),
    sort: oneOf(params.get('sort'), SORT_OPTIONS, DEFAULT_QUERY.sort),
    filters,
  }
}

/** The URL params for a query. Defaults and empty values are left out. */
export function toParams(query: InventoryQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.status !== DEFAULT_QUERY.status) params.set('status', query.status)
  if (query.sort !== DEFAULT_QUERY.sort) params.set('sort', query.sort)
  const f = query.filters
  for (const [key, param] of Object.entries(LIST_PARAMS) as [ListKey, string][]) {
    if (f[key].length > 0) params.set(param, f[key].join(','))
  }
  for (const key of NUMBER_KEYS) if (f[key] !== null) params.set(key, String(f[key]))
  for (const key of FLAG_KEYS) if (f[key]) params.set(key, '1')
  return params
}

/**
 * Apply a change to the filters, keeping them consistent: models must belong
 * to a selected make, so deselecting a make drops its models.
 */
export function updateFilters(filters: InventoryFilters, patch: Partial<InventoryFilters>): InventoryFilters {
  const next = { ...filters, ...patch }
  next.models = next.models.filter((m) => next.makes.includes(makeOf(m)))
  return next
}

function makeOf(modelKeyValue: string): string {
  return modelKeyValue.split('|')[0]
}

/** Models are stored as "Make|Model" so "Ford|Escape" can't clash with another make's model. */
export function modelKey(make: string, model: string): string {
  return `${make}|${model}`
}

export function activeFilterCount(f: InventoryFilters): number {
  return (
    f.makes.length +
    f.models.length +
    f.bodies.length +
    f.drivetrains.length +
    f.fuels.length +
    (f.yearMin !== null || f.yearMax !== null ? 1 : 0) +
    (f.priceMin !== null || f.priceMax !== null ? 1 : 0) +
    (f.kmMax !== null ? 1 : 0) +
    FLAG_KEYS.filter((k) => f[k]).length
  )
}

// ---------------------------------------------------------------------------
// Running a query

export interface InventoryItem {
  vehicle: Vehicle
  lot: LotState
}

export function runQuery(items: readonly InventoryItem[], query: InventoryQuery, now: number): InventoryItem[] {
  return baseResults(items, query, now)
    .filter((item) => matchesFilters(item, query.filters, now))
    .sort(comparator(query.sort, now))
}

/**
 * Items matching the status tab and search, before the filter panel.
 * Filter option counts are based on these.
 */
export function baseResults(items: readonly InventoryItem[], query: InventoryQuery, now: number): InventoryItem[] {
  const terms = query.q.toLowerCase().split(/\s+/).filter(Boolean)
  return items.filter(
    ({ vehicle, lot }) =>
      matchesStatus(phase(lot, now), query.status) && terms.every((term) => searchText(vehicle).includes(term)),
  )
}

export function matchesFilters({ vehicle: v, lot }: InventoryItem, f: InventoryFilters, now: number): boolean {
  const price = displayPrice(lot)
  return (
    (f.makes.length === 0 || f.makes.includes(v.make)) &&
    // Models narrow their own make only: picking "Ford|Escape" plus make Toyota
    // shows Ford Escapes and every Toyota.
    (!f.models.some((m) => makeOf(m) === v.make) || f.models.includes(modelKey(v.make, v.model))) &&
    (f.bodies.length === 0 || f.bodies.includes(v.body_style)) &&
    (f.drivetrains.length === 0 || f.drivetrains.includes(v.drivetrain)) &&
    (f.fuels.length === 0 || f.fuels.includes(v.fuel_type)) &&
    (f.yearMin === null || v.year >= f.yearMin) &&
    (f.yearMax === null || v.year <= f.yearMax) &&
    (f.priceMin === null || price >= f.priceMin) &&
    (f.priceMax === null || price <= f.priceMax) &&
    (f.kmMax === null || v.odometer_km <= f.kmMax) &&
    (!f.noReserve || lot.reservePrice === null) &&
    (!f.buyNow || buyNowAvailable(lot, now)) &&
    (!f.endingSoon || (phase(lot, now) === 'live' && lot.endsAt - now <= ENDING_SOON_WINDOW))
  )
}

function matchesStatus(p: LotPhase, status: StatusFilter): boolean {
  if (status === 'active') return p !== 'ended'
  return p === status
}

const searchCache = new WeakMap<Vehicle, string>()

/** Free text matches year, make, model, trim, body, lot, VIN, dealer and location. */
function searchText(v: Vehicle): string {
  let text = searchCache.get(v)
  if (text === undefined) {
    text = [v.year, v.make, v.model, v.trim, v.body_style, v.lot, v.vin, v.selling_dealership, v.city, v.province]
      .join(' ')
      .toLowerCase()
    searchCache.set(v, text)
  }
  return text
}

/** What a lot costs right now: the current bid, or the starting bid. */
export function displayPrice(lot: LotState): number {
  return lot.currentBid ?? lot.startingBid
}

const PHASE_ORDER: Record<LotPhase, number> = { live: 0, upcoming: 1, ended: 2 }

function comparator(sort: SortOption, now: number) {
  return (a: InventoryItem, b: InventoryItem): number => {
    const byKey = compareBy(sort, a, b, now)
    return byKey !== 0 ? byKey : a.vehicle.lot.localeCompare(b.vehicle.lot)
  }
}

function compareBy(sort: SortOption, a: InventoryItem, b: InventoryItem, now: number): number {
  switch (sort) {
    case 'ending': {
      // Live lots by end time, then upcoming by start time, then ended (most recent first).
      const pa = phase(a.lot, now)
      const pb = phase(b.lot, now)
      if (pa !== pb) return PHASE_ORDER[pa] - PHASE_ORDER[pb]
      if (pa === 'live') return a.lot.endsAt - b.lot.endsAt
      if (pa === 'upcoming') return a.lot.startsAt - b.lot.startsAt
      return endedAt(b.lot) - endedAt(a.lot)
    }
    case 'newest':
      return b.lot.startsAt - a.lot.startsAt
    case 'price-asc':
      return displayPrice(a.lot) - displayPrice(b.lot)
    case 'price-desc':
      return displayPrice(b.lot) - displayPrice(a.lot)
    case 'km-asc':
      return a.vehicle.odometer_km - b.vehicle.odometer_km
    case 'year-desc':
      return b.vehicle.year - a.vehicle.year
  }
}

function oneOf<T extends string>(value: string | null, options: readonly { value: T }[], fallback: T): T {
  return options.some((o) => o.value === value) ? (value as T) : fallback
}
