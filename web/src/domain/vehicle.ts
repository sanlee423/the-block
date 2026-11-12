/** A vehicle listing, exactly as it appears in data/vehicles.json. */
export interface Vehicle {
  id: string
  vin: string
  year: number
  make: string
  model: string
  trim: string
  body_style: BodyStyle
  exterior_color: string
  interior_color: string
  engine: string
  transmission: Transmission
  drivetrain: Drivetrain
  odometer_km: number
  fuel_type: FuelType
  condition_grade: number
  condition_report: string
  damage_notes: string[]
  title_status: TitleStatus
  province: string
  city: string
  /** Synthetic schedule data. Normalized against "now" by schedule.ts (P1). */
  auction_start: string
  starting_bid: number
  reserve_price: number | null
  buy_now_price: number | null
  images: string[]
  selling_dealership: string
  /** Lot number, e.g. "A-0043". Unique; used as the key and in URLs. */
  lot: string
  current_bid: number | null
  bid_count: number
}

export type BodyStyle = 'SUV' | 'sedan' | 'truck' | 'hatchback' | 'coupe'
export type Transmission = 'automatic' | 'manual' | 'CVT' | 'single-speed'
export type Drivetrain = 'FWD' | 'AWD' | '4WD' | 'RWD'
export type FuelType = 'gasoline' | 'hybrid' | 'electric' | 'diesel'
export type TitleStatus = 'clean' | 'rebuilt' | 'salvage'

export function vehicleTitle(v: Vehicle): string {
  return `${v.year} ${v.make} ${v.model} ${v.trim}`
}
