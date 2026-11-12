import { HeartIcon } from 'lucide-react'
import { auction, useWatchlist } from '@/state/auction-store'
import { cn } from '@/lib/utils'

/** Heart toggle for the watchlist (P10). */
export function WatchButton({ lot, label, className }: { lot: string; label: string; className?: string }) {
  const watched = useWatchlist().includes(lot)
  return (
    <button
      type="button"
      onClick={() => auction.toggleWatch(lot)}
      aria-pressed={watched}
      aria-label={watched ? `Remove ${label} from watchlist` : `Add ${label} to watchlist`}
      className={cn(
        'grid size-8 place-items-center rounded-full bg-background/90 shadow-sm backdrop-blur transition-colors hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        watched ? 'text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <HeartIcon className={cn('size-4', watched && 'fill-current')} aria-hidden />
    </button>
  )
}
