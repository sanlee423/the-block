import { useSyncExternalStore } from 'react'
import {
  askSeller,
  buyNowLot,
  deleteQuestion,
  markNotificationsRead,
  createAuctionState,
  fileBuyerClaim,
  placeBuyerBid,
  setDeliverTo,
  tick,
  toggleWatch,
  type AuctionEvent,
  type AuctionState,
} from '@/domain/auction'
import type { Province } from '@/domain/fees'
import type { Claim, ClaimInput, FileClaimResult } from '@/domain/guarantee'
import type { BidResult, BuyNowResult, LotState } from '@/domain/lot'
import type { Notification } from '@/domain/notifications'
import type { AskResult, Question } from '@/domain/questions'
import { clearAuctionState, loadAuctionState, saveAuctionState, STORAGE_KEY } from '@/domain/storage'
import { vehicles, vehiclesByLot } from '@/domain/vehicles'

/**
 * The single source of auction state for the UI. Wraps the pure domain
 * functions (T8) with a 1-second clock, localStorage (P9) and an event feed
 * for toasts (P16). Components read it through the hooks at the bottom.
 */

const rng = Math.random

let state: AuctionState = loadAuctionState() ?? createAndSave()
let now = Date.now()

/** Save a fresh state right away, so a reload keeps the same schedule (P1). */
function createAndSave(): AuctionState {
  const fresh = createAuctionState(vehicles, Date.now(), rng)
  saveAuctionState(fresh)
  return fresh
}

const stateListeners = new Set<() => void>()
const clockListeners = new Set<() => void>()
const eventListeners = new Set<(event: AuctionEvent) => void>()

function setState(next: AuctionState) {
  if (next === state) return
  state = next
  saveAuctionState(state)
  stateListeners.forEach((l) => l())
}

// One interval drives both the countdowns and the rival simulation.
// It only runs while something on screen is subscribed.
let timer: ReturnType<typeof setInterval> | null = null

function step() {
  now = Date.now()
  const result = tick(state, now, rng)
  setState(result.state)
  clockListeners.forEach((l) => l())
  result.events.forEach((e) => eventListeners.forEach((l) => l(e)))
}

function ensureTimer() {
  const needed = stateListeners.size + clockListeners.size + eventListeners.size > 0
  if (needed && timer === null) {
    // First step on the next task, not now: subscribing happens while React is
    // still mounting, and the outbid toast listener (in the layout) attaches last.
    // Stepping now would fire rival bids that came due while the app was closed
    // before anyone is listening, and those outbid toasts would be lost.
    setTimeout(step, 0)
    timer = setInterval(step, 1000)
  } else if (!needed && timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function subscribeTo<T>(set: Set<T>, listener: T) {
  set.add(listener)
  ensureTimer()
  return () => {
    set.delete(listener)
    ensureTimer()
  }
}

// Keep other open tabs in sync with bids placed here.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    const loaded = loadAuctionState()
    if (loaded) {
      state = loaded
      stateListeners.forEach((l) => l())
    }
  })
}

export const auction = {
  getState: () => state,
  getNow: () => now,

  placeBid(lot: string, max: number): BidResult {
    const result = placeBuyerBid(state, lot, max, Date.now(), rng)
    setState(result.state)
    return result.result
  },

  buyNow(lot: string): BuyNowResult {
    const result = buyNowLot(state, lot, Date.now())
    setState(result.state)
    return result.result
  },

  toggleWatch(lot: string) {
    setState(toggleWatch(state, lot))
  },

  fileClaim(lot: string, input: ClaimInput): FileClaimResult {
    const vehicle = vehiclesByLot.get(lot)
    if (!vehicle) throw new Error(`Unknown lot: ${lot}`)
    const result = fileBuyerClaim(state, vehicle, input, Date.now(), rng)
    setState(result.state)
    return result.result
  },

  ask(lot: string, text: string): AskResult {
    const vehicle = vehiclesByLot.get(lot)
    if (!vehicle) throw new Error(`Unknown lot: ${lot}`)
    const result = askSeller(state, vehicle, text, Date.now(), rng)
    setState(result.state)
    return result.result
  },

  deleteQuestion(id: string) {
    setState(deleteQuestion(state, id))
  },

  /** Mark one notification read, or all of them (P42). */
  markRead(id?: string) {
    setState(markNotificationsRead(state, id))
  },

  setDeliverTo(province: Province) {
    setState(setDeliverTo(state, province))
  },

  /** "Reset demo" (P9): new schedule from now, no buyer bids, empty watchlist. */
  reset() {
    clearAuctionState()
    setState(createAuctionState(vehicles, Date.now(), rng))
    step()
  },

  subscribe: (listener: () => void) => subscribeTo(stateListeners, listener),
  subscribeClock: (listener: () => void) => subscribeTo(clockListeners, listener),
  onEvent: (listener: (event: AuctionEvent) => void) => subscribeTo(eventListeners, listener),
}

/** The whole auction state. Re-renders when anything changes. */
export function useAuctionState(): AuctionState {
  return useSyncExternalStore(auction.subscribe, auction.getState)
}

/** One lot's state. Only re-renders when that lot changes. */
export function useLot(lot: string): LotState | undefined {
  return useSyncExternalStore(auction.subscribe, () => state.lots[lot])
}

export function useWatchlist(): string[] {
  return useSyncExternalStore(auction.subscribe, () => state.watchlist)
}

/** Current time, updated every second. For countdowns. */
export function useNow(): number {
  return useSyncExternalStore(auction.subscribeClock, auction.getNow)
}

/** The buyer's delivery province for transport estimates (P39). */
export function useDeliverTo(): Province {
  return useSyncExternalStore(auction.subscribe, () => state.deliverTo)
}

/** All Block Guarantee claims (P35). */
export function useClaims(): Claim[] {
  return useSyncExternalStore(auction.subscribe, () => state.claims)
}

/** The buyer's own questions to sellers (P40). */
export function useQuestions(): Question[] {
  return useSyncExternalStore(auction.subscribe, () => state.questions)
}

/** When this demo's schedule was made. Seeded questions are dated before it. */
export function useDemoStart(): number {
  return useSyncExternalStore(auction.subscribe, () => state.createdAt)
}

/** The bell's history, newest first (P42). */
export function useNotifications(): Notification[] {
  return useSyncExternalStore(auction.subscribe, () => state.notifications)
}
