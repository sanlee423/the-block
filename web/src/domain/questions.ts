import { diagnose } from './diagnostics'
import { hashString, randInt, seededRng, type Rng } from './random'
import { HOUR, MINUTE, SECOND } from './time'
import type { Vehicle } from './vehicle'

/**
 * P40: questions and answers on each lot, like Bring a Trailer's comments.
 *
 * Seeded questions from "other buyers" are generated per car and never stored.
 * The buyer's own questions are saved, and the seller answers after a short
 * delay. Every answer is written from the car's real data (damage notes,
 * report, title, diagnostics), so it never says something the listing doesn't.
 */

export const QA = {
  maxLength: 500,
  /** The seller answers the buyer's question after 10-30 s (sped up for the demo). */
  answerDelaySec: [10, 30],
  /** Seeded questions per car. */
  seeded: [0, 4],
  /** Share of seeded questions the seller has answered. */
  answeredShare: 0.8,
} as const

const has = (v: Vehicle, phrase: string) =>
  v.damage_notes.some((n) => n.toLowerCase().includes(phrase)) || v.condition_report.toLowerCase().includes(phrase)
const note = (v: Vehicle, phrase: string) => v.damage_notes.find((n) => n.toLowerCase().includes(phrase))

interface Topic {
  id: string
  /** Words in a buyer's question that point to this topic. */
  keywords: string[]
  /** A question another buyer might ask. Null if it doesn't fit this car. */
  question: (v: Vehicle) => string | null
  answer: (v: Vehicle) => string
}

const TOPICS: Topic[] = [
  {
    id: 'rust',
    keywords: ['rust', 'corrosion', 'underbody', 'undercarriage', 'winter'],
    question: () => 'Any rust underneath? I need it to get through a few winters.',
    answer: (v) =>
      has(v, 'rust')
        ? `Yes, the inspector noted it: “${note(v, 'rust')}”. Nothing else rust-related was recorded, but we'd suggest a look on a hoist.`
        : "The inspector didn't record any rust. Everything they found is in the damage notes.",
  },
  {
    id: 'accident',
    keywords: ['accident', 'crash', 'collision', 'frame', 'airbag', 'structural'],
    question: (v) => (v.title_status === 'clean' && v.condition_grade >= 3 ? 'Has it ever been in an accident?' : null),
    answer: (v) => {
      const structural = note(v, 'frame') ?? note(v, 'airbag')
      if (structural) return `Yes: “${structural}”. It's in the damage notes.`
      return v.title_status === 'clean'
        ? "Nothing structural turned up in the inspection, and it has a clean title. Cosmetic items are listed in the damage notes."
        : `It has a ${v.title_status} title, so it was declared a total loss at some point. The damage notes list what the inspector found.`
    },
  },
  {
    id: 'title',
    keywords: ['title', 'salvage', 'rebuilt', 'total loss', 'insurance'],
    question: (v) => (v.title_status !== 'clean' ? `Why is it a ${v.title_status} title?` : null),
    answer: (v) => {
      if (v.title_status === 'clean') return "It's a clean title. It's never been declared a total loss."
      const cause = note(v, 'flood') ?? note(v, 'frame') ?? note(v, 'airbag')
      const base =
        v.title_status === 'rebuilt'
          ? 'It was declared a total loss, then repaired and passed a provincial inspection.'
          : 'An insurer declared it a total loss. It needs repairs and an inspection before it can be registered.'
      return cause ? `${base} The listed damage includes “${cause}”.` : base
    },
  },
  {
    id: 'codes',
    keywords: ['check engine', 'engine light', 'warning light', 'code', 'scan', 'obd', 'misfire'],
    question: (v) => (v.fuel_type === 'electric' ? 'Any warning lights on the dash?' : 'Is the check engine light on?'),
    answer: (v) => {
      const codes = diagnose(v).codes
      if (codes.length === 0) return 'No codes were stored when we scanned it.'
      const list = codes.map((c) => c.code).join(', ')
      return `The scan found ${codes.length === 1 ? 'one code' : `${codes.length} codes`}: ${list}. Each one is explained under Engine & diagnostics.`
    },
  },
  {
    id: 'service',
    keywords: ['service', 'records', 'maintenance', 'history', 'oil change'],
    question: () => 'Do you have the service records?',
    answer: (v) => {
      if (has(v, 'full service history')) return 'Yes, the full service history is available. It comes with the car.'
      if (has(v, 'recently serviced')) return 'It was recently serviced and has new tires. We can share the invoice.'
      return "We don't have service records for this one, sorry."
    },
  },
  {
    id: 'tires-brakes',
    keywords: ['tire', 'tyre', 'brake', 'rotor', 'pads'],
    question: () => 'How are the tires and brakes?',
    answer: (v) => {
      const brakes = note(v, 'brake')
      if (brakes) return `The brakes need work: “${brakes}”.`
      if (has(v, 'new tires')) return "It has new tires, and the inspector didn't flag the brakes."
      return "The inspector didn't flag the tires or the brakes."
    },
  },
  {
    id: 'flood',
    keywords: ['flood', 'water', 'leak', 'musty', 'wet'],
    question: (v) => (has(v, 'flood') || has(v, 'water damage') ? 'How bad is the water damage?' : null),
    answer: (v) => {
      const water = note(v, 'flood') ?? note(v, 'water damage')
      return water
        ? `The inspector noted “${water}”. We'd recommend your own inspection before bidding.`
        : 'No water damage was found in the inspection.'
    },
  },
]

const FALLBACK = "Good question. We'll check and add photos to the listing."

/** The seller's answer to the buyer's own question, by keyword. */
export function answerQuestion(vehicle: Vehicle, text: string): string {
  const lower = text.toLowerCase()
  const topic = TOPICS.find((t) => t.keywords.some((k) => lower.includes(k)))
  return topic ? topic.answer(vehicle) : FALLBACK
}

export interface Question {
  id: string
  lot: string
  /** 'you' for the buyer; otherwise a location like "Calgary, AB". Never an invented name. */
  author: 'you' | string
  text: string
  askedAt: number
  /** When the seller answers. Seeded unanswered questions have none. */
  answerAt: number | null
  /** Written when asked, from the car's data; hidden until `answered`. */
  answer: string | null
  /** Flipped by the clock (auction.tick) when answerAt passes. */
  answered: boolean
}

/**
 * Other buyers' questions on a car, generated from topics that fit it.
 * Times are relative to when the demo started, so they don't drift.
 */
export function seededQuestions(vehicle: Vehicle, places: readonly string[], since: number): Question[] {
  const rng = seededRng(hashString(`questions:${vehicle.id}`))
  const fitting = TOPICS.filter((t) => t.question(vehicle) !== null)
  const count = Math.min(fitting.length, randInt(rng, ...QA.seeded))
  const picked = shuffle(fitting, rng).slice(0, count)

  return picked
    .map((topic, i) => {
      const askedAt = since - randInt(rng, 2, 72) * HOUR
      const answered = rng() < QA.answeredShare
      return {
        id: `${vehicle.lot}-seed-${i}`,
        lot: vehicle.lot,
        author: places[Math.floor(rng() * places.length)] ?? 'Ontario',
        text: topic.question(vehicle)!,
        askedAt,
        answerAt: answered ? askedAt + randInt(rng, 20, 600) * MINUTE : null,
        answer: answered ? topic.answer(vehicle) : null,
        answered,
      }
    })
    .sort((a, b) => a.askedAt - b.askedAt)
}

function shuffle<T>(list: T[], rng: Rng): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export type PostRejection = 'empty' | 'too-long' | 'contact-details' | 'disrespectful'

/** Words that break the "be respectful" rule. Short on purpose: a real site would use a moderation service. */
const BLOCKED_WORDS = ['idiot', 'moron', 'stupid', 'dumb', 'loser', 'jerk', 'shut up', 'fuck', 'shit', 'bitch', 'asshole', 'bastard']
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/

/** P40: the posting rules. Null means the post is fine. */
export function checkPost(text: string): PostRejection | null {
  const trimmed = text.trim()
  if (trimmed.length === 0) return 'empty'
  if (trimmed.length > QA.maxLength) return 'too-long'
  if (EMAIL.test(trimmed) || PHONE.test(trimmed)) return 'contact-details'
  const lower = trimmed.toLowerCase()
  if (BLOCKED_WORDS.some((w) => new RegExp(`\\b${w}`, 'i').test(lower))) return 'disrespectful'
  return null
}

/** Why a question can't be asked: it breaks the posting rules, or the auction has ended. */
export type AskRejection = PostRejection | 'auction-ended'

export type AskResult = { ok: true; question: Question } | { ok: false; reason: AskRejection }

export function askQuestion(vehicle: Vehicle, text: string, now: number, rng: Rng): AskResult {
  const rejection = checkPost(text)
  if (rejection) return { ok: false, reason: rejection }
  return {
    ok: true,
    question: {
      id: `${vehicle.lot}-you-${now}`,
      lot: vehicle.lot,
      author: 'you',
      text: text.trim(),
      askedAt: now,
      answerAt: now + randInt(rng, ...QA.answerDelaySec) * SECOND,
      answer: answerQuestion(vehicle, text),
      answered: false,
    },
  }
}

