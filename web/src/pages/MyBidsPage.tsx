import { useMemo } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { LotGrid } from '@/components/LotGrid'
import { vehicles } from '@/domain/vehicles'
import { claimNote } from '@/features/guarantee/claim-note'
import { groupMyBids, MY_BID_GROUPS } from '@/features/my-bids/groups'
import { cn } from '@/lib/utils'
import { useAuctionState, useNow } from '@/state/auction-store'

/** Everything the buyer has bid on, grouped so what needs action comes first (P14). */
export function MyBidsPage() {
  const { lots, claims } = useAuctionState()
  const now = useNow()
  const groups = useMemo(
    () => groupMyBids(vehicles.map((vehicle) => ({ vehicle, lot: lots[vehicle.lot] })), now),
    [lots, now],
  )
  const total = MY_BID_GROUPS.reduce((n, g) => n + groups[g.status].length, 0)

  return (
    <section aria-labelledby="my-bids-heading">
      <h1 id="my-bids-heading" className="text-2xl font-semibold tracking-tight">
        My bids
      </h1>

      {total === 0 ? (
        <div className="mt-6">
          <EmptyState title="You haven't bid on anything yet">
            <Link to="/" className="text-primary hover:underline">
              Browse inventory
            </Link>{' '}
            to find a vehicle and place a bid.
          </EmptyState>
        </div>
      ) : (
        <>
          <nav aria-label="Bid groups" className="mt-3 flex flex-wrap gap-2 text-sm">
            {MY_BID_GROUPS.filter((g) => groups[g.status].length > 0).map((g) => (
              <a
                key={g.status}
                href={`#${g.status}`}
                className={cn(
                  'rounded-full border px-3 py-1 hover:bg-muted',
                  g.status === 'outbid' && 'border-destructive/40 text-destructive',
                )}
              >
                {g.title} <span className="tabular-nums">{groups[g.status].length}</span>
              </a>
            ))}
          </nav>

          {MY_BID_GROUPS.map((g) =>
            groups[g.status].length === 0 ? null : (
              <section key={g.status} id={g.status} aria-labelledby={`${g.status}-heading`} className="mt-8 scroll-mt-20">
                <h2 id={`${g.status}-heading`} className="text-lg font-semibold">
                  {g.title} <span className="font-normal text-muted-foreground tabular-nums">({groups[g.status].length})</span>
                </h2>
                <p className="mb-3 text-sm text-muted-foreground">{g.hint}</p>
                <LotGrid
                  items={groups[g.status]}
                  now={now}
                  noteFor={g.status === 'won' ? ({ vehicle, lot }) => claimNote(vehicle, lot, claims, now) : undefined}
                />
              </section>
            ),
          )}
        </>
      )}
    </section>
  )
}
