import { FlaskConicalIcon } from 'lucide-react'
import { useMemo } from 'react'
import { phase, type LotState } from '@/domain/lot'
import { MARKET, modelPriceTrend } from '@/domain/market'
import type { Vehicle } from '@/domain/vehicle'
import { vehicles } from '@/domain/vehicles'
import { formatPrice } from '@/lib/format'
import { DEAL_LABELS, dealFor, differenceText } from './deal'
import { DealIcon } from './DealIcon'
import { PriceTrendChart } from './PriceTrendChart'

const pct = (n: number) => `${Math.round(Math.abs(n - 1) * 100)}%`

/** P36 and P37: the deal rating in full, and the model's 12-month price trend. */
export function MarketSection({ vehicle, lot, now }: { vehicle: Vehicle; lot: LotState; now: number }) {
  const deal = dealFor(vehicle, lot, now)
  // The trend is per make and model, and only changes when the month does.
  const d = new Date(now)
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  const trend = useMemo(
    () => modelPriceTrend(vehicle.make, vehicle.model, vehicles, monthStart),
    [vehicle.make, vehicle.model, monthStart],
  )
  const priceLabel = phase(lot, now) === 'ended' ? 'final price' : lot.currentBid === null ? 'starting bid' : 'current bid'

  return (
    <section aria-labelledby="market-heading" className="scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="market-heading" className="text-lg font-semibold">
          Price check
        </h2>
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <FlaskConicalIcon className="size-3.5" aria-hidden />
          Estimates, demo data
        </p>
      </div>

      {deal ? (
        <div className="mt-4 flex items-start gap-3">
          <DealIcon rating={deal.rating} size="md" labelled />
          <div>
            <p className="font-semibold">{DEAL_LABELS[deal.rating]}</p>
            <p className="text-sm text-muted-foreground">
              The {priceLabel} of {formatPrice(deal.price)} is {differenceText(deal.percent)} the estimated value of{' '}
              <span className="font-medium text-foreground">{formatPrice(deal.value)}</span>.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Didn't sell, so there's no price to rate.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Low is more than {pct(MARKET.lowBelow)} under the estimate, High more than {pct(MARKET.highAbove)} over it. The
        estimate is based on the year, km, grade and title. The rating updates as bids come in.
      </p>

      {trend.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-medium">
            {vehicle.make} {vehicle.model}: average sale price, last 12 months
          </h3>
          <p className="text-xs text-muted-foreground">All trims and years</p>
          <PriceTrendChart
            points={trend}
            thisCar={deal?.price ?? lot.currentBid ?? lot.startingBid}
            label={`${vehicle.make} ${vehicle.model} average sale price, last 12 months`}
          />
        </div>
      )}
    </section>
  )
}
