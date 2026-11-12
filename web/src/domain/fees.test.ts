import { describe, expect, it } from 'vitest'
import { allInPrice, buyerFee, roadKm, transportEstimate } from './fees'

describe('buyerFee (P39)', () => {
  it.each([
    [5_000, 300],
    [9_999, 300],
    [10_000, 450],
    [24_999, 450],
    [25_000, 600],
    [50_000, 800],
    [120_000, 800],
  ])('$%i pays a $%i fee', (price, fee) => {
    expect(buyerFee(price)).toBe(fee)
  })
})

describe('transportEstimate (P39)', () => {
  it('is the flat local price within one province', () => {
    expect(transportEstimate('Ontario', 'Ontario')).toBe(250)
  })

  it('grows with distance and rounds to $25', () => {
    const toMontreal = transportEstimate('Ontario', 'Quebec')
    const toVancouver = transportEstimate('Ontario', 'British Columbia')
    expect(toMontreal).toBeGreaterThan(250)
    expect(toVancouver).toBeGreaterThan(toMontreal)
    expect(toVancouver % 25).toBe(0)
  })

  it('is the same both ways', () => {
    expect(roadKm('Alberta', 'Nova Scotia')).toBe(roadKm('Nova Scotia', 'Alberta'))
  })

  it('treats an unknown province as local', () => {
    expect(transportEstimate('Nowhere', 'Ontario')).toBe(250)
  })
})

describe('allInPrice', () => {
  it('adds the fee and transport to the price', () => {
    expect(allInPrice(20_000, 'Ontario', 'Ontario')).toEqual({ price: 20_000, fee: 450, transport: 250, total: 20_700 })
  })
})
