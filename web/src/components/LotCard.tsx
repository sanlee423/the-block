import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import { buyerStatus, buyNowAvailable, outcome, phase, reserveStatus, type LotState } from '@/domain/lot'
import { vehicleTitle, type Vehicle } from '@/domain/vehicle'
import { formatKm, formatLocation, formatPrice } from '@/lib/format'
import { GradeTooltip } from '@/features/lot/GradeInfo'
import { DEAL_LABELS, dealFor, differenceText } from '@/features/market/deal'
import { DealIcon } from '@/features/market/DealIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { gradeToneClass } from '@/features/lot/grade-tone'
import { cn } from '@/lib/utils'
import { AuctionTimeChip } from './AuctionTime'
import { BuyerStatusBadge } from './BuyerStatusBadge'
import { WatchButton } from './WatchButton'

/**
 * Compact inventory card (P5): photo with grade badge and time chip, title,
 * engine | km, location and bid status, then a price strip.
 */
export function LotCard({
  vehicle,
  lot,
  now,
  note,
}: {
  vehicle: Vehicle
  lot: LotState
  now: number
  /** An extra line under the price, e.g. the claim window in My bids. */
  note?: string | null
}) {
  const title = vehicleTitle(vehicle)
  const status = buyerStatus(lot, now)

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs transition-shadow hover:shadow-md">
      <Link
        to={`/lot/${vehicle.lot}`}
        className="flex flex-1 flex-col rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="relative aspect-4/3 bg-muted">
          <img
            src={vehicle.images[0]}
            alt={title}
            loading="lazy"
            className="size-full object-cover"
          />
          <GradeTooltip grade={vehicle.condition_grade} damageNotes={vehicle.damage_notes.length}>
            <ConditionGrade grade={vehicle.condition_grade} className="absolute top-2 left-2" />
          </GradeTooltip>
          <AuctionTimeChip lot={lot} now={now} className="absolute bottom-2 left-2" />
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="truncate font-semibold" title={title}>
            {title}
          </h3>
          <p className="truncate text-sm text-muted-foreground">
            {vehicle.engine} <span aria-hidden>|</span> {formatKm(vehicle.odometer_km)}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{formatLocation(vehicle.city, vehicle.province)}</span>
            {status ? <BuyerStatusBadge status={status} /> : <BidCount lot={lot} now={now} />}
          </div>
          <Tags vehicle={vehicle} lot={lot} now={now} />
        </div>

        <PriceStrip vehicle={vehicle} lot={lot} now={now} />
        {note && <p className="border-t px-3 py-1.5 text-xs text-muted-foreground tabular-nums">{note}</p>}
      </Link>

      <WatchButton lot={vehicle.lot} label={title} className="absolute top-2 right-2" />
    </article>
  )
}

function ConditionGrade({ grade, className, ...props }: { grade: number; className?: string } & ComponentProps<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        'rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold tabular-nums shadow-sm backdrop-blur',
        gradeToneClass(grade),
        className,
      )}
    >
      <span className="sr-only">Condition grade </span>
      {grade.toFixed(1)}
    </span>
  )
}

function BidCount({ lot, now }: { lot: LotState; now: number }) {
  if (phase(lot, now) === 'upcoming') return <span>Not started</span>
  if (lot.bidCount === 0) return <span>Awaiting bids</span>
  return (
    <span className="tabular-nums">
      {lot.bidCount} {lot.bidCount === 1 ? 'bid' : 'bids'}
    </span>
  )
}

/** Small facts a dealer buyer scans for: reserve, Buy Now, branded title. */
function Tags({ vehicle, lot, now }: { vehicle: Vehicle; lot: LotState; now: number }) {
  const reserve = reserveStatus(lot)
  const tags: { label: string; className: string }[] = []
  if (vehicle.title_status !== 'clean') {
    tags.push({ label: `${capitalize(vehicle.title_status)} title`, className: 'bg-warning/15 text-warning' })
  }
  if (phase(lot, now) !== 'ended') {
    if (reserve === 'none') tags.push({ label: 'No reserve', className: 'bg-primary/10 text-primary' })
    else if (reserve === 'met') tags.push({ label: 'Reserve met', className: 'bg-success/15 text-success' })
    if (buyNowAvailable(lot, now) && lot.buyNowPrice !== null) {
      tags.push({ label: `Buy Now ${formatPrice(lot.buyNowPrice)}`, className: 'bg-secondary text-secondary-foreground' })
    }
  }
  if (tags.length === 0) return null
  return (
    <ul className="mt-1 flex flex-wrap gap-1">
      {tags.map((t) => (
        <li key={t.label} className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', t.className)}>
          {t.label}
        </li>
      ))}
    </ul>
  )
}

function PriceStrip({ vehicle, lot, now }: { vehicle: Vehicle; lot: LotState; now: number }) {
  const deal = dealFor(vehicle, lot, now)
  let label: string
  let amount: number | null
  if (phase(lot, now) === 'ended') {
    const result = outcome(lot)
    if (result.kind === 'sold') [label, amount] = ['Sold for', result.price]
    else if (result.kind === 'reserve-not-met') [label, amount] = ['Reserve not met', result.highBid]
    else [label, amount] = ['No bids', null]
  } else if (lot.currentBid === null) {
    ;[label, amount] = ['Starting bid', lot.startingBid]
  } else {
    ;[label, amount] = ['Current bid', lot.currentBid]
  }
  return (
    <div className="mt-auto flex items-baseline justify-between gap-2 border-t bg-muted/50 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      {amount !== null && (
        <span className="flex items-center gap-1.5">
          {deal && (
            // P36: hover for the detail; the icon's label is read out either way.
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <DealIcon rating={deal.rating} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {DEAL_LABELS[deal.rating]}: {differenceText(deal.percent)} the estimated value of {formatPrice(deal.value)}
              </TooltipContent>
            </Tooltip>
          )}
          <span className="font-semibold tabular-nums">{formatPrice(amount)}</span>
        </span>
      )}
    </div>
  )
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
