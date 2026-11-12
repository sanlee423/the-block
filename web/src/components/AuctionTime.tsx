import { ClockIcon } from 'lucide-react'
import { endedAt, phase, type LotState } from '@/domain/lot'
import { auctionTimeLabel } from '@/lib/auction-time'
import { cn } from '@/lib/utils'

/**
 * Time chip shown on the card photo (P5) and in the bid box. `onPhoto` gives it
 * a frosted background that reads over an image; otherwise it sits on a muted one.
 */
export function AuctionTimeChip({
  lot,
  now,
  onPhoto = true,
  className,
}: {
  lot: LotState
  now: number
  onPhoto?: boolean
  className?: string
}) {
  const { text, urgent, extended } = auctionTimeLabel(lot, now)
  const ended = phase(lot, now) === 'ended'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums shadow-sm',
        urgent
          ? 'bg-destructive text-white dark:text-background'
          : onPhoto
            ? 'bg-background/90 text-foreground backdrop-blur'
            : 'bg-muted text-foreground',
        ended && 'text-muted-foreground',
        className,
      )}
    >
      <ClockIcon className="size-3" aria-hidden />
      {text}
      {extended && <span className="font-semibold uppercase tracking-wide text-[0.65rem]">· Extended</span>}
      {ended && lot.closedAt === null && (
        <span className="sr-only"> on {new Date(endedAt(lot)).toLocaleString()}</span>
      )}
    </span>
  )
}
