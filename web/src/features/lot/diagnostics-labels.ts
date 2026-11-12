import type { Diagnostics, Severity, SoundVerdict } from '@/domain/diagnostics'

/** Labels and colours for the Engine & diagnostics section (P34). */

export const SEVERITY_INFO: Record<Severity, { label: string; pill: string; region: string }> = {
  serious: { label: 'Serious', pill: 'bg-destructive/10 text-destructive', region: 'bg-destructive/15' },
  monitor: { label: 'Monitor', pill: 'bg-warning/15 text-warning', region: 'bg-warning/15' },
  info: { label: 'Info', pill: 'bg-muted text-muted-foreground', region: 'bg-muted' },
}

export const VERDICT_INFO: Record<SoundVerdict, { label: string; short: string; pill: string }> = {
  normal: { label: 'Normal', short: 'Engine normal', pill: 'bg-success/15 text-success' },
  minor: { label: 'Minor noise', short: 'Minor engine noise', pill: 'bg-warning/15 text-warning' },
  attention: { label: 'Needs attention', short: 'Engine needs attention', pill: 'bg-destructive/10 text-destructive' },
  'not-applicable': { label: 'Not applicable', short: 'Electric motor', pill: 'bg-muted text-muted-foreground' },
}

/** "2 fault codes · Minor engine noise", for the key facts strip. */
export function diagnosticsSummary({ codes, sound }: Diagnostics): string {
  const codeText = codes.length === 0 ? 'No fault codes' : `${codes.length} fault ${codes.length === 1 ? 'code' : 'codes'}`
  return `${codeText} · ${VERDICT_INFO[sound.verdict].short}`
}
