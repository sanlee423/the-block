import { CircleCheckIcon, FlaskConicalIcon, PlugZapIcon } from 'lucide-react'
import { RECORDING_PHASES, RECORDING_SECONDS, type Diagnostics, type FaultCode } from '@/domain/diagnostics'
import { cn } from '@/lib/utils'
import { SEVERITY_INFO, VERDICT_INFO } from './diagnostics-labels'

/**
 * P34: fault codes in plain words (like OPENLANE's Code Boost IQ) and an engine
 * sound analysis (in place of ACV's AMP recording). Generated demo data.
 */
export function DiagnosticsSection({ diagnostics }: { diagnostics: Diagnostics }) {
  const { codes, sound } = diagnostics
  return (
    <section aria-labelledby="diagnostics-heading" className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="diagnostics-heading" className="text-lg font-semibold">
          Engine & diagnostics
        </h2>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <FlaskConicalIcon className="size-3.5" aria-hidden />
          Demo data, generated from this car's condition report
        </p>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-medium">
          Fault codes <span className="text-muted-foreground tabular-nums">({codes.length})</span>
        </h3>
        {codes.length === 0 ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleCheckIcon className="size-4 text-success" aria-hidden />
            No fault codes stored in the car's computer.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {codes.map((c) => (
              <CodeRow key={c.code} code={c} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">Engine sound analysis</h3>
          <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', VERDICT_INFO[sound.verdict].pill)}>
            {VERDICT_INFO[sound.verdict].label}
          </span>
        </div>
        {sound.verdict === 'not-applicable' ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <PlugZapIcon className="size-4" aria-hidden />
            Electric motor. There's no engine sound to analyze.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              A 30-second recording of a cold start, idle and a rev, checked for knocks, ticks and an uneven rhythm.
            </p>
            <Waveform diagnostics={diagnostics} />
            {sound.findings.length === 0 ? (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CircleCheckIcon className="size-4 text-success" aria-hidden />
                Even idle and clean revs. Nothing unusual heard.
              </p>
            ) : (
              <ol className="mt-3 space-y-1.5">
                {sound.findings.map((f, i) => (
                  <li key={f.label} className="flex gap-2 text-sm">
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        SEVERITY_INFO[f.severity].pill,
                      )}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span>
                      <span className="text-muted-foreground tabular-nums">
                        {clock(f.start)}–{clock(f.end)}
                      </span>{' '}
                      {f.label}
                      <span className="sr-only"> ({SEVERITY_INFO[f.severity].label})</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function CodeRow({ code }: { code: FaultCode }) {
  const info = SEVERITY_INFO[code.severity]
  return (
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold', info.pill)}>{info.label}</span>
        <span className="font-mono text-xs font-semibold">{code.code}</span>
        <span className="font-medium">{code.title}</span>
      </div>
      <p className="mt-1 text-muted-foreground">{code.explanation}</p>
      {code.fromNote && <p className="mt-1 text-xs text-muted-foreground">Matches damage note: “{code.fromNote}”</p>}
    </li>
  )
}

/** The recording's amplitude, with flagged moments shaded and numbered. Decorative: the list says the same. */
function Waveform({ diagnostics }: { diagnostics: Diagnostics }) {
  const { samples, findings } = diagnostics.sound
  const pct = (sec: number) => `${(sec / RECORDING_SECONDS) * 100}%`
  return (
    <div className="mt-3" aria-hidden>
      <div className="relative h-20 overflow-hidden rounded-md bg-muted/40">
        {findings.map((f) => (
          <div
            key={f.label}
            className={cn('absolute inset-y-0', SEVERITY_INFO[f.severity].region)}
            style={{ left: pct(f.start), width: pct(f.end - f.start) }}
          />
        ))}
        <svg viewBox={`0 0 ${samples.length} 40`} preserveAspectRatio="none" className="absolute inset-0 size-full text-primary/70">
          {samples.map((s, i) => (
            <rect key={i} x={i + 0.2} width={0.6} y={20 - s * 18} height={s * 36} rx={0.3} fill="currentColor" />
          ))}
        </svg>
        {findings.map((f, i) => (
          <span
            key={f.label}
            className={cn(
              'absolute top-1 flex size-4 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm',
              f.severity === 'serious' ? 'bg-destructive text-white' : 'bg-warning text-white',
            )}
            style={{ left: pct((f.start + f.end) / 2) }}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-muted-foreground">
        {RECORDING_PHASES.map((p) => (
          <span key={p.label} className="absolute border-l pl-1" style={{ left: pct(p.start) }}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function clock(sec: number): string {
  return `0:${String(sec).padStart(2, '0')}`
}
