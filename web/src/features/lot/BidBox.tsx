import { CircleAlertIcon, CircleCheckIcon, GavelIcon, TimerResetIcon, ZapIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AuctionTimeChip } from '@/components/AuctionTime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buyerStatus,
  buyNowAvailable,
  endedAt,
  minimumMaxBid,
  outcome,
  phase,
  quickBidAmount,
  reserveStatus,
  SOFT_CLOSE,
  type LotState,
} from '@/domain/lot'
import { formatPrice } from '@/lib/format'
import { DEAL_LABELS, dealFor, differenceText } from '@/features/market/deal'
import { DealIcon } from '@/features/market/DealIcon'
import type { Vehicle } from '@/domain/vehicle'
import { ClaimsPanel } from '@/features/guarantee/ClaimsPanel'
import { GuaranteeBadge } from '@/features/guarantee/GuaranteeBadge'
import { cn } from '@/lib/utils'
import { auction } from '@/state/auction-store'
import { AllInPriceDetails, AllInPriceSummary } from './AllInPrice'
import { bidRejectionMessage, parseDollars } from './bid-input'

/** What the buyer is about to confirm. Nothing is committed until they confirm (trust). */
type Pending =
  | { kind: 'quick'; amount: number }
  | { kind: 'max'; amount: number }
  | { kind: 'buy-now'; amount: number }

const dateTime = new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/**
 * The bid box (P2): current price and status, quick bid, "Your max bid", and
 * Buy Now (P8). Every action gets a confirm step first. Shows the all-in price
 * (P39) and the soft-close rule (P38). `province` is where the car is.
 */
export function BidBox({ vehicle, lot, now }: { vehicle: Vehicle; lot: LotState; now: number }) {
  const province = vehicle.province
  const p = phase(lot, now)
  // id: the phone bid bar (MobileBidBar) scrolls here and hides while this is on screen.
  return (
    <section id="bid-box" aria-labelledby="bid-heading" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <h2 id="bid-heading" className="sr-only">
        Bidding
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AuctionTimeChip lot={lot} now={now} onPhoto={false} className="text-sm shadow-none" />
        <span className="text-xs text-muted-foreground">
          {p === 'upcoming' ? 'Opens ' : p === 'ended' ? 'Ended ' : 'Ends '}
          {dateTime.format(p === 'upcoming' ? lot.startsAt : endedAt(lot))}
        </span>
      </div>
      {p === 'live' && <SoftCloseNote lot={lot} />}

      <PriceSummary lot={lot} now={now} />
      <DealLine vehicle={vehicle} lot={lot} now={now} />
      <YourStatus lot={lot} now={now} />
      {buyerStatus(lot, now) === 'won' && <ClaimsPanel vehicle={vehicle} lot={lot} now={now} />}

      {p === 'live' && <BidActions lot={lot} now={now} province={province} />}
      {p === 'upcoming' && (
        <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Bidding opens when the auction starts. Add it to your watchlist to keep track.
        </p>
      )}
      {p !== 'ended' && (
        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <GuaranteeBadge vehicle={vehicle} className="text-xs" />
          <span>{vehicle.title_status === 'clean' ? '7 days to report undisclosed problems' : 'No claims after purchase'}</span>
        </div>
      )}
    </section>
  )
}

/** P38: explains the extension rule, and says when it has kicked in. */
function SoftCloseNote({ lot }: { lot: LotState }) {
  const minutes = SOFT_CLOSE / 60_000
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
      <TimerResetIcon className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        {lot.extensions > 0 && (
          <span className="font-medium text-foreground">
            Extended {lot.extensions === 1 ? 'once' : `${lot.extensions} times`} by late bids.{' '}
          </span>
        )}
        Any bid in the last {minutes} minutes resets the clock to {minutes} minutes.
      </span>
    </p>
  )
}

function PriceSummary({ lot, now }: { lot: LotState; now: number }) {
  const ended = phase(lot, now) === 'ended'
  let label = lot.currentBid === null ? 'Starting bid' : 'Current bid'
  let amount: number | null = lot.currentBid ?? lot.startingBid
  if (ended) {
    const result = outcome(lot)
    if (result.kind === 'sold') label = result.viaBuyNow ? 'Sold with Buy Now' : 'Sold for'
    else if (result.kind === 'reserve-not-met') label = 'Ended, reserve not met. High bid'
    else [label, amount] = ['Ended with no bids', null]
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {amount !== null && (
          // Keyed on the amount so a new price briefly animates in when a rival bids.
          <span key={amount} className="animate-in text-3xl font-semibold tracking-tight tabular-nums fade-in zoom-in-95">
            {formatPrice(amount)}
          </span>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">
          {lot.bidCount} {lot.bidCount === 1 ? 'bid' : 'bids'}
        </span>
      </div>
      {!ended && <ReserveLine lot={lot} />}
    </div>
  )
}

/** P36: the deal rating under the price, linking to the full price check. */
function DealLine({ vehicle, lot, now }: { vehicle: Vehicle; lot: LotState; now: number }) {
  const deal = dealFor(vehicle, lot, now)
  if (!deal) return null
  return (
    <a
      href="#market-heading"
      className="mt-2 flex items-center gap-2 rounded-md text-sm hover:underline pointer-coarse:py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <DealIcon rating={deal.rating} labelled />
      <span>
        <span className="font-medium">{DEAL_LABELS[deal.rating]}</span>
        <span className="text-muted-foreground">
          {' '}
          · {differenceText(deal.percent)} est. value {formatPrice(deal.value)}
        </span>
      </span>
    </a>
  )
}

function ReserveLine({ lot }: { lot: LotState }) {
  const status = reserveStatus(lot)
  const text = { none: 'No reserve', met: 'Reserve met', 'not-met': 'Reserve not met' }[status]
  const hint = {
    none: 'The highest bid wins, whatever the price.',
    met: 'The highest bid at the end wins the vehicle.',
    'not-met': "The seller's minimum price hasn't been reached yet.",
  }[status]
  return (
    <p className="mt-1 text-sm">
      <span className={cn('font-medium', status === 'not-met' ? 'text-warning' : 'text-success')}>{text}</span>
      <span className="text-muted-foreground"> · {hint}</span>
    </p>
  )
}

/** Banner telling the buyer where they stand (P14). */
function YourStatus({ lot, now }: { lot: LotState; now: number }) {
  const status = buyerStatus(lot, now)
  if (!status) return null
  const yourMax = lot.yourMax !== null ? formatPrice(lot.yourMax) : null

  const content = {
    winning: {
      tone: 'success',
      title: "You're the high bidder",
      body:
        reserveStatus(lot) === 'not-met'
          ? `Your max is ${yourMax}, but the reserve isn't met yet. Raise your max to have a chance of buying it.`
          : `Your max is ${yourMax}. We'll bid for you up to that amount.`,
    },
    outbid: {
      tone: 'danger',
      title: "You've been outbid",
      body: `Another bidder's max is higher than yours (${yourMax}). Bid again to get back in.`,
    },
    won: { tone: 'success', title: 'You won this vehicle', body: `Final price ${formatPrice(lot.currentBid ?? 0)}.` },
    lost: {
      tone: 'muted',
      title: outcome(lot).kind === 'reserve-not-met' && lot.leader === 'you' ? "Reserve wasn't met" : 'You didn’t win',
      body:
        outcome(lot).kind === 'reserve-not-met' && lot.leader === 'you'
          ? 'You were the high bidder, but the price stayed below the seller’s reserve, so it didn’t sell.'
          : yourMax
            ? `Your max was ${yourMax}.`
            : '',
    },
  }[status]

  const Icon = content.tone === 'danger' ? CircleAlertIcon : CircleCheckIcon
  return (
    <div
      role="status"
      className={cn(
        'mt-4 flex gap-2 rounded-lg p-3 text-sm',
        content.tone === 'success' && 'bg-success/10 text-success',
        content.tone === 'danger' && 'bg-destructive/10 text-destructive',
        content.tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{content.title}</p>
        {content.body && <p className="mt-0.5 text-foreground/80">{content.body}</p>}
      </div>
    </div>
  )
}

function BidActions({ lot, now, province }: { lot: LotState; now: number; province: string }) {
  const inputId = useId()
  const helpId = useId()
  const [maxInput, setMaxInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const leading = lot.leader === 'you'
  const minimum = minimumMaxBid(lot, 'you')
  const quick = quickBidAmount(lot)
  const canBuyNow = buyNowAvailable(lot, now) && lot.buyNowPrice !== null

  function reviewMax(e: FormEvent) {
    e.preventDefault()
    const amount = parseDollars(maxInput)
    if (amount === null) return setError(bidRejectionMessage('invalid-amount', minimum))
    if (amount < minimum) return setError(bidRejectionMessage('too-low', minimum))
    setError(null)
    setPending({ kind: 'max', amount })
  }

  function confirm() {
    if (!pending) return
    if (pending.kind === 'buy-now') {
      const result = auction.buyNow(lot.lot)
      if (result.ok) toast.success('You bought it', { description: `Sold to you for ${formatPrice(pending.amount)}.` })
      else toast.error('Buy Now is no longer available', { description: 'Bidding passed the reserve.' })
      setPending(null)
      return
    }

    const before = lot
    const result = auction.placeBid(lot.lot, pending.amount)
    setPending(null)
    if (!result.ok) {
      setError(
        result.reason === 'too-low'
          ? `The price moved. ${bidRejectionMessage('too-low', result.minimum)}`
          : bidRejectionMessage(result.reason, result.minimum),
      )
      return
    }
    setMaxInput('')
    setError(null)
    announceBid(before, result.lot)
  }

  if (pending) {
    return (
      <ConfirmStep pending={pending} lot={lot} province={province} onConfirm={confirm} onCancel={() => setPending(null)} />
    )
  }

  return (
    <div className="mt-5 space-y-4">
      {!leading && (
        <Button size="lg" className="h-11 w-full text-base" onClick={() => setPending({ kind: 'quick', amount: quick })}>
          <GavelIcon aria-hidden />
          Bid {formatPrice(quick)}
        </Button>
      )}

      <form onSubmit={reviewMax} noValidate>
        <label htmlFor={inputId} className="text-sm font-medium">
          {leading ? 'Raise your max bid' : 'Your max bid'}
        </label>
        <div className="mt-1.5 flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden>
              $
            </span>
            <Input
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              placeholder={minimum.toLocaleString('en-CA')}
              value={maxInput}
              onChange={(e) => {
                setMaxInput(e.target.value)
                setError(null)
              }}
              aria-invalid={error !== null}
              aria-describedby={helpId}
              className="h-11 pl-6 text-base tabular-nums"
            />
          </div>
          <Button type="submit" variant={leading ? 'default' : 'outline'} className="h-11 px-4">
            Review
          </Button>
        </div>
        <p id={helpId} className={cn('mt-1.5 text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
          {error ??
            `${formatPrice(minimum)} or more. We bid for you, $100 at a time, only as much as needed to keep you on top.`}
        </p>
      </form>

      <AllInPriceDetails
        price={leading ? (lot.currentBid ?? quick) : quick}
        label={leading ? 'Win at the current bid' : `Win at ${formatPrice(quick)}`}
        carProvince={province}
      />

      {canBuyNow && (
        <div className="border-t pt-4">
          <Button
            variant="secondary"
            className="h-11 w-full"
            onClick={() => setPending({ kind: 'buy-now', amount: lot.buyNowPrice! })}
          >
            <ZapIcon aria-hidden />
            Buy Now for {formatPrice(lot.buyNowPrice!)}
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Ends the auction now. Available until bidding reaches the reserve.
          </p>
        </div>
      )}
    </div>
  )
}

function ConfirmStep({
  pending,
  lot,
  province,
  onConfirm,
  onCancel,
}: {
  pending: Pending
  lot: LotState
  province: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const title = {
    quick: `Bid ${formatPrice(pending.amount)}?`,
    max: `Set your max bid to ${formatPrice(pending.amount)}?`,
    'buy-now': `Buy it now for ${formatPrice(pending.amount)}?`,
  }[pending.kind]

  const detail = {
    quick: 'This is a binding bid. If no one bids higher, you buy the vehicle at this price (if the reserve is met).',
    max:
      lot.leader === 'you'
        ? "Your current price stays the same. We'll only bid higher if someone else does."
        : `We'll bid for you, $100 at a time, up to ${formatPrice(pending.amount)}. Other bidders never see your max.`,
    'buy-now': 'This ends the auction immediately and the vehicle is yours. It cannot be undone.',
  }[pending.kind]

  return (
    <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-4" role="alertdialog" aria-labelledby="confirm-title">
      <p id="confirm-title" className="font-semibold">
        {title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      <AllInPriceSummary
        price={pending.amount}
        label={
          { quick: 'If you win at this bid', max: 'The most it can cost, at your full max', 'buy-now': "What you'll pay" }[
            pending.kind
          ]
        }
        carProvince={province}
      />
      <div className="mt-4 flex gap-2">
        <Button className="h-10 flex-1" onClick={onConfirm} autoFocus>
          Confirm
        </Button>
        <Button variant="outline" className="h-10" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/** Feedback after a bid, including the cases that surprise people. */
function announceBid(before: LotState, after: LotState) {
  const price = formatPrice(after.currentBid ?? 0)
  if (after.leader !== 'you') {
    toast.warning('Outbid right away', {
      description: `Another bidder had a higher max. The price is now ${price}.`,
    })
    return
  }
  // P24: the price jumped to the reserve because the buyer's max covers it.
  const jumpedToReserve =
    after.reservePrice !== null &&
    after.currentBid === after.reservePrice &&
    (before.currentBid ?? 0) < after.reservePrice
  const reserveNote = `Your max covers the reserve, so the price moved up to it: ${price}.`

  if (before.leader === 'you') {
    toast.success('Max bid raised', {
      description: jumpedToReserve ? reserveNote : `Your max is now ${formatPrice(after.yourMax ?? 0)}.`,
    })
    return
  }
  toast.success("You're the high bidder", {
    description: jumpedToReserve ? reserveNote : `Current bid ${price}.`,
  })
}
