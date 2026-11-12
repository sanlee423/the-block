import { CircleCheckIcon, CircleXIcon, LoaderCircleIcon, ShieldCheckIcon, ShieldOffIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CLAIM_CATEGORIES,
  claimBlocker,
  claimWindowEndsAt,
  GUARANTEE,
  type Claim,
  type ClaimCategory,
  type ClaimRejection,
} from '@/domain/guarantee'
import type { LotState } from '@/domain/lot'
import type { Vehicle } from '@/domain/vehicle'
import { formatDuration, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { auction, useClaims } from '@/state/auction-store'
import { parseDollars } from '../lot/bid-input'
import { CATEGORY_LABEL } from './claim-note'

const REJECTION_TEXT: Record<ClaimRejection, string> = {
  'not-won': 'Only the winning buyer can file a claim.',
  'as-is': 'This car was sold as-is.',
  'window-closed': 'The claim window has closed.',
  'already-claimed': "You've already filed a claim in that category.",
  'missing-description': 'Describe the problem.',
  'invalid-estimate': 'Enter the repair estimate in whole dollars.',
}

/** P35, on a won lot: the claim window, filed claims and the claim form. */
export function ClaimsPanel({ vehicle, lot, now }: { vehicle: Vehicle; lot: LotState; now: number }) {
  const claims = useClaims().filter((c) => c.lot === lot.lot)
  const [formOpen, setFormOpen] = useState(false)
  const blocker = claimBlocker(vehicle, lot, now)

  if (blocker === 'as-is') {
    return (
      <div className="mt-4 flex gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <ShieldOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>Sold as-is ({vehicle.title_status} title). The Block Guarantee doesn't cover this car.</p>
      </div>
    )
  }

  const open = blocker === null
  const left = claimWindowEndsAt(lot) - now
  const claimed = new Set(claims.map((c) => c.category))
  const available = CLAIM_CATEGORIES.filter((c) => !claimed.has(c.id))

  return (
    <section aria-labelledby="claims-heading" className="mt-4 rounded-lg border p-3 text-sm">
      <h3 id="claims-heading" className="flex items-center gap-1.5 font-semibold">
        <ShieldCheckIcon className="size-4 text-success" aria-hidden />
        Block Guarantee
      </h3>
      <p className="mt-1 text-muted-foreground">
        {open ? (
          <>
            Found a problem the listing didn't disclose? You have{' '}
            <span className="font-medium text-foreground tabular-nums">{formatDuration(left)}</span> left to file a claim.
          </>
        ) : (
          'The 7-day claim window has closed.'
        )}
      </p>

      {claims.length > 0 && (
        <ul className="mt-3 space-y-2">
          {claims.map((c) => (
            <ClaimRow key={c.id} claim={c} />
          ))}
        </ul>
      )}

      {open && available.length > 0 && !formOpen && (
        <Button variant="outline" className="mt-3 w-full" onClick={() => setFormOpen(true)}>
          File a claim
        </Button>
      )}
      {open && formOpen && (
        <ClaimForm lot={lot.lot} categories={available} onDone={() => setFormOpen(false)} />
      )}
    </section>
  )
}

function ClaimRow({ claim }: { claim: Claim }) {
  const status = {
    review: { label: 'Under review', icon: LoaderCircleIcon, className: 'text-muted-foreground', spin: true },
    approved: { label: 'Approved', icon: CircleCheckIcon, className: 'text-success', spin: false },
    denied: { label: 'Denied', icon: CircleXIcon, className: 'text-destructive', spin: false },
  }[claim.status]
  const Icon = status.icon
  return (
    <li className="rounded-md bg-muted/50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{CATEGORY_LABEL[claim.category]}</span>
        <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', status.className)}>
          <Icon className={cn('size-3.5', status.spin && 'animate-spin')} aria-hidden />
          {status.label}
        </span>
      </div>
      <p className="mt-0.5 text-muted-foreground">
        “{claim.description}” · estimate {formatPrice(claim.estimate)}
      </p>
      {claim.status !== 'review' && <p className="mt-1">{claim.decision.reason}</p>}
    </li>
  )
}

function ClaimForm({
  lot,
  categories,
  onDone,
}: {
  lot: string
  categories: typeof CLAIM_CATEGORIES
  onDone: () => void
}) {
  const ids = { category: useId(), description: useId(), estimate: useId(), error: useId() }
  const [category, setCategory] = useState<ClaimCategory>(categories[0].id)
  const [description, setDescription] = useState('')
  const [estimate, setEstimate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const hint = categories.find((c) => c.id === category)?.examples

  function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseDollars(estimate)
    if (amount === null) return setError(REJECTION_TEXT['invalid-estimate'])
    const result = auction.fileClaim(lot, { category, description, estimate: amount })
    if (!result.ok) return setError(REJECTION_TEXT[result.reason])
    toast('Claim filed', { description: "We're reviewing it. You'll hear back shortly." })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-3 border-t pt-3" aria-describedby={error ? ids.error : undefined}>
      <div>
        <label htmlFor={ids.category} className="font-medium">
          What's wrong?
        </label>
        <NativeSelect
          id={ids.category}
          className="mt-1 h-10"
          value={category}
          onChange={(e) => setCategory(e.target.value as ClaimCategory)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
        {hint && <p className="mt-1 text-xs text-muted-foreground">For example: {hint}</p>}
      </div>
      <div>
        <label htmlFor={ids.description} className="font-medium">
          Describe the problem
        </label>
        <textarea
          id={ids.description}
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            setError(null)
          }}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      </div>
      <div>
        <label htmlFor={ids.estimate} className="font-medium">
          Repair estimate
        </label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden>
            $
          </span>
          <Input
            id={ids.estimate}
            inputMode="numeric"
            autoComplete="off"
            value={estimate}
            onChange={(e) => {
              setEstimate(e.target.value)
              setError(null)
            }}
            className="h-10 pl-6 tabular-nums"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          From a mechanic or body shop. Repairs under {formatPrice(GUARANTEE.minimumEstimate)} aren't covered.
        </p>
      </div>
      {error && (
        <p id={ids.error} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Submit claim
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
