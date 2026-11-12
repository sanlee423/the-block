import { randInt, seededRng, hashString, type Rng } from './random'
import type { Vehicle } from './vehicle'

/**
 * P34: Engine & diagnostics. The dataset has no fault codes or engine
 * recordings, so this generates them from the car's own data, so they agree
 * with the rest of the page:
 *
 * - damage notes map to matching codes ("catalytic converter code" → P0420);
 * - the grade sets how many extra codes appear;
 * - a report that says the car is mechanically sound only gets harmless extras;
 * - electric cars get battery codes and no engine sound check.
 *
 * Seeded by the vehicle id, so a car shows the same result on every load.
 * The UI labels all of it as demo data.
 */

export type Severity = 'serious' | 'monitor' | 'info'

export interface FaultCode {
  code: string
  title: string
  /** What it means for a buyer, in plain words. */
  explanation: string
  severity: Severity
  /** The damage note this code comes from, if any. */
  fromNote?: string
}

type CodeDef = Omit<FaultCode, 'fromNote'>

/** Damage notes (matched by a phrase, case-insensitive) and the codes they imply. */
const NOTE_CODES: { match: string; codes: CodeDef[] }[] = [
  {
    match: 'catalytic converter',
    codes: [
      {
        code: 'P0420',
        title: 'Catalyst efficiency below threshold (bank 1)',
        explanation:
          "The catalytic converter isn't cleaning the exhaust as well as it should. Often a worn converter or an oxygen sensor. Can fail an emissions test.",
        severity: 'monitor',
      },
    ],
  },
  {
    match: 'transmission slips',
    codes: [
      {
        code: 'P0700',
        title: 'Transmission control system fault',
        explanation: 'The transmission computer has logged a fault. Matches the slipping noted by the inspector.',
        severity: 'serious',
      },
      {
        code: 'P0732',
        title: 'Gear 2 incorrect ratio',
        explanation: 'Second gear is slipping. Usually worn clutches inside the transmission, which can mean a rebuild.',
        severity: 'serious',
      },
    ],
  },
  {
    match: 'flood damage',
    codes: [
      {
        code: 'U0100',
        title: 'Lost communication with engine control module',
        explanation: 'Modules on the car network stopped talking to each other. Common after water reaches wiring and connectors.',
        severity: 'serious',
      },
      {
        code: 'U0140',
        title: 'Lost communication with body control module',
        explanation: 'The module that runs lights, locks and windows dropped off the network. Points to water-damaged wiring.',
        severity: 'serious',
      },
    ],
  },
  {
    match: 'airbag deployed',
    codes: [
      {
        code: 'B0001',
        title: 'Driver frontal airbag deployment (history)',
        explanation: 'Stored from the deployment noted in the damage notes. The system reports no current fault.',
        severity: 'info',
      },
    ],
  },
  {
    match: 'ac compressor',
    codes: [
      {
        code: 'P0645',
        title: 'A/C clutch relay control circuit',
        explanation: 'The A/C compressor clutch circuit has an intermittent fault. Matches the A/C problem in the damage notes.',
        severity: 'monitor',
      },
    ],
  },
]

/** Extra codes a car may have, by how bad they are. */
const EXTRA_CODES: Record<'gas' | 'diesel' | 'electric', Record<Severity, CodeDef[]>> = {
  gas: {
    info: [
      { code: 'P0457', title: 'EVAP leak: fuel cap loose', explanation: 'Usually just a loose or worn fuel cap. Cheap fix.', severity: 'info' },
      { code: 'P0507', title: 'Idle speed higher than expected', explanation: 'Idle runs a little high. Often a dirty throttle body.', severity: 'info' },
      { code: 'P0562', title: 'System voltage low (stored)', explanation: 'Logged once when the battery ran low, for example while the car sat on the lot.', severity: 'info' },
    ],
    monitor: [
      { code: 'P0128', title: 'Coolant below thermostat temperature', explanation: 'The engine warms up slowly. Usually a stuck-open thermostat. Inexpensive repair.', severity: 'monitor' },
      { code: 'P0171', title: 'System too lean (bank 1)', explanation: 'Too much air for the fuel. Often a vacuum leak or a dirty airflow sensor.', severity: 'monitor' },
      { code: 'P0442', title: 'EVAP system small leak', explanation: 'A small leak in the fuel vapour system. No driving symptoms, but it keeps the check engine light on.', severity: 'monitor' },
      { code: 'P0135', title: 'Oxygen sensor heater circuit (bank 1, sensor 1)', explanation: 'An oxygen sensor needs replacing. Affects fuel economy and emissions.', severity: 'monitor' },
    ],
    serious: [
      { code: 'P0300', title: 'Random or multiple cylinder misfire', explanation: 'The engine is misfiring. Could be plugs or coils, or something deeper. Have it checked before buying.', severity: 'serious' },
      { code: 'P0016', title: 'Crankshaft and camshaft position out of sync', explanation: 'Engine timing is off. Often a stretched timing chain, which is an expensive repair.', severity: 'serious' },
      { code: 'P0301', title: 'Cylinder 1 misfire', explanation: 'One cylinder is misfiring. Could be a coil or injector, or low compression.', severity: 'serious' },
    ],
  },
  diesel: {
    info: [
      { code: 'P0562', title: 'System voltage low (stored)', explanation: 'Logged once when the battery ran low, for example while the car sat on the lot.', severity: 'info' },
    ],
    monitor: [
      { code: 'P2002', title: 'Diesel particulate filter efficiency below threshold', explanation: 'The soot filter is clogged or worn. A forced clean may fix it; replacement is costly.', severity: 'monitor' },
      { code: 'P0401', title: 'EGR flow insufficient', explanation: 'The exhaust recirculation valve is sticking or clogged with soot. Common on diesels.', severity: 'monitor' },
    ],
    serious: [
      { code: 'P0300', title: 'Random or multiple cylinder misfire', explanation: 'The engine is misfiring, often an injector problem on a diesel. Have it checked before buying.', severity: 'serious' },
      { code: 'P0087', title: 'Fuel rail pressure too low', explanation: 'The high-pressure fuel system is weak. Could be a filter, or a failing high-pressure pump.', severity: 'serious' },
    ],
  },
  electric: {
    info: [
      { code: 'P0562', title: '12 V system voltage low (stored)', explanation: 'The small 12-volt battery ran low once. Common on EVs that sit unused.', severity: 'info' },
    ],
    monitor: [
      { code: 'P0AFA', title: 'High-voltage battery voltage low', explanation: 'The main battery pack read low. Check its state of health and charge history.', severity: 'monitor' },
      { code: 'U0111', title: 'Lost communication with battery control module', explanation: 'The battery computer dropped off the network briefly. Often a connector or software update.', severity: 'monitor' },
    ],
    serious: [
      { code: 'P0AA6', title: 'High-voltage isolation fault', explanation: 'High voltage may be leaking to the chassis. A safety issue that needs a specialist.', severity: 'serious' },
    ],
  },
}

/** Report phrases that say the engine is fine. Extras stay harmless for these cars. */
const SOUND_REPORTS = [
  'mechanically sound',
  'no mechanical issues',
  'all mechanical systems functioning properly',
  'engine and transmission perform within normal parameters',
  'no major mechanical concerns',
  'runs and drives without issue',
  'drives well',
]

/** Report phrases that point to mechanical trouble. These cars get more codes. */
const TROUBLE_REPORTS = [
  'mechanical inspection recommended',
  'not roadworthy',
  'major mechanical',
  'several repairs recommended',
  'immediate maintenance',
]

export type SoundVerdict = 'normal' | 'minor' | 'attention' | 'not-applicable'

export interface SoundFinding {
  /** Where on the recording, in seconds. */
  start: number
  end: number
  label: string
  severity: Severity
}

export interface EngineSound {
  verdict: SoundVerdict
  findings: SoundFinding[]
  /** Waveform envelope, 0-1, evenly spaced over RECORDING_SECONDS. Empty for EVs. */
  samples: number[]
}

export interface Diagnostics {
  codes: FaultCode[]
  sound: EngineSound
}

export const RECORDING_SECONDS = 30
/** Cold start, then idle, then a rev, in seconds. */
export const RECORDING_PHASES = [
  { label: 'Cold start', start: 0, end: 5 },
  { label: 'Idle', start: 5, end: 20 },
  { label: 'Rev', start: 20, end: 30 },
] as const
const SAMPLE_COUNT = 120

export function diagnose(vehicle: Vehicle): Diagnostics {
  const rng = seededRng(hashString(`diagnostics:${vehicle.id}`))
  const codes = faultCodes(vehicle, rng)
  return { codes, sound: engineSound(vehicle, codes, rng) }
}

function powertrain(vehicle: Vehicle): 'gas' | 'diesel' | 'electric' {
  if (vehicle.fuel_type === 'electric') return 'electric'
  return vehicle.fuel_type === 'diesel' ? 'diesel' : 'gas'
}

function reportSays(vehicle: Vehicle, phrases: string[]): boolean {
  const report = vehicle.condition_report.toLowerCase()
  return phrases.some((p) => report.includes(p))
}

function faultCodes(vehicle: Vehicle, rng: Rng): FaultCode[] {
  const codes: FaultCode[] = []
  const add = (def: CodeDef, fromNote?: string) => {
    if (!codes.some((c) => c.code === def.code)) codes.push(fromNote ? { ...def, fromNote } : { ...def })
  }

  // 1. Codes the damage notes already imply. EVs have no catalytic converter or gearbox codes.
  if (powertrain(vehicle) !== 'electric') {
    for (const note of vehicle.damage_notes) {
      const lower = note.toLowerCase()
      for (const rule of NOTE_CODES) if (lower.includes(rule.match)) rule.codes.forEach((c) => add(c, note))
    }
  }

  // 2. Extra codes, more of them (and worse) as the grade drops.
  const g = vehicle.condition_grade
  const trouble = reportSays(vehicle, TROUBLE_REPORTS)
  const sound = reportSays(vehicle, SOUND_REPORTS)
  let count: number
  let allowed: Severity[]
  if (g >= 4.5) [count, allowed] = [0, []]
  else if (g >= 3.5) [count, allowed] = [randInt(rng, 0, 1), ['info']]
  else if (g >= 2.5) [count, allowed] = [randInt(rng, 0, 2), ['info', 'monitor']]
  else [count, allowed] = [randInt(rng, 2, 4), ['info', 'monitor', 'serious']]
  if (trouble) count = Math.min(count + 1, 4)
  // A report that calls the car mechanically sound can't sit next to a misfire.
  if (sound) allowed = allowed.filter((s) => s === 'info')

  const pool = EXTRA_CODES[powertrain(vehicle)]
  for (let i = 0; i < count && allowed.length > 0; i++) {
    const severity = allowed[Math.floor(rng() * allowed.length)]
    const options = pool[severity].filter((c) => !codes.some((x) => x.code === c.code))
    if (options.length > 0) add(options[Math.floor(rng() * options.length)])
  }

  const order: Record<Severity, number> = { serious: 0, monitor: 1, info: 2 }
  return codes.sort((a, b) => order[a.severity] - order[b.severity])
}

/** Sounds the analysis can flag, with where on the recording they show up. */
const MINOR_SOUNDS: Omit<SoundFinding, 'severity'>[] = [
  { start: 1, end: 4, label: 'Lifter tick at cold start, fades as oil warms' },
  { start: 0, end: 2, label: 'Brief belt squeal on start-up' },
  { start: 9, end: 13, label: 'Faint exhaust tick at idle, possible small leak' },
  { start: 14, end: 17, label: 'Idle speed hunts slightly for a few seconds' },
]
const SERIOUS_SOUNDS: Omit<SoundFinding, 'severity'>[] = [
  { start: 22, end: 26, label: 'Knock under load when revving' },
  { start: 1, end: 4, label: 'Rattle from the timing chain area at start-up' },
]
const MISFIRE_SOUND: Omit<SoundFinding, 'severity'> = { start: 7, end: 12, label: 'Uneven idle rhythm, consistent with a misfire' }

function engineSound(vehicle: Vehicle, codes: FaultCode[], rng: Rng): EngineSound {
  if (powertrain(vehicle) === 'electric') return { verdict: 'not-applicable', findings: [], samples: [] }

  const g = vehicle.condition_grade
  const misfire = codes.some((c) => c.code === 'P0300' || c.code === 'P0301')
  // Only engine codes are audible. Codes from damage notes (transmission, flood
  // wiring) are real problems but don't change how the engine sounds.
  const serious = codes.some((c) => c.severity === 'serious' && !c.fromNote)
  const findings: SoundFinding[] = []
  const pick = (from: Omit<SoundFinding, 'severity'>[], severity: Severity) => {
    const options = from.filter((f) => !findings.some((x) => x.label === f.label || overlaps(x, f)))
    if (options.length > 0) findings.push({ ...options[Math.floor(rng() * options.length)], severity })
  }

  let verdict: SoundVerdict
  if (serious || g < 2) {
    verdict = 'attention'
    if (misfire) findings.push({ ...MISFIRE_SOUND, severity: 'serious' })
    else pick(SERIOUS_SOUNDS, 'serious')
    pick(MINOR_SOUNDS, 'monitor')
  } else if (g < 3.5 || codes.some((c) => c.severity === 'monitor')) {
    verdict = 'minor'
    const n = randInt(rng, 1, 2)
    for (let i = 0; i < n; i++) pick(MINOR_SOUNDS, 'monitor')
  } else {
    verdict = 'normal'
  }

  findings.sort((a, b) => a.start - b.start)
  return { verdict, findings, samples: waveform(findings, rng) }
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * A believable amplitude envelope: a burst at start-up that settles, a low
 * steady idle, then a rev that swells and falls. Flagged moments get spikes.
 */
function waveform(findings: SoundFinding[], rng: Rng): number[] {
  const samples: number[] = []
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = (i / SAMPLE_COUNT) * RECORDING_SECONDS
    let base: number
    if (t < 5) base = 0.35 + 0.5 * Math.exp(-t * 0.9)
    else if (t < 20) base = 0.28
    else base = 0.3 + 0.6 * Math.sin(((t - 20) / 10) * Math.PI)
    let value = base + (rng() - 0.5) * 0.12
    const flagged = findings.find((f) => t >= f.start && t < f.end)
    if (flagged && rng() < 0.5) value += flagged.severity === 'serious' ? 0.35 : 0.2
    samples.push(Math.round(Math.min(1, Math.max(0.05, value)) * 100) / 100)
  }
  return samples
}
