import type { LotState } from '@/domain/lot'
import type { Vehicle } from '@/domain/vehicle'
import { cn } from '@/lib/utils'
import { LotCard } from './LotCard'

/** The responsive card grid used by Inventory, My bids and Watchlist (P5). */
export function LotGrid({
  items,
  now,
  noteFor,
  className,
}: {
  items: { vehicle: Vehicle; lot: LotState }[]
  now: number
  /** An extra line for some cards (see LotCard's `note`). */
  noteFor?: (item: { vehicle: Vehicle; lot: LotState }) => string | null
  className?: string
}) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]',
        className,
      )}
    >
      {items.map(({ vehicle, lot }) => (
        <li key={vehicle.lot} className="flex">
          <LotCard vehicle={vehicle} lot={lot} now={now} note={noteFor?.({ vehicle, lot })} />
        </li>
      ))}
    </ul>
  )
}
