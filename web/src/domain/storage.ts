import { STATE_VERSION, type AuctionState } from './auction'

/**
 * Save and load the auction in localStorage (P9). Storage can be missing or
 * blocked (private mode, disabled site data), so every call is wrapped and the
 * app falls back to in-memory state.
 */

export const STORAGE_KEY = 'the-block:auction'

export function loadAuctionState(): AuctionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuctionState>
    if (parsed.version !== STATE_VERSION || typeof parsed.lots !== 'object') return null
    return parsed as AuctionState
  } catch {
    return null
  }
}

export function saveAuctionState(state: AuctionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable: keep running in memory.
  }
}

export function clearAuctionState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear.
  }
}
