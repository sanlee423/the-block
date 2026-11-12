import { GavelIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BuyerStatusBadge } from '@/components/BuyerStatusBadge'
import { Button } from '@/components/ui/button'
import { buyerStatus, phase, type LotState } from '@/domain/lot'
import { auctionTimeLabel } from '@/lib/auction-time'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The bid box's id, set in BidBox. */
const BID_BOX_ID = 'bid-box'

/**
 * P43: on phones and tablets the bid box sits below the photos, so this bar
 * keeps the price, time left and a Bid button at the bottom of the screen.
 * It hides while the bid box itself is visible, and on ended auctions.
 * Desktop doesn't need it: the bid box is pinned in the right column there.
 */
export function MobileBidBar({ lot, now }: { lot: LotState; now: number }) {
  const bidBoxVisible = useBidBoxVisible()
  const p = phase(lot, now)
  if (p === 'ended') return null

  const status = buyerStatus(lot, now)
  const time = auctionTimeLabel(lot, now)
  const price = lot.currentBid ?? lot.startingBid

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur transition-transform lg:hidden',
        bidBoxVisible && 'pointer-events-none translate-y-full',
      )}
      aria-hidden={bidBoxVisible}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="text-lg font-semibold tabular-nums">{formatPrice(price)}</span>
            {status && <BuyerStatusBadge status={status} />}
          </p>
          <p className={cn('truncate text-xs tabular-nums', time.urgent ? 'font-medium text-destructive' : 'text-muted-foreground')}>
            {lot.currentBid === null ? 'Starting bid' : `${lot.bidCount} ${lot.bidCount === 1 ? 'bid' : 'bids'}`} ·{' '}
            {time.text}
            {time.extended && ' · Extended'}
          </p>
        </div>
        <Button
          className="h-11 shrink-0 px-5"
          tabIndex={bidBoxVisible ? -1 : undefined}
          onClick={() => document.getElementById(BID_BOX_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          {p === 'live' && <GavelIcon aria-hidden />}
          {p === 'live' ? (status === 'winning' ? 'Raise max' : 'Bid') : 'View'}
        </Button>
      </div>
    </div>
  )
}

/** True while any part of the bid box is on screen. */
function useBidBoxVisible(): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = document.getElementById(BID_BOX_ID)
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return visible
}
