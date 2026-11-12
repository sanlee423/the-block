import { useMemo } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { LotGrid } from '@/components/LotGrid'
import { endedAt, phase } from '@/domain/lot'
import { vehiclesByLot } from '@/domain/vehicles'
import { useAuctionState, useNow } from '@/state/auction-store'

/** Watched lots (P15): live by soonest end, then upcoming, then ended. */
export function WatchlistPage() {
  const { lots, watchlist } = useAuctionState()
  const now = useNow()

  const items = useMemo(() => {
    const order = { live: 0, upcoming: 1, ended: 2 }
    return watchlist
      .map((lot) => ({ vehicle: vehiclesByLot.get(lot)!, lot: lots[lot] }))
      .filter((i) => i.vehicle && i.lot)
      .sort((a, b) => {
        const pa = phase(a.lot, now)
        const pb = phase(b.lot, now)
        if (pa !== pb) return order[pa] - order[pb]
        if (pa === 'ended') return endedAt(b.lot) - endedAt(a.lot)
        return pa === 'live' ? a.lot.endsAt - b.lot.endsAt : a.lot.startsAt - b.lot.startsAt
      })
  }, [lots, watchlist, now])

  return (
    <section aria-labelledby="watchlist-heading">
      <h1 id="watchlist-heading" className="text-2xl font-semibold tracking-tight">
        Watchlist
        {items.length > 0 && <span className="ml-2 text-base font-normal text-muted-foreground tabular-nums">({items.length})</span>}
      </h1>
      <div className="mt-6">
        {items.length === 0 ? (
          <EmptyState title="Nothing on your watchlist">
            Tap the heart on any vehicle to follow it here.{' '}
            <Link to="/" className="text-primary hover:underline">
              Browse inventory
            </Link>
          </EmptyState>
        ) : (
          <LotGrid items={items} now={now} />
        )}
      </div>
    </section>
  )
}
