import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react'
import { useMemo } from 'react'
import { LotGrid } from '@/components/LotGrid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { vehicles } from '@/domain/vehicles'
import { FilterPanel } from '@/features/inventory/FilterPanel'
import { filterChips } from '@/features/inventory/options'
import { useInventoryQuery } from '@/features/inventory/useInventoryQuery'
import {
  activeFilterCount,
  baseResults,
  NO_FILTERS,
  DEFAULT_QUERY,
  runQuery,
  SORT_OPTIONS,
  STATUS_OPTIONS,
  updateFilters,
  type InventoryFilters,
  type SortOption,
} from '@/features/inventory/query'
import { cn } from '@/lib/utils'
import { useAuctionState, useNow } from '@/state/auction-store'

export function InventoryPage() {
  const [query, setQuery] = useInventoryQuery()
  const { lots } = useAuctionState()
  const now = useNow()

  const items = useMemo(() => vehicles.map((vehicle) => ({ vehicle, lot: lots[vehicle.lot] })), [lots])
  const base = useMemo(() => baseResults(items, query, now), [items, query, now])
  const results = useMemo(() => runQuery(items, query, now), [items, query, now])

  const setFilters = (patch: Partial<InventoryFilters>) => setQuery({ filters: updateFilters(query.filters, patch) })

  const filterCount = activeFilterCount(query.filters)
  const chips = filterChips(query.filters)
  const isNarrowed = query.q !== '' || query.status !== 'active' || filterCount > 0

  return (
    <section aria-labelledby="inventory-heading">
      <h1 id="inventory-heading" className="sr-only">
        Inventory
      </h1>

      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex lg:w-[26rem]">
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query.q}
              onChange={(e) => setQuery({ q: e.target.value }, true)}
              placeholder="Search make, model, lot #, VIN, dealer…"
              aria-label="Search inventory"
              className="pl-8"
            />
          </div>

        </div>

        <div role="group" aria-label="Auction status" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={query.status === o.value}
              onClick={() => setQuery({ status: o.value })}
              className={cn(
                'flex-1 shrink-0 rounded-md px-2 py-1 text-sm pointer-coarse:py-2 max-[359px]:px-1.5 max-[359px]:text-xs max-[319px]:px-1 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground sm:px-3 lg:flex-none',
                query.status === o.value && 'bg-background text-foreground shadow-sm',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Wraps on very narrow phones: the count goes above Filters and Sort instead of pushing them off screen. */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 lg:ml-auto">
          <p className="text-sm whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
            {results.length} {results.length === 1 ? 'vehicle' : 'vehicles'}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="h-9 shrink-0">
                  <SlidersHorizontalIcon aria-hidden />
                  Filters
                  {filterCount > 0 && (
                    <span className="ml-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-foreground tabular-nums">
                      {filterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full gap-0 sm:max-w-sm">
                <SheetHeader className="border-b">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Changes apply as you go.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto p-4">
                  <FilterPanel filters={query.filters} onChange={setFilters} base={base} now={now} />
                </div>
                <SheetFooter className="flex-row border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={filterCount === 0}
                    onClick={() => setQuery({ filters: NO_FILTERS })}
                  >
                    Clear all
                  </Button>
                  <SheetClose asChild>
                    <Button className="flex-1">
                      Show {results.length} {results.length === 1 ? 'vehicle' : 'vehicles'}
                    </Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            <Select value={query.sort} onValueChange={(v) => setQuery({ sort: v as SortOption })}>
              <SelectTrigger className="w-36 max-[359px]:w-32 sm:w-48" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {chips.length > 0 && (
        <ul className="mb-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.label}>
              <button
                type="button"
                onClick={() => setFilters(chip.remove)}
                className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1.5 pl-2.5 text-xs hover:bg-muted"
                aria-label={`Remove filter: ${chip.label}`}
              >
                {chip.label}
                <XIcon className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => setQuery({ filters: NO_FILTERS })}
              className="text-xs text-primary hover:underline"
            >
              Clear all
            </button>
          </li>
        </ul>
      )}

      {results.length > 0 ? (
        <LotGrid items={results} now={now} className={cn(chips.length === 0 && 'mt-4')} />
      ) : (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="font-medium">No vehicles match</p>
          <p className="mt-1 text-sm text-muted-foreground">Try removing a filter or changing the auction status.</p>
          {isNarrowed && (
            <Button variant="outline" className="mt-4" onClick={() => setQuery(DEFAULT_QUERY)}>
              Clear search and filters
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
