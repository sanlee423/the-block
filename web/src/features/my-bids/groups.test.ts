import { describe, expect, it } from 'vitest'
import { makeLot, NOW, rivalLeading } from '@/domain/test-helpers'
import { HOUR, MINUTE } from '@/domain/time'
import { vehicles } from '@/domain/vehicles'
import { groupMyBids } from './groups'

const vehicle = vehicles[0]
const item = (lot: ReturnType<typeof makeLot>) => ({ vehicle, lot })

describe('groupMyBids', () => {
  it('groups lots by where the buyer stands and skips lots they never bid on', () => {
    const groups = groupMyBids(
      [
        item(makeLot({ lot: 'W', currentBid: 10_000, leader: 'you', leaderMax: 12_000, yourMax: 12_000 })),
        item(rivalLeading(40_000, { lot: 'O', yourMax: 36_000 })),
        item(makeLot({ lot: 'V', endsAt: NOW - MINUTE, currentBid: 10_000, leader: 'you', leaderMax: 11_000, yourMax: 11_000 })),
        item(rivalLeading(40_000, { lot: 'L', endsAt: NOW - MINUTE, yourMax: 36_000 })),
        item(rivalLeading(40_000, { lot: 'N' })),
      ],
      NOW,
    )
    const lots = (k: keyof typeof groups) => groups[k].map((i) => i.lot.lot)
    expect(lots('winning')).toEqual(['W'])
    expect(lots('outbid')).toEqual(['O'])
    expect(lots('won')).toEqual(['V'])
    expect(lots('lost')).toEqual(['L'])
  })

  it('sorts live lots by soonest end', () => {
    const groups = groupMyBids(
      [
        item(rivalLeading(40_000, { lot: 'later', yourMax: 36_000, endsAt: NOW + 5 * HOUR })),
        item(rivalLeading(40_000, { lot: 'sooner', yourMax: 36_000, endsAt: NOW + HOUR })),
      ],
      NOW,
    )
    expect(groups.outbid.map((i) => i.lot.lot)).toEqual(['sooner', 'later'])
  })
})
