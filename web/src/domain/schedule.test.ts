import { describe, expect, it } from 'vitest'
import { buildSchedule, DURATION_DAYS, SCHEDULE_MIX } from './schedule'
import { NOW } from './test-helpers'
import { DAY, HOUR, MINUTE } from './time'
import { vehicles } from './vehicles'

describe('buildSchedule (P1, P11)', () => {
  const schedule = buildSchedule(vehicles, NOW)
  const entries = vehicles.map((v) => ({ v, ...schedule.get(v.lot)! }))

  it('schedules every lot', () => {
    expect(schedule.size).toBe(vehicles.length)
  })

  it('gives every lot a 3, 5 or 7 day run', () => {
    const allowed = DURATION_DAYS.map((d) => d * DAY)
    for (const e of entries) expect(allowed).toContain(e.endsAt - e.startsAt)
  })

  it('stages the expected mix of states', () => {
    const ended = entries.filter((e) => e.endsAt <= NOW)
    const upcoming = entries.filter((e) => e.startsAt > NOW)
    const endingSoon = entries.filter((e) => e.endsAt > NOW && e.endsAt <= NOW + HOUR)
    expect(ended).toHaveLength(SCHEDULE_MIX.ended)
    expect(upcoming).toHaveLength(SCHEDULE_MIX.startingSoon)
    expect(endingSoon).toHaveLength(SCHEDULE_MIX.endingSoon)
  })

  it('starts upcoming lots within the hour, and only lots with no bids', () => {
    for (const e of entries.filter((x) => x.startsAt > NOW)) {
      expect(e.startsAt).toBeGreaterThanOrEqual(NOW + 5 * MINUTE)
      expect(e.startsAt).toBeLessThanOrEqual(NOW + HOUR)
      expect(e.v.bid_count).toBe(0)
    }
  })

  it('ends ending-soon lots 5-60 minutes from now', () => {
    for (const e of entries.filter((x) => x.endsAt > NOW && x.endsAt <= NOW + HOUR)) {
      expect(e.endsAt).toBeGreaterThanOrEqual(NOW + 5 * MINUTE)
    }
  })

  it('ends the remaining live lots between 2 hours and 3 days out', () => {
    const live = entries.filter((e) => e.startsAt <= NOW && e.endsAt > NOW + HOUR)
    expect(live.length).toBe(vehicles.length - SCHEDULE_MIX.ended - SCHEDULE_MIX.endingSoon - SCHEDULE_MIX.startingSoon)
    for (const e of live) {
      expect(e.endsAt).toBeGreaterThanOrEqual(NOW + 2 * HOUR)
      expect(e.endsAt).toBeLessThanOrEqual(NOW + 3 * DAY)
    }
  })

  it('is deterministic for the same "now"', () => {
    expect(buildSchedule(vehicles, NOW)).toEqual(schedule)
  })
})
