import { hashString } from './random'
import { DAY, HOUR, MINUTE } from './time'
import type { Vehicle } from './vehicle'

/**
 * Auction schedule (P1, P11).
 *
 * The dataset only has synthetic start dates, so we build a schedule relative to
 * "now": eBay-style multi-day auctions, staged so a demo always shows every state.
 * Lots keep their original order: earlier dataset starts end earlier.
 */

export interface LotSchedule {
  startsAt: number
  endsAt: number
}

/** Each lot runs 3, 5 or 7 days, picked from its id so it never changes. */
export const DURATION_DAYS = [3, 5, 7] as const

/** How many lots go in each staged group. Everything else is mid-auction. */
export const SCHEDULE_MIX = {
  /** Already finished, over the last 2 days. */
  ended: 20,
  /** End 5-60 minutes from now, so closing can be shown in a demo. */
  endingSoon: 8,
  /** Start 5-60 minutes from now. Picked from lots with no bids yet. */
  startingSoon: 8,
} as const

export function durationFor(vehicle: Vehicle): number {
  return DURATION_DAYS[hashString(vehicle.id) % DURATION_DAYS.length] * DAY
}

export function buildSchedule(vehicles: readonly Vehicle[], now: number): Map<string, LotSchedule> {
  const byOriginalStart = [...vehicles].sort(
    (a, b) => a.auction_start.localeCompare(b.auction_start) || a.lot.localeCompare(b.lot),
  )

  // Upcoming lots can't have bids, so take the latest-starting lots that have none.
  const startingSoon = byOriginalStart
    .filter((v) => v.bid_count === 0)
    .slice(-SCHEDULE_MIX.startingSoon)
  const startingSoonLots = new Set(startingSoon.map((v) => v.lot))
  const rest = byOriginalStart.filter((v) => !startingSoonLots.has(v.lot))

  const ended = rest.slice(0, SCHEDULE_MIX.ended)
  const endingSoon = rest.slice(SCHEDULE_MIX.ended, SCHEDULE_MIX.ended + SCHEDULE_MIX.endingSoon)
  const live = rest.slice(SCHEDULE_MIX.ended + SCHEDULE_MIX.endingSoon)

  const schedule = new Map<string, LotSchedule>()
  const byEnd = (v: Vehicle, endsAt: number) => {
    const end = roundToMinute(endsAt)
    schedule.set(v.lot, { startsAt: end - durationFor(v), endsAt: end })
  }

  ended.forEach((v, i) => byEnd(v, now - 2 * DAY + spread(i, ended.length) * (2 * DAY - 10 * MINUTE)))
  endingSoon.forEach((v, i) => byEnd(v, now + 5 * MINUTE + spread(i, endingSoon.length) * 55 * MINUTE))
  // Live lots end between 2 hours and 3 days out: clear of the ending-soon group,
  // and 3 days is the shortest duration, so every one of them has already started.
  live.forEach((v, i) => byEnd(v, now + 2 * HOUR + spread(i, live.length) * (3 * DAY - 3 * HOUR)))
  startingSoon.forEach((v, i) => {
    const start = roundToMinute(now + 5 * MINUTE + spread(i, startingSoon.length) * 55 * MINUTE)
    schedule.set(v.lot, { startsAt: start, endsAt: start + durationFor(v) })
  })

  return schedule
}

/** Position of item i in a group of n, from 0 to 1. */
function spread(i: number, n: number): number {
  return n <= 1 ? 0 : i / (n - 1)
}

function roundToMinute(t: number): number {
  return Math.ceil(t / MINUTE) * MINUTE
}
