import { describe, expect, it } from 'vitest'
import { askSeller, markNotificationsRead, placeBuyerBid, STATE_VERSION, tick, type AuctionState } from './auction'
import { addNotifications, NOTIFY, type Notification } from './notifications'
import { fixedRng, makeLot, NOW, rivalLeading } from './test-helpers'
import { DAY, MINUTE, SECOND } from './time'
import { vehicles } from './vehicles'

const rng = fixedRng(0) // rivals out-max the buyer

function stateWith(lots: ReturnType<typeof makeLot>[], watchlist: string[] = []): AuctionState {
  return {
    version: STATE_VERSION,
    createdAt: NOW,
    lots: Object.fromEntries(lots.map((l) => [l.lot, l])),
    watchlist,
    pendingRivalBids: [],
    nextBackgroundBidAt: NOW + DAY,
    deliverTo: 'Ontario',
    claims: [],
    questions: [],
    notifications: [],
    endingNotified: [],
  }
}

describe('notifications (P42)', () => {
  it('a rival outbidding the buyer adds an unread outbid notification', () => {
    const bid = placeBuyerBid(stateWith([rivalLeading(35_000)]), 'T-0001', 38_000, NOW, rng).state
    const after = tick(bid, NOW + MINUTE, rng).state
    expect(after.notifications).toEqual([expect.objectContaining({ kind: 'outbid', lot: 'T-0001', read: false, currentBid: 38_100 })])
  })

  it('warns once when a watched lot comes within 5 minutes of ending', () => {
    const lot = makeLot({ endsAt: NOW + 10 * MINUTE })
    let state = stateWith([lot], ['T-0001'])
    state = tick(state, NOW + 4 * MINUTE, rng).state
    expect(state.notifications).toEqual([])

    const due = tick(state, NOW + 5 * MINUTE, rng)
    expect(due.events).toContainEqual({ type: 'ending-soon', lot: 'T-0001', endsAt: NOW + 10 * MINUTE })
    expect(due.state.notifications).toEqual([expect.objectContaining({ kind: 'ending-soon', lot: 'T-0001' })])

    // Still inside the window a second later, or after an extension: no repeat.
    expect(tick(due.state, NOW + 5 * MINUTE + SECOND, rng).state.notifications).toHaveLength(1)
  })

  it("doesn't warn about lots that aren't watched, or have ended", () => {
    const unwatched = makeLot({ lot: 'A', endsAt: NOW + MINUTE })
    const ended = makeLot({ lot: 'B', endsAt: NOW - MINUTE })
    expect(tick(stateWith([unwatched, ended], ['B']), NOW, rng).state.notifications).toEqual([])
  })

  it("a seller's answer adds a notification", () => {
    const asked = askSeller(stateWith([makeLot({ lot: vehicles[0].lot })]), vehicles[0], 'Any rust?', NOW, rng).state
    const answered = tick(asked, NOW + MINUTE, rng).state
    expect(answered.notifications).toEqual([
      expect.objectContaining({ kind: 'answer', questionId: asked.questions[0].id, read: false }),
    ])
  })

  it('marks one or all as read, and returns the same state when nothing changes', () => {
    const n = (id: string): Notification => ({ id, kind: 'ending-soon', lot: 'T-0001', at: NOW, read: false })
    const state = { ...stateWith([makeLot()]), notifications: [n('a'), n('b')] }
    const one = markNotificationsRead(state, 'a')
    expect(one.notifications.map((x) => x.read)).toEqual([true, false])
    const all = markNotificationsRead(one)
    expect(all.notifications.every((x) => x.read)).toBe(true)
    expect(markNotificationsRead(all)).toBe(all)
  })

  it('keeps the newest first, up to the limit', () => {
    const many = Array.from({ length: NOTIFY.keep + 5 }, (_, i): Notification => ({
      id: String(i),
      kind: 'ending-soon',
      lot: 'T',
      at: i,
      read: false,
    }))
    const list = addNotifications([], many)
    expect(list).toHaveLength(NOTIFY.keep)
    expect(list[0].id).toBe(String(NOTIFY.keep + 4))
  })
})
