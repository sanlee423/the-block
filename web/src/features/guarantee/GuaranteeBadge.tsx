import { ShieldCheckIcon, ShieldOffIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CLAIM_CATEGORIES, GUARANTEE, isGuaranteed } from '@/domain/guarantee'
import type { Vehicle } from '@/domain/vehicle'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'

const days = GUARANTEE.windowMs / 86_400_000

/** P35: "Block Guarantee" or "Sold as-is". Opens a short summary of what's covered. */
export function GuaranteeBadge({ vehicle, className }: { vehicle: Vehicle; className?: string }) {
  const covered = isGuaranteed(vehicle)
  const Icon = covered ? ShieldCheckIcon : ShieldOffIcon
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium pointer-coarse:py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            covered ? 'bg-success/15 text-success hover:bg-success/20' : 'bg-muted text-muted-foreground hover:bg-muted/70',
            className,
          )}
        >
          <Icon className="size-4" aria-hidden />
          {covered ? 'Block Guarantee' : 'Sold as-is'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] text-sm">
        {covered ? <CoveredSummary /> : <AsIsSummary title={vehicle.title_status} />}
      </PopoverContent>
    </Popover>
  )
}

function CoveredSummary() {
  return (
    <>
      <p className="font-semibold">Guaranteed as described</p>
      <p className="mt-1 text-muted-foreground">
        If you win and find a problem the listing didn't disclose, file a claim within {days} days. If it's approved,
        the seller pays for the repair.
      </p>
      <p className="mt-2 font-medium">Covered</p>
      <ul className="mt-0.5 list-disc pl-5 text-muted-foreground">
        {CLAIM_CATEGORIES.map((c) => (
          <li key={c.id}>{c.label}</li>
        ))}
      </ul>
      <p className="mt-2 font-medium">Not covered</p>
      <ul className="mt-0.5 list-disc pl-5 text-muted-foreground">
        <li>Anything in the inspection report or damage notes</li>
        <li>Normal wear for the car's grade</li>
        <li>Repairs estimated under {formatPrice(GUARANTEE.minimumEstimate)}</li>
      </ul>
    </>
  )
}

function AsIsSummary({ title }: { title: string }) {
  return (
    <>
      <p className="font-semibold">No guarantee</p>
      <p className="mt-1 text-muted-foreground">
        This car has a {title} title, so it's sold as-is: you can't file a claim after buying it, even for problems
        the listing didn't mention. Read the condition report closely before bidding.
      </p>
    </>
  )
}
