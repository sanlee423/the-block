import type { BodyStyle, Drivetrain, FuelType } from '@/domain/vehicle'
import { vehicles } from '@/domain/vehicles'
import { formatKm, formatPrice } from '@/lib/format'
import { modelKey, type InventoryFilters } from './query'

/** Choices for the filter panel, derived from the dataset where possible. */

export const MAKES = [...new Set(vehicles.map((v) => v.make))].sort()

export const MODELS_BY_MAKE: Record<string, string[]> = Object.fromEntries(
  MAKES.map((make) => [make, [...new Set(vehicles.filter((v) => v.make === make).map((v) => v.model))].sort()]),
)

const years = vehicles.map((v) => v.year)
export const YEARS = range(Math.min(...years), Math.max(...years)).reverse()

export const BODY_LABELS: Record<BodyStyle, string> = {
  SUV: 'SUV',
  sedan: 'Sedan',
  truck: 'Truck',
  hatchback: 'Hatchback',
  coupe: 'Coupe',
}
export const DRIVETRAIN_LABELS: Record<Drivetrain, string> = { AWD: 'AWD', '4WD': '4WD', FWD: 'FWD', RWD: 'RWD' }
export const FUEL_LABELS: Record<FuelType, string> = {
  gasoline: 'Gasoline',
  hybrid: 'Hybrid',
  electric: 'Electric',
  diesel: 'Diesel',
}

/** Price steps for the min/max dropdowns (current bid, or starting bid). */
export const PRICE_STEPS = [5_000, 10_000, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 60_000, 75_000]
/** Odometer ceilings, AutoTempest-style "up to" choices. */
export const KM_STEPS = [25_000, 50_000, 75_000, 100_000, 150_000, 200_000]

export const FLAG_LABELS = {
  noReserve: 'No reserve',
  buyNow: 'Buy Now available',
  endingSoon: 'Ending within 24 hours',
} as const

export interface FilterChip {
  label: string
  /** The change that removes this chip. */
  remove: Partial<InventoryFilters>
}

/** One removable chip per active filter, shown above the results. */
export function filterChips(f: InventoryFilters): FilterChip[] {
  const chips: FilterChip[] = []
  for (const make of f.makes) chips.push({ label: make, remove: { makes: f.makes.filter((m) => m !== make) } })
  for (const m of f.models) {
    const [make, model] = m.split('|')
    chips.push({ label: `${make} ${model}`, remove: { models: f.models.filter((x) => x !== modelKey(make, model)) } })
  }
  if (f.yearMin !== null || f.yearMax !== null) {
    chips.push({ label: rangeLabel(f.yearMin, f.yearMax, String), remove: { yearMin: null, yearMax: null } })
  }
  if (f.priceMin !== null || f.priceMax !== null) {
    chips.push({ label: rangeLabel(f.priceMin, f.priceMax, formatPrice), remove: { priceMin: null, priceMax: null } })
  }
  if (f.kmMax !== null) chips.push({ label: `Up to ${formatKm(f.kmMax)}`, remove: { kmMax: null } })
  for (const b of f.bodies) chips.push({ label: BODY_LABELS[b], remove: { bodies: f.bodies.filter((x) => x !== b) } })
  for (const d of f.drivetrains) {
    chips.push({ label: DRIVETRAIN_LABELS[d], remove: { drivetrains: f.drivetrains.filter((x) => x !== d) } })
  }
  for (const fuel of f.fuels) chips.push({ label: FUEL_LABELS[fuel], remove: { fuels: f.fuels.filter((x) => x !== fuel) } })
  for (const key of Object.keys(FLAG_LABELS) as (keyof typeof FLAG_LABELS)[]) {
    if (f[key]) chips.push({ label: FLAG_LABELS[key], remove: { [key]: false } })
  }
  return chips
}

function rangeLabel(min: number | null, max: number | null, format: (n: number) => string): string {
  if (min !== null && max !== null) return `${format(min)} – ${format(max)}`
  if (min !== null) return `${format(min)}+`
  return `Up to ${format(max!)}`
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}
