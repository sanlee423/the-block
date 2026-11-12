import { buyerStatus, endedAt, type LotState } from './lot'
import { randInt, type Rng } from './random'
import { DAY, SECOND } from './time'
import type { Vehicle } from './vehicle'

/**
 * P35: the Block Guarantee. Clean-title cars are guaranteed to be as described:
 * if a covered problem turns up that the condition report and damage notes
 * didn't disclose, the buyer can file a claim within 7 days of winning.
 * Rebuilt and salvage cars are sold as-is.
 */

export const GUARANTEE = {
  windowMs: 7 * DAY,
  /** Repairs estimated under this aren't covered. */
  minimumEstimate: 500,
  /** The review is sped up for the demo: 15-30 s instead of days. */
  reviewSec: [15, 30],
} as const

export type ClaimCategory = 'mechanical' | 'electrical' | 'structural' | 'flood' | 'odometer' | 'equipment'

export const CLAIM_CATEGORIES: { id: ClaimCategory; label: string; examples: string }[] = [
  { id: 'mechanical', label: 'Engine, transmission or brakes', examples: 'knocking, slipping gears, warning lights' },
  { id: 'electrical', label: 'Electrical', examples: 'modules, wiring, lights or controls not working' },
  { id: 'structural', label: 'Frame, structure or airbags', examples: 'frame damage, deployed airbags' },
  { id: 'flood', label: 'Flood or water damage', examples: 'water in the cabin, corrosion, musty smell' },
  { id: 'odometer', label: 'Odometer', examples: 'km reading wrong or rolled back' },
  { id: 'equipment', label: 'Missing keys or equipment', examples: 'second key, spare tire, listed options' },
]

/**
 * What the listing disclosed, by category. A claim in a disclosed category is
 * denied: the buyer was told. Matched on phrases in the damage notes and the
 * inspection report.
 */
const DISCLOSURES: { phrase: string; categories: ClaimCategory[] }[] = [
  { phrase: 'transmission', categories: ['mechanical'] },
  { phrase: 'brake', categories: ['mechanical'] },
  { phrase: 'check engine', categories: ['mechanical'] },
  { phrase: 'ac compressor', categories: ['mechanical'] },
  { phrase: 'mechanical inspection recommended', categories: ['mechanical'] },
  { phrase: 'major mechanical', categories: ['mechanical'] },
  { phrase: 'not roadworthy', categories: ['mechanical', 'structural'] },
  { phrase: 'electrical', categories: ['electrical'] },
  { phrase: 'frame', categories: ['structural'] },
  { phrase: 'airbag', categories: ['structural'] },
  { phrase: 'substantial damage', categories: ['structural'] },
  { phrase: 'flood', categories: ['flood', 'electrical'] },
  { phrase: 'water damage', categories: ['flood'] },
  { phrase: 'missing', categories: ['equipment'] },
]

export function isGuaranteed(vehicle: Vehicle): boolean {
  return vehicle.title_status === 'clean'
}

/** Every damage note and report sentence that disclosed this category. Empty if none. */
export function disclosuresFor(vehicle: Vehicle, category: ClaimCategory): string[] {
  const sources = [...vehicle.damage_notes, ...vehicle.condition_report.split(/(?<=\.)\s+/)]
  return sources.filter((text) => {
    const lower = text.toLowerCase()
    return DISCLOSURES.some((d) => d.categories.includes(category) && lower.includes(d.phrase))
  })
}

/** When the buyer can no longer file claims on a lot they won. */
export function claimWindowEndsAt(lot: LotState): number {
  return endedAt(lot) + GUARANTEE.windowMs
}

export type ClaimStatus = 'review' | 'approved' | 'denied'

export interface Claim {
  id: string
  lot: string
  category: ClaimCategory
  description: string
  estimate: number
  filedAt: number
  /** When the review finishes and the decision is shown. */
  decideAt: number
  status: ClaimStatus
  /** Worked out when filed, shown at decideAt. */
  decision: { status: 'approved' | 'denied'; reason: string }
}

export interface ClaimInput {
  category: ClaimCategory
  description: string
  estimate: number
}

export type ClaimRejection =
  | 'not-won'
  | 'as-is'
  | 'window-closed'
  | 'already-claimed'
  | 'missing-description'
  | 'invalid-estimate'

/** Can the buyer file a claim on this lot at all right now? Null means yes. */
export function claimBlocker(vehicle: Vehicle, lot: LotState, now: number): ClaimRejection | null {
  if (buyerStatus(lot, now) !== 'won') return 'not-won'
  if (!isGuaranteed(vehicle)) return 'as-is'
  if (now >= claimWindowEndsAt(lot)) return 'window-closed'
  return null
}

/** The review's outcome. Pure, so it can be tested on its own. */
export function decideClaim(vehicle: Vehicle, input: ClaimInput): Claim['decision'] {
  const disclosed = disclosuresFor(vehicle, input.category)
  if (disclosed.length > 0) {
    return { status: 'denied', reason: `Disclosed in the listing: ${disclosed.map((d) => `“${d}”`).join(', ')}` }
  }
  if (input.estimate < GUARANTEE.minimumEstimate) {
    return { status: 'denied', reason: `The repair estimate is under the $${GUARANTEE.minimumEstimate} minimum.` }
  }
  return {
    status: 'approved',
    reason: `Not disclosed in the listing. The seller pays for the repair, up to your estimate of $${input.estimate.toLocaleString('en-CA')}.`,
  }
}

export type FileClaimResult = { ok: true; claim: Claim } | { ok: false; reason: ClaimRejection }

export function fileClaim(
  vehicle: Vehicle,
  lot: LotState,
  existing: readonly Claim[],
  input: ClaimInput,
  now: number,
  rng: Rng,
): FileClaimResult {
  const blocker = claimBlocker(vehicle, lot, now)
  if (blocker) return { ok: false, reason: blocker }
  if (existing.some((c) => c.lot === lot.lot && c.category === input.category)) return { ok: false, reason: 'already-claimed' }
  if (input.description.trim().length === 0) return { ok: false, reason: 'missing-description' }
  if (!Number.isInteger(input.estimate) || input.estimate <= 0) return { ok: false, reason: 'invalid-estimate' }

  return {
    ok: true,
    claim: {
      id: `${lot.lot}-${input.category}-${now}`,
      lot: lot.lot,
      category: input.category,
      description: input.description.trim(),
      estimate: input.estimate,
      filedAt: now,
      decideAt: now + randInt(rng, ...GUARANTEE.reviewSec) * SECOND,
      status: 'review',
      decision: decideClaim(vehicle, input),
    },
  }
}
