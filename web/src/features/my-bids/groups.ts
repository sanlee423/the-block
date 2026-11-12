import { buyerStatus, endedAt, phase, type BuyerStatus, type LotState } from '@/domain/lot'
import type { Vehicle } from '@/domain/vehicle'

export interface MyBidItem {
  vehicle: Vehicle
  lot: LotState
}

/** Groups on My bids (P14), in order of urgency: what needs action first. */
export const MY_BID_GROUPS: { status: BuyerStatus; title: string; hint: string }[] = [
  { status: 'outbid', title: 'Outbid', hint: 'Someone else is ahead. Bid again before the auction ends.' },
  { status: 'winning', title: 'Winning', hint: "You're the high bidder. We'll bid for you up to your max." },
  { status: 'won', title: 'Won', hint: 'Auctions you won, including Buy Now purchases.' },
  { status: 'lost', title: 'Didn’t win', hint: 'Ended auctions you bid on but didn’t win.' },
]

/** Lots the buyer has bid on, grouped by status. Live lots end soonest first; ended lots newest first. */
export function groupMyBids(items: readonly MyBidItem[], now: number): Record<BuyerStatus, MyBidItem[]> {
  const groups: Record<BuyerStatus, MyBidItem[]> = { outbid: [], winning: [], won: [], lost: [] }
  for (const item of items) {
    const status = buyerStatus(item.lot, now)
    if (status) groups[status].push(item)
  }
  for (const list of Object.values(groups)) {
    list.sort((a, b) =>
      phase(a.lot, now) === 'ended' ? endedAt(b.lot) - endedAt(a.lot) : a.lot.endsAt - b.lot.endsAt,
    )
  }
  return groups
}
