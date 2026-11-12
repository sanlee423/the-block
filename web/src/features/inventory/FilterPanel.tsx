import { useId, type ReactNode } from 'react'
import { NativeSelect } from '@/components/NativeSelect'
import { buyNowAvailable, phase } from '@/domain/lot'
import type { Vehicle } from '@/domain/vehicle'
import { formatKm, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  BODY_LABELS,
  DRIVETRAIN_LABELS,
  FLAG_LABELS,
  FUEL_LABELS,
  KM_STEPS,
  MAKES,
  MODELS_BY_MAKE,
  PRICE_STEPS,
  YEARS,
} from './options'
import { ENDING_SOON_WINDOW, modelKey, type InventoryFilters, type InventoryItem } from './query'

interface Props {
  filters: InventoryFilters
  onChange: (patch: Partial<InventoryFilters>) => void
  /** Results before the filter panel is applied; option counts come from these. */
  base: InventoryItem[]
  now: number
}

/** The filter panel (P6, P31). Every change applies immediately and lands in the URL. */
export function FilterPanel({ filters: f, onChange, base, now }: Props) {
  const count = (test: (v: Vehicle) => boolean) => base.filter((i) => test(i.vehicle)).length
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  return (
    <div className="space-y-6">
      <Section title="Auction">
        <Check
          label={FLAG_LABELS.noReserve}
          checked={f.noReserve}
          onChange={() => onChange({ noReserve: !f.noReserve })}
          count={base.filter((i) => i.lot.reservePrice === null).length}
        />
        <Check
          label={FLAG_LABELS.buyNow}
          checked={f.buyNow}
          onChange={() => onChange({ buyNow: !f.buyNow })}
          count={base.filter((i) => buyNowAvailable(i.lot, now)).length}
        />
        <Check
          label={FLAG_LABELS.endingSoon}
          checked={f.endingSoon}
          onChange={() => onChange({ endingSoon: !f.endingSoon })}
          count={base.filter((i) => phase(i.lot, now) === 'live' && i.lot.endsAt - now <= ENDING_SOON_WINDOW).length}
        />
      </Section>

      <Section title="Make">
        <div className="grid grid-cols-2 gap-x-3">
          {MAKES.map((make) => (
            <Check
              key={make}
              label={make}
              checked={f.makes.includes(make)}
              onChange={() => onChange({ makes: toggle(f.makes, make) })}
              count={count((v) => v.make === make)}
            />
          ))}
        </div>
      </Section>

      {f.makes.length > 0 && (
        <Section title="Model" hint="Leave a make's models unticked to see all of them.">
          {f.makes.map((make) => (
            <div key={make} className="mb-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{make}</p>
              {MODELS_BY_MAKE[make].map((model) => {
                const key = modelKey(make, model)
                return (
                  <Check
                    key={key}
                    label={model}
                    checked={f.models.includes(key)}
                    onChange={() => onChange({ models: toggle(f.models, key) })}
                    count={count((v) => v.make === make && v.model === model)}
                  />
                )
              })}
            </div>
          ))}
        </Section>
      )}

      <Section title="Year">
        <RangeSelects
          label="Year"
          min={f.yearMin}
          max={f.yearMax}
          options={YEARS}
          format={String}
          onChange={(yearMin, yearMax) => onChange({ yearMin, yearMax })}
        />
      </Section>

      <Section title="Price" hint="Current bid, or starting bid if there are no bids.">
        <RangeSelects
          label="Price"
          min={f.priceMin}
          max={f.priceMax}
          options={PRICE_STEPS}
          format={formatPrice}
          onChange={(priceMin, priceMax) => onChange({ priceMin, priceMax })}
        />
      </Section>

      <Section title="Kilometres">
        <NativeSelect
          aria-label="Maximum kilometres"
          value={f.kmMax ?? ''}
          onChange={(e) => onChange({ kmMax: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Any</option>
          {KM_STEPS.map((km) => (
            <option key={km} value={km}>
              Up to {formatKm(km)}
            </option>
          ))}
        </NativeSelect>
      </Section>

      <CheckGroup
        title="Body style"
        labels={BODY_LABELS}
        selected={f.bodies}
        field="body_style"
        onChange={(bodies) => onChange({ bodies })}
        count={count}
      />
      <CheckGroup
        title="Drivetrain"
        labels={DRIVETRAIN_LABELS}
        selected={f.drivetrains}
        field="drivetrain"
        onChange={(drivetrains) => onChange({ drivetrains })}
        count={count}
      />
      <CheckGroup
        title="Fuel"
        labels={FUEL_LABELS}
        selected={f.fuels}
        field="fuel_type"
        onChange={(fuels) => onChange({ fuels })}
        count={count}
      />
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {hint && <p className="-mt-1 mb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  )
}

function Check({ label, checked, onChange, count }: { label: string; checked: boolean; onChange: () => void; count: number }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 py-1 text-sm pointer-coarse:py-2', count === 0 && !checked && 'text-muted-foreground')}>
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded accent-primary" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
    </label>
  )
}

function CheckGroup<K extends string>({
  title,
  labels,
  selected,
  field,
  onChange,
  count,
}: {
  title: string
  labels: Record<K, string>
  selected: K[]
  field: 'body_style' | 'drivetrain' | 'fuel_type'
  onChange: (next: K[]) => void
  count: (test: (v: Vehicle) => boolean) => number
}) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-x-3">
        {(Object.keys(labels) as K[]).map((value) => (
          <Check
            key={value}
            label={labels[value]}
            checked={selected.includes(value)}
            onChange={() => onChange(selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value])}
            count={count((v) => v[field] === value)}
          />
        ))}
      </div>
    </Section>
  )
}

function RangeSelects({
  label,
  min,
  max,
  options,
  format,
  onChange,
}: {
  label: string
  min: number | null
  max: number | null
  options: number[]
  format: (n: number) => string
  onChange: (min: number | null, max: number | null) => void
}) {
  const id = useId()
  const ascending = [...options].sort((a, b) => a - b)
  const parse = (value: string) => (value ? Number(value) : null)
  return (
    <div className="flex items-center gap-2">
      {/* Picking a "from" above the "to" (or vice versa) moves the other end to match. */}
      <NativeSelect
        id={`${id}-min`}
        aria-label={`${label} from`}
        value={min ?? ''}
        onChange={(e) => {
          const next = parse(e.target.value)
          onChange(next, max !== null && next !== null && next > max ? next : max)
        }}
      >
        <option value="">Any</option>
        {ascending.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </NativeSelect>
      <span className="text-sm text-muted-foreground">to</span>
      <NativeSelect
        id={`${id}-max`}
        aria-label={`${label} to`}
        value={max ?? ''}
        onChange={(e) => {
          const next = parse(e.target.value)
          onChange(min !== null && next !== null && next < min ? next : min, next)
        }}
      >
        <option value="">Any</option>
        {ascending.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </NativeSelect>
    </div>
  )
}
