import { phase, type LotState } from '@/domain/lot'
import { HOUR } from '@/domain/time'
import { formatDuration } from '@/lib/format'

/**
 * "Ends in 2d 4h", "Starts in 25m 10s" or "Ended". Turns urgent in the last hour.
 * `extended` is true while a late bid has pushed the end back (P38).
 */
export function auctionTimeLabel(lot: LotState, now: number): { text: string; urgent: boolean; extended?: boolean } {
  const p = phase(lot, now)
  if (p === 'upcoming') return { text: `Starts in ${formatDuration(lot.startsAt - now)}`, urgent: false }
  if (p === 'ended') return { text: lot.closedAt !== null ? 'Sold with Buy Now' : 'Ended', urgent: false }
  const left = lot.endsAt - now
  return { text: `Ends in ${formatDuration(left)}`, urgent: left < HOUR, extended: lot.extensions > 0 }
}
