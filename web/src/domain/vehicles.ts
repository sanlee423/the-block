import data from '../../../data/vehicles.json'
import type { Vehicle } from './vehicle'

/** The full inventory, loaded once at build time. */
export const vehicles = data as Vehicle[]

export const vehiclesByLot: ReadonlyMap<string, Vehicle> = new Map(
  vehicles.map((v) => [v.lot, v]),
)
