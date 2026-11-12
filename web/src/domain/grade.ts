/**
 * P33: what a condition grade means, by band, based on the NAAA 0-5 scale.
 * The dataset's grades are set by the inspector from the whole report, so we
 * can explain the band a grade falls in, not why a car got exactly that number.
 */

export interface GradeBand {
  /** Lowest grade in the band, inclusive. */
  min: number
  /** Highest grade in the band, inclusive. */
  max: number
  label: string
  meaning: string
  tone: 'success' | 'neutral' | 'warning'
}

export const GRADE_BANDS: readonly GradeBand[] = [
  { min: 4.5, max: 5, label: 'Excellent', meaning: 'Like new. Minimal wear, no repairs needed.', tone: 'success' },
  { min: 3.5, max: 4.4, label: 'Clean', meaning: 'Light wear for its age, minor cosmetic flaws.', tone: 'success' },
  {
    min: 2.5,
    max: 3.4,
    label: 'Average',
    meaning: 'Normal wear, some cosmetic and minor mechanical repairs.',
    tone: 'neutral',
  },
  {
    min: 1.5,
    max: 2.4,
    label: 'Rough',
    meaning: 'Heavy wear or visible damage, several repairs needed.',
    tone: 'warning',
  },
  { min: 0, max: 1.4, label: 'Poor', meaning: 'Major damage, may not be roadworthy.', tone: 'warning' },
]

/** The band a grade falls in. Grades have one decimal, so 4.45 can't happen. */
export function gradeBand(grade: number): GradeBand {
  return GRADE_BANDS.find((b) => grade >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]
}
