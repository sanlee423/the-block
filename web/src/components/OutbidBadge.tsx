import { buyerStatus } from '@/domain/lot'
import { useAuctionState, useNow } from '@/state/auction-store'

/** Red count on the "My bids" nav link: live lots where the buyer has been outbid. */
export function OutbidBadge() {
  const { lots } = useAuctionState()
  const now = useNow()
  const count = Object.values(lots).filter((lot) => buyerStatus(lot, now) === 'outbid').length
  if (count === 0) return null
  return (
    <span className="ml-1.5 inline-grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-xs font-semibold text-white tabular-nums dark:text-background">
      {count}
      <span className="sr-only"> outbid</span>
    </span>
  )
}
