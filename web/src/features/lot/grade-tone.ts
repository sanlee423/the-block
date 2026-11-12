import { gradeBand } from '@/domain/grade'

/** Text colour for a grade (P33), shared by the card badge, the key facts strip and the meter. */
export function gradeToneClass(grade: number): string {
  const tone = gradeBand(grade).tone
  return tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-foreground'
}
