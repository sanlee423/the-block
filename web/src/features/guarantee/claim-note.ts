import { CLAIM_CATEGORIES, claimBlocker, claimWindowEndsAt, type Claim, type ClaimCategory } from '@/domain/guarantee'
import type { LotState } from '@/domain/lot'
import type { Vehicle } from '@/domain/vehicle'
import { formatDuration } from '@/lib/format'

export const CATEGORY_LABEL = Object.fromEntries(CLAIM_CATEGORIES.map((c) => [c.id, c.label])) as Record<
  ClaimCategory,
  string
>

/**
 * One line about the guarantee for a won lot's card in My bids (P35):
 * the latest claim's status, or the time left to file one.
 */
export function claimNote(vehicle: Vehicle, lot: LotState, claims: readonly Claim[], now: number): string | null {
  const blocker = claimBlocker(vehicle, lot, now)
  if (blocker === 'as-is') return 'Sold as-is, no guarantee'
  const mine = claims.filter((c) => c.lot === lot.lot)
  if (mine.some((c) => c.status === 'review')) return 'Claim under review'
  if (mine.some((c) => c.status === 'approved')) return 'Claim approved'
  if (mine.length > 0) return 'Claim denied'
  if (blocker === null) return `Claim window: ${formatDuration(claimWindowEndsAt(lot) - now)} left`
  return null
}
