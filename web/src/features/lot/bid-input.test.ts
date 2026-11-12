import { describe, expect, it } from 'vitest'
import { bidRejectionMessage, parseDollars } from './bid-input'

describe('parseDollars', () => {
  it.each([
    ['38000', 38_000],
    ['$38,000', 38_000],
    [' 38 000 ', 38_000],
    ['35150', 35_150],
  ])('reads %j as %d', (input, expected) => {
    expect(parseDollars(input)).toBe(expected)
  })

  it.each(['', 'abc', '38000.50', '-5', '0', '1e5'])('rejects %j', (input) => {
    expect(parseDollars(input)).toBeNull()
  })
})

describe('bidRejectionMessage', () => {
  it('tells the buyer the minimum', () => {
    expect(bidRejectionMessage('too-low', 35_001)).toBe('Enter $35,001 or more.')
  })
})
