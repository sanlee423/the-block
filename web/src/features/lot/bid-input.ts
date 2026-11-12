import type { BidRejection } from '@/domain/lot'
import { formatPrice } from '@/lib/format'

/**
 * Turn what a buyer typed into a whole-dollar amount (P23).
 * Accepts "$38,000", "38000" and "38 000". Returns null if it isn't a whole number of dollars.
 */
export function parseDollars(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, '')
  if (!/^\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

/** Buyer-facing message for a rejected bid. */
export function bidRejectionMessage(reason: BidRejection, minimum: number): string {
  switch (reason) {
    case 'too-low':
      return `Enter ${formatPrice(minimum)} or more.`
    case 'invalid-amount':
      return 'Enter a whole-dollar amount, like 25000.'
    case 'not-live':
      return 'This auction is not open for bids.'
  }
}
