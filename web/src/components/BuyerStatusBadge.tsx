import type { BuyerStatus } from '@/domain/lot'
import { cn } from '@/lib/utils'

const STYLES: Record<BuyerStatus, { label: string; className: string }> = {
  winning: { label: 'Winning', className: 'bg-success/15 text-success' },
  outbid: { label: 'Outbid', className: 'bg-destructive/15 text-destructive' },
  won: { label: 'Won', className: 'bg-success text-white dark:text-background' },
  lost: { label: 'Lost', className: 'bg-muted text-muted-foreground' },
}

/** Where the buyer stands on a lot (P14). Colours follow P21: green good, red needs action. */
export function BuyerStatusBadge({ status, className }: { status: BuyerStatus; className?: string }) {
  const { label, className: style } = STYLES[status]
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', style, className)}>{label}</span>
  )
}
