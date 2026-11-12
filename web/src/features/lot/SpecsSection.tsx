import { StoreIcon } from 'lucide-react'
import type { Vehicle } from '@/domain/vehicle'
import { formatKm, formatLocation } from '@/lib/format'

const TRANSMISSION: Record<Vehicle['transmission'], string> = {
  automatic: 'Automatic',
  manual: 'Manual',
  CVT: 'CVT',
  'single-speed': 'Single-speed',
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Full specs as a definition list, AutoTempest-style labels. */
export function SpecsSection({ vehicle: v }: { vehicle: Vehicle }) {
  const specs: [string, string][] = [
    ['Year', String(v.year)],
    ['Make', v.make],
    ['Model', v.model],
    ['Trim', v.trim],
    ['Body style', v.body_style === 'SUV' ? 'SUV' : capitalize(v.body_style)],
    ['Odometer', formatKm(v.odometer_km)],
    ['Engine', v.engine],
    ['Transmission', TRANSMISSION[v.transmission]],
    ['Drivetrain', v.drivetrain],
    ['Fuel', capitalize(v.fuel_type)],
    ['Exterior', v.exterior_color],
    ['Interior', v.interior_color],
    ['VIN', v.vin],
    ['Lot', v.lot],
  ]
  return (
    <section aria-labelledby="specs-heading" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="specs-heading" className="text-lg font-semibold">
        Specifications
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {specs.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b py-2 text-sm last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function SellerSection({ vehicle }: { vehicle: Vehicle }) {
  return (
    <section aria-labelledby="seller-heading" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="seller-heading" className="text-sm text-muted-foreground">
        Selling dealership
      </h2>
      <p className="mt-1 flex items-center gap-2 font-semibold">
        <StoreIcon className="size-4 text-muted-foreground" aria-hidden />
        {vehicle.selling_dealership}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">{formatLocation(vehicle.city, vehicle.province)}</p>
    </section>
  )
}
