import { InfoIcon } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { GRADE_BANDS, gradeBand, type GradeBand } from '@/domain/grade'
import { cn } from '@/lib/utils'
import { gradeToneClass } from './grade-tone'

function notesText(count: number): string {
  return `${count} damage ${count === 1 ? 'note' : 'notes'}`
}

/**
 * P33, cards: hover the grade badge for its band. Hover only, since tapping a
 * card opens the car, where the full explanation is a tap away.
 */
export function GradeTooltip({ grade, damageNotes, children }: { grade: number; damageNotes: number; children: ReactNode }) {
  const band = gradeBand(grade)
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="block max-w-60">
        <p className="font-semibold">
          {grade.toFixed(1)} / 5 · {band.label}
        </p>
        <p className="mt-0.5 opacity-80">{band.meaning}</p>
        <p className="mt-0.5 opacity-80">{notesText(damageNotes)}</p>
      </TooltipContent>
    </Tooltip>
  )
}

/** P33, detail page: the grade in the key facts strip opens this popover (tap works on phones). */
export function GradePopover({ grade, damageNotes }: { grade: number; damageNotes: number }) {
  const band = gradeBand(grade)
  const [scaleOpen, setScaleOpen] = useState(false)
  const [open, setOpen] = useState(false)
  // Set by "See them": when the popover closes, go to the damage notes instead
  // of handing focus back to the Grade button (which would scroll back up).
  const jumpToNotes = useRef(false)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 font-semibold pointer-coarse:py-1.5 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Grade <span className={gradeToneClass(grade)}>{grade.toFixed(1)}</span> / 5
            <InfoIcon className="size-3.5 text-muted-foreground" aria-hidden />
            <span className="sr-only">: what this grade means</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(18rem,calc(100vw-2rem))] text-sm"
          onCloseAutoFocus={(e) => {
            if (!jumpToNotes.current) return
            jumpToNotes.current = false
            e.preventDefault()
            const notes = document.getElementById('damage-notes-heading')
            notes?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            notes?.focus({ preventScroll: true })
          }}
        >
          <p className="font-semibold">
            {grade.toFixed(1)} / 5 · <span className={gradeToneClass(grade)}>{band.label}</span>
          </p>
          <p className="mt-1 text-muted-foreground">{band.meaning}</p>
          <p className="mt-2">
            This car has {notesText(damageNotes)}.{' '}
            {damageNotes > 0 && (
              <a
                href="#damage-notes-heading"
                className="text-primary underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.preventDefault()
                  jumpToNotes.current = true
                  setOpen(false)
                }}
              >
                See them
              </a>
            )}
          </p>
          <Button
            variant="link"
            className="mt-1 h-auto p-0"
            onClick={() => {
              setOpen(false)
              setScaleOpen(true)
            }}
          >
            How grading works
          </Button>
        </PopoverContent>
      </Popover>
      <GradeScaleDialog grade={grade} open={scaleOpen} onOpenChange={setScaleOpen} />
    </>
  )
}

/** A "How grading works" link that opens the full scale. */
export function GradeScaleLink({ grade, className }: { grade: number; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="link" className={cn('h-auto p-0 text-sm pointer-coarse:py-2', className)} onClick={() => setOpen(true)}>
        How grading works
      </Button>
      <GradeScaleDialog grade={grade} open={open} onOpenChange={setOpen} />
    </>
  )
}

/** P33: the whole 0-5 scale, with this car's band highlighted. */
function GradeScaleDialog({
  grade,
  open,
  onOpenChange,
}: {
  grade: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const current = gradeBand(grade)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How grading works</DialogTitle>
          <DialogDescription>
            Every car is graded from 0 to 5 on a scale based on the NAAA standard used across dealer auctions.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-1.5">
          {GRADE_BANDS.map((band) => (
            <BandRow key={band.label} band={band} current={band === current} grade={grade} />
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          An inspector sets the grade from the whole report: body, interior, tires, mechanical checks and damage. It
          isn't a count of damage notes, so read the notes too. Two cars with the same grade can need different repairs.
        </p>
      </DialogContent>
    </Dialog>
  )
}

function BandRow({ band, current, grade }: { band: GradeBand; current: boolean; grade: number }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[4.5rem_1fr] gap-3 rounded-md px-3 py-2 text-sm',
        current ? 'bg-primary/10 ring-1 ring-primary/40' : 'bg-muted/50',
      )}
      aria-current={current ? 'true' : undefined}
    >
      <span className="font-semibold tabular-nums">
        {band.min.toFixed(1)}–{band.max.toFixed(1)}
      </span>
      <span>
        <span className="font-medium">{band.label}</span>
        {current && <span className="ml-1.5 text-xs font-medium text-primary">This car ({grade.toFixed(1)})</span>}
        <span className="block text-muted-foreground">{band.meaning}</span>
      </span>
    </li>
  )
}
