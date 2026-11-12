import { phase, type LotState } from './lot'
import { MINUTE } from './time'

/**
 * P42: the notification bell. A saved history of things the buyer would want
 * to know about, even if they missed the toast: being outbid, a watched lot
 * about to end, and a seller answering their question.
 */

export const NOTIFY = {
  /** Warn about a watched lot this long before it ends. */
  endingSoonMs: 5 * MINUTE,
  /** Keep only the latest notifications. */
  keep: 50,
} as const

export type Notification = { id: string; lot: string; at: number; read: boolean } & (
  | { kind: 'outbid'; currentBid: number }
  | { kind: 'ending-soon' }
  | { kind: 'answer'; questionId: string }
)

/** Newest first, capped at NOTIFY.keep. */
export function addNotifications(list: readonly Notification[], added: Notification[]): Notification[] {
  if (added.length === 0) return list as Notification[]
  return [...added.reverse(), ...list].slice(0, NOTIFY.keep)
}

/**
 * Watched lots that just came within 5 minutes of ending and haven't been
 * announced yet. Each lot is announced once, even if a late bid extends it.
 */
export function lotsEndingSoon(
  lots: Record<string, LotState>,
  watchlist: readonly string[],
  alreadyNotified: readonly string[],
  now: number,
): string[] {
  return watchlist.filter((id) => {
    const lot = lots[id]
    if (!lot || alreadyNotified.includes(id) || phase(lot, now) !== 'live') return false
    return lot.endsAt - now <= NOTIFY.endingSoonMs
  })
}

export function markRead(list: readonly Notification[], id?: string): Notification[] {
  if (!list.some((n) => !n.read && (id === undefined || n.id === id))) return list as Notification[]
  return list.map((n) => (!n.read && (id === undefined || n.id === id) ? { ...n, read: true } : n))
}
