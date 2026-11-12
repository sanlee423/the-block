import { ChevronDownIcon } from 'lucide-react'
import { useId } from 'react'
import { NativeSelect } from '@/components/NativeSelect'
import { allInPrice, BUYER_FEE_BANDS, isProvince, PROVINCE_NAMES, PROVINCES, type AllInPrice } from '@/domain/fees'
import { formatPrice } from '@/lib/format'
import { auction, useDeliverTo } from '@/state/auction-store'

/**
 * P39: what winning at `price` really costs: bid + buyer fee + transport.
 * Collapsed to one line; opens to the breakdown and the "Deliver to" picker.
 */
export function AllInPriceDetails({ price, label, carProvince }: { price: number; label: string; carProvince: string }) {
  const deliverTo = useDeliverTo()
  const cost = allInPrice(price, carProvince, deliverTo)
  const selectId = useId()

  return (
    <details className="group rounded-lg border bg-muted/40 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="text-muted-foreground">{label}: </span>
          <span className="font-semibold tabular-nums">{formatPrice(cost.total)} all-in</span>
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="border-t px-3 pt-2 pb-3">
        <Breakdown cost={cost} carProvince={carProvince} deliverTo={PROVINCES[deliverTo].code} />
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor={selectId} className="shrink-0 text-muted-foreground">
            Deliver to
          </label>
          <NativeSelect
            id={selectId}
            value={deliverTo}
            onChange={(e) => isProvince(e.target.value) && auction.setDeliverTo(e.target.value)}
          >
            {PROVINCE_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <FeeTable />
      </div>
    </details>
  )
}

/** The same breakdown, always open, for the confirm step. */
export function AllInPriceSummary({ price, label, carProvince }: { price: number; label: string; carProvince: string }) {
  const deliverTo = useDeliverTo()
  const cost = allInPrice(price, carProvince, deliverTo)
  return (
    <div className="mt-3 rounded-md bg-background/70 px-3 py-2 text-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Breakdown cost={cost} carProvince={carProvince} deliverTo={PROVINCES[deliverTo].code} />
    </div>
  )
}

function Breakdown({ cost, carProvince, deliverTo }: { cost: AllInPrice; carProvince: string; deliverTo: string }) {
  const from = isProvince(carProvince) ? PROVINCES[carProvince].code : carProvince
  return (
    <dl className="space-y-1 tabular-nums">
      <Row term="Price" value={formatPrice(cost.price)} />
      <Row term="Buyer fee" value={formatPrice(cost.fee)} />
      <Row term={`Transport ${from} → ${deliverTo} (estimate)`} value={formatPrice(cost.transport)} />
      <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
        <dt>Total</dt>
        <dd>{formatPrice(cost.total)}</dd>
      </div>
      <p className="text-xs text-muted-foreground">Plus applicable taxes.</p>
    </dl>
  )
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{term}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function FeeTable() {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline">How fees work</summary>
      <table className="mt-2 w-full tabular-nums">
        <caption className="sr-only">Buyer fee by sale price</caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="font-normal">Sale price</th>
            <th className="text-right font-normal">Buyer fee</th>
          </tr>
        </thead>
        <tbody>
          {BUYER_FEE_BANDS.map((band, i) => {
            const next = BUYER_FEE_BANDS[i + 1]
            const range = next ? `${formatPrice(band.from)}–${formatPrice(next.from - 1)}` : `${formatPrice(band.from)}+`
            return (
              <tr key={band.from}>
                <td>{range}</td>
                <td className="text-right">{formatPrice(band.fee)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        Transport is estimated from the distance between provinces. Demo figures, not real rates.
      </p>
    </details>
  )
}
