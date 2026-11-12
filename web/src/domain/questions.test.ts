import { describe, expect, it } from 'vitest'
import { askSeller, deleteQuestion, STATE_VERSION, tick, type AuctionState } from './auction'
import { diagnose } from './diagnostics'
import { answerQuestion, askQuestion, checkPost, QA, seededQuestions } from './questions'
import { fixedRng, makeLot, NOW } from './test-helpers'
import { DAY, MINUTE, SECOND } from './time'
import type { Vehicle } from './vehicle'
import { vehicles } from './vehicles'

const base = vehicles.find((v) => v.title_status === 'clean')!
const car = (overrides: Partial<Vehicle> = {}): Vehicle => ({
  ...base,
  lot: 'T-0001',
  damage_notes: [],
  condition_report: 'Very clean vehicle inside and out.',
  ...overrides,
})
const rng = fixedRng(0)
const PLACES = ['Calgary, AB', 'Halifax, NS']

describe('posting rules (P40)', () => {
  it('accepts a normal question', () => {
    expect(checkPost('Does it come with winter tires?')).toBeNull()
  })

  it.each([
    ['   ', 'empty'],
    ['x'.repeat(QA.maxLength + 1), 'too-long'],
    ['Text me at 416-555-0123', 'contact-details'],
    ['Call (604) 555 0199 please', 'contact-details'],
    ['Email me: buyer@example.com', 'contact-details'],
    ['Only an idiot would pay this much', 'disrespectful'],
    ['Shut up and lower the price', 'disrespectful'],
  ])('rejects %j as %s', (text, reason) => {
    expect(checkPost(text)).toBe(reason)
  })

  it("doesn't flag a year or a price as a phone number", () => {
    expect(checkPost('Is the 2019 model worth $25,000?')).toBeNull()
  })
})

describe('seller answers come from the car data', () => {
  it('quotes the rust note when there is one, and says none was recorded otherwise', () => {
    const rusty = car({ damage_notes: ['Minor rust on wheel wells'] })
    expect(answerQuestion(rusty, 'Any rust?')).toContain('Minor rust on wheel wells')
    expect(answerQuestion(car(), 'Any rust?')).toContain("didn't record any rust")
  })

  it('lists the same fault codes as the diagnostics section', () => {
    const rough = vehicles.find((v) => diagnose(v).codes.length >= 2)!
    const answer = answerQuestion(rough, 'Is the check engine light on?')
    for (const c of diagnose(rough).codes) expect(answer).toContain(c.code)
  })

  it('explains a salvage title and names the cause', () => {
    const v = car({ title_status: 'salvage', damage_notes: ['Flood damage - electrical issues present'] })
    expect(answerQuestion(v, 'Why is the title salvage?')).toContain('Flood damage')
  })

  it('falls back to a holding answer for topics it knows nothing about', () => {
    expect(answerQuestion(car(), 'What colour are the floor mats?')).toBe("Good question. We'll check and add photos to the listing.")
  })
})

describe('seeded questions', () => {
  it('are the same on every load and come from other buyers by place, never a name', () => {
    const qs = seededQuestions(base, PLACES, NOW)
    expect(seededQuestions(base, PLACES, NOW)).toEqual(qs)
    for (const q of qs) expect(PLACES).toContain(q.author)
  })

  it('have 0-4 questions per car, asked before the demo started, across the dataset', () => {
    let total = 0
    for (const v of vehicles) {
      const qs = seededQuestions(v, PLACES, NOW)
      expect(qs.length).toBeLessThanOrEqual(4)
      for (const q of qs) expect(q.askedAt).toBeLessThan(NOW)
      total += qs.length
    }
    expect(total).toBeGreaterThan(vehicles.length)
  })

  it("only ask about a title when it isn't clean", () => {
    for (const v of vehicles.filter((x) => x.title_status === 'clean')) {
      expect(seededQuestions(v, PLACES, NOW).some((q) => q.text.startsWith('Why is it a'))).toBe(false)
    }
  })
})

describe('asking the seller', () => {
  const state: AuctionState = {
    version: STATE_VERSION,
    createdAt: NOW,
    lots: { 'T-0001': makeLot() },
    watchlist: [],
    pendingRivalBids: [],
    nextBackgroundBidAt: NOW + DAY,
    deliverTo: 'Ontario',
    claims: [],
    questions: [],
    notifications: [],
    endingNotified: [],
  }

  it('saves the question, hides the answer until it is due, then fires an event', () => {
    const asked = askSeller(state, car(), 'Any rust underneath?', NOW, rng).state
    const q = asked.questions[0]
    expect(q).toMatchObject({ author: 'you', answered: false, answerAt: NOW + 10 * SECOND })

    expect(tick(asked, NOW + 9 * SECOND, rng).state.questions[0].answered).toBe(false)
    const later = tick(asked, NOW + 10 * SECOND, rng)
    expect(later.state.questions[0].answered).toBe(true)
    expect(later.events).toContainEqual({ type: 'question-answered', lot: 'T-0001', questionId: q.id })
  })

  it('refuses a post that breaks the rules and saves nothing', () => {
    const result = askSeller(state, car(), 'you moron', NOW, rng)
    expect(result.result).toEqual({ ok: false, reason: 'disrespectful' })
    expect(result.state).toBe(state)
  })

  it('lets the buyer delete their question', () => {
    const asked = askSeller(state, car(), 'Any rust?', NOW, rng).state
    expect(deleteQuestion(asked, asked.questions[0].id).questions).toEqual([])
  })

  it('closes questions once the auction has ended, including a Buy Now sale', () => {
    const ended = { ...state, lots: { 'T-0001': makeLot({ endsAt: NOW - SECOND }) } }
    expect(askSeller(ended, car(), 'Any rust?', NOW, rng).result).toEqual({ ok: false, reason: 'auction-ended' })
    const bought = { ...state, lots: { 'T-0001': makeLot({ closedAt: NOW - SECOND }) } }
    expect(askSeller(bought, car(), 'Any rust?', NOW, rng).result).toEqual({ ok: false, reason: 'auction-ended' })
  })

  it('stays open before an auction starts', () => {
    const upcoming = { ...state, lots: { 'T-0001': makeLot({ startsAt: NOW + DAY, endsAt: NOW + 3 * DAY }) } }
    expect(askSeller(upcoming, car(), 'Any rust?', NOW, rng).result.ok).toBe(true)
  })

  it('still answers a question asked just before the end', () => {
    const closing = { ...state, lots: { 'T-0001': makeLot({ endsAt: NOW + SECOND }) } }
    const asked = askSeller(closing, car(), 'Any rust?', NOW, rng).state
    expect(tick(asked, NOW + MINUTE, rng).state.questions[0].answered).toBe(true)
  })

  it('trims the text', () => {
    const result = askQuestion(car(), '  Any rust?  ', NOW, rng)
    expect(result.ok && result.question.text).toBe('Any rust?')
  })
})
