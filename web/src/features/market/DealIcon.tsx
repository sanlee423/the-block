import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react'
import type { DealRating } from '@/domain/market'
import { cn } from '@/lib/utils'
import { DEAL_LABELS } from './deal'

const STYLE: Record<DealRating, { icon: typeof ArrowDownIcon; className: string }> = {
  low: { icon: ArrowDownIcon, className: 'bg-success/15 text-success' },
  fair: { icon: MinusIcon, className: 'bg-muted text-muted-foreground' },
  high: { icon: ArrowUpIcon, className: 'bg-warning/15 text-warning' },
}

/**
 * P36: a colour-coded icon for the deal rating. Never colour alone: the icon
 * shape differs, and the label is either shown or read out. Pass `labelled`
 * when the label is already visible next to it, so it isn't read twice.
 */
export function DealIcon({
  rating,
  size = 'sm',
  labelled = false,
  className,
}: {
  rating: DealRating
  size?: 'sm' | 'md'
  labelled?: boolean
  className?: string
}) {
  const { icon: Icon, className: tone } = STYLE[rating]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        size === 'sm' ? 'size-5' : 'size-7',
        tone,
        className,
      )}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} strokeWidth={2.5} aria-hidden />
      {!labelled && <span className="sr-only">{DEAL_LABELS[rating]}</span>}
    </span>
  )
}
