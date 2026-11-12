import { describe, expect, it } from 'vitest'
import { diagnose, RECORDING_SECONDS } from './diagnostics'
import { gradeBand } from './grade'
import type { Vehicle } from './vehicle'
import { vehicles } from './vehicles'

const base = vehicles.find((v) => v.fuel_type === 'gasoline')!
const car = (overrides: Partial<Vehicle>): Vehicle => ({ ...base, ...overrides })

describe('gradeBand (P33)', () => {
  it.each([
    [5, 'Excellent'],
    [4.5, 'Excellent'],
    [4.4, 'Clean'],
    [3.5, 'Clean'],
    [3.3, 'Average'],
    [2.5, 'Average'],
    [2.4, 'Rough'],
    [1.5, 'Rough'],
    [1.4, 'Poor'],
    [0, 'Poor'],
  ])('%f is %s', (grade, label) => {
    expect(gradeBand(grade).label).toBe(label)
  })
})

describe('diagnose (P34)', () => {
  it('gives the same result every time for a car', () => {
    expect(diagnose(base)).toEqual(diagnose(base))
  })

  it('an excellent car with no damage notes has no codes and a normal engine', () => {
    const d = diagnose(car({ condition_grade: 4.8, damage_notes: [] }))
    expect(d.codes).toEqual([])
    expect(d.sound).toMatchObject({ verdict: 'normal', findings: [] })
  })

  it('turns a damage note into the matching code', () => {
    const note = 'Check engine light - catalytic converter code'
    const d = diagnose(car({ condition_grade: 4.8, damage_notes: [note] }))
    expect(d.codes).toEqual([expect.objectContaining({ code: 'P0420', severity: 'monitor', fromNote: note })])
  })

  it('a slipping transmission gives serious transmission codes but no engine noise of its own', () => {
    const d = diagnose(car({ condition_grade: 4.6, damage_notes: ['Transmission slips between 2nd and 3rd gear'] }))
    expect(d.codes.map((c) => c.code)).toEqual(['P0700', 'P0732'])
    expect(d.sound.verdict).not.toBe('attention')
  })

  it('a report that says the car is mechanically sound only gets harmless extra codes', () => {
    for (let i = 0; i < 30; i++) {
      const d = diagnose(
        car({ id: `sound-${i}`, condition_grade: 1.6, damage_notes: [], condition_report: 'Rough outside. Mechanically sound.' }),
      )
      expect(d.codes.every((c) => c.severity === 'info')).toBe(true)
    }
  })

  it('rough cars get more codes than clean ones across the dataset', () => {
    const avg = (list: Vehicle[]) => list.reduce((n, v) => n + diagnose(v).codes.length, 0) / list.length
    expect(avg(vehicles.filter((v) => v.condition_grade < 2.5))).toBeGreaterThan(
      avg(vehicles.filter((v) => v.condition_grade >= 3.5)) + 1,
    )
  })

  it('electric cars get no engine sound check and no exhaust codes', () => {
    const d = diagnose(car({ fuel_type: 'electric', condition_grade: 2, damage_notes: ['Check engine light - catalytic converter code'] }))
    expect(d.sound).toEqual({ verdict: 'not-applicable', findings: [], samples: [] })
    expect(d.codes.some((c) => c.code === 'P0420')).toBe(false)
  })

  it('holds together for every car in the dataset', () => {
    for (const v of vehicles) {
      const { codes, sound } = diagnose(v)
      if (v.condition_grade >= 4.5) expect(codes.every((c) => c.fromNote)).toBe(true)
      if (sound.verdict === 'normal') expect(sound.findings).toEqual([])
      if (sound.verdict === 'attention') expect(sound.findings.some((f) => f.severity === 'serious')).toBe(true)
      for (const f of sound.findings) expect(f.end).toBeLessThanOrEqual(RECORDING_SECONDS)
      if (v.fuel_type !== 'electric') expect(sound.samples).toHaveLength(120)
    }
  })
})
