import { TriangleAlertIcon } from 'lucide-react'
import { gradeBand } from '@/domain/grade'
import type { TitleStatus, Vehicle } from '@/domain/vehicle'
import { cn } from '@/lib/utils'
import { GradeScaleLink } from './GradeInfo'
import { gradeToneClass } from './grade-tone'

const TITLE_INFO: Record<TitleStatus, { label: string; detail: string }> = {
  clean: { label: 'Clean title', detail: 'No history of being declared a total loss.' },
  rebuilt: {
    label: 'Rebuilt title',
    detail: 'Previously declared a total loss, then repaired and passed inspection. Affects resale value and insurance.',
  },
  salvage: {
    label: 'Salvage title',
    detail: 'Declared a total loss by an insurer. Needs repair and inspection before it can be registered for the road.',
  },
}

/** Condition first (P13): grade, title, the inspector's report and damage notes. */
export function ConditionSection({ vehicle }: { vehicle: Vehicle }) {
  const title = TITLE_INFO[vehicle.title_status]
  const branded = vehicle.title_status !== 'clean'
  const band = gradeBand(vehicle.condition_grade)
  return (
    <section aria-labelledby="condition-heading" className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="condition-heading" className="text-lg font-semibold">
        Condition
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground">Condition grade</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">
            {vehicle.condition_grade.toFixed(1)}
            <span className="text-base font-normal text-muted-foreground"> / 5</span>
            <span className={cn('ml-2 text-base', gradeToneClass(vehicle.condition_grade))}>{band.label}</span>
          </p>
          <GradeMeter grade={vehicle.condition_grade} />
          <p className="mt-2 text-sm text-muted-foreground">{band.meaning}</p>
          <GradeScaleLink grade={vehicle.condition_grade} className="mt-1" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Title</p>
          <p className={cn('mt-0.5 font-semibold', branded && 'text-warning')}>{title.label}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{title.detail}</p>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-medium">Inspection report</h3>
        <p className="mt-1 text-sm text-muted-foreground">{vehicle.condition_report}</p>
      </div>

      <div className="mt-5">
        {/* tabIndex -1 so "See them" in the grade popover can move focus here. */}
        <h3 id="damage-notes-heading" tabIndex={-1} className="text-sm font-medium focus:outline-none">
          Damage notes <span className="text-muted-foreground tabular-nums">({vehicle.damage_notes.length})</span>
        </h3>
        {vehicle.damage_notes.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {vehicle.damage_notes.map((note) => (
              <li key={note} className="flex gap-2 text-sm">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                {note}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No damage reported.</p>
        )}
      </div>
    </section>
  )
}

function GradeMeter({ grade }: { grade: number }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div
        className={cn('h-full rounded-full', { success: 'bg-success', neutral: 'bg-primary', warning: 'bg-warning' }[gradeBand(grade).tone])}
        style={{ width: `${(grade / 5) * 100}%` }}
      />
    </div>
  )
}
