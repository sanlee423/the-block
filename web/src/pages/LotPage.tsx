import { ArrowLeftIcon } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { WatchButton } from '@/components/WatchButton'
import { diagnose } from '@/domain/diagnostics'
import { vehicleTitle } from '@/domain/vehicle'
import { vehiclesByLot } from '@/domain/vehicles'
import { BidBox } from '@/features/lot/BidBox'
import { ConditionSection } from '@/features/lot/ConditionSection'
import { DiagnosticsSection } from '@/features/lot/DiagnosticsSection'
import { diagnosticsSummary } from '@/features/lot/diagnostics-labels'
import { GuaranteeBadge } from '@/features/guarantee/GuaranteeBadge'
import { Gallery } from '@/features/lot/Gallery'
import { MobileBidBar } from '@/features/lot/MobileBidBar'
import { MarketSection } from '@/features/market/MarketSection'
import { QuestionsSection } from '@/features/questions/QuestionsSection'
import { GradePopover } from '@/features/lot/GradeInfo'
import { SellerSection, SpecsSection } from '@/features/lot/SpecsSection'
import { formatKm, formatLocation } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useLot, useNow } from '@/state/auction-store'
import { NotFoundPage } from './NotFoundPage'

/**
 * Vehicle detail (P13): title and key condition facts first, then photos,
 * the bid box, the full condition report, specs and seller.
 */
export function LotPage() {
  const { lot: lotId = '' } = useParams()
  const vehicle = vehiclesByLot.get(lotId)
  const lot = useLot(lotId)
  const now = useNow()
  const diagnostics = useMemo(() => (vehicle ? diagnose(vehicle) : null), [vehicle])
  if (!vehicle || !lot || !diagnostics) return <NotFoundPage />

  const title = vehicleTitle(vehicle)
  const branded = vehicle.title_status !== 'clean'

  // Bottom padding on phones and tablets so the bid bar never covers the end of the page.
  return (
    <article className="mx-auto max-w-6xl pb-20 lg:pb-0">
      <BackLink />

      <header className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Lot {vehicle.lot} · {formatLocation(vehicle.city, vehicle.province)}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        </div>
        <WatchButton lot={vehicle.lot} label={title} className="mt-1 size-10 shrink-0 border shadow-none" />
      </header>

      {/* Key facts strip: condition and the specs dealers check first, above the fold (P13). */}
      <ul className="mt-3 flex flex-wrap gap-2 text-sm">
        <li>
          <GradePopover grade={vehicle.condition_grade} damageNotes={vehicle.damage_notes.length} />
        </li>
        <Fact className={cn(branded && 'bg-warning/15 text-warning')}>
          {branded ? `${vehicle.title_status === 'rebuilt' ? 'Rebuilt' : 'Salvage'} title` : 'Clean title'}
        </Fact>
        <li>
          <GuaranteeBadge vehicle={vehicle} />
        </li>
        <Fact>
          {vehicle.damage_notes.length} damage {vehicle.damage_notes.length === 1 ? 'note' : 'notes'}
        </Fact>
        <li>
          <a
            href="#diagnostics-heading"
            className="inline-block rounded-md bg-muted px-2 py-1 hover:bg-muted/70 pointer-coarse:py-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {diagnosticsSummary(diagnostics)}
          </a>
        </li>
        <Fact>{formatKm(vehicle.odometer_km)}</Fact>
        <Fact>{vehicle.drivetrain}</Fact>
        <Fact>{vehicle.engine}</Fact>
      </ul>

      {/*
        One grid, each section rendered once. Phones: photos, bid box, condition, specs, seller.
        Desktop: the bid box moves to a sticky right column next to everything else.
      */}
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="lg:col-start-1 lg:row-start-1">
          <Gallery images={vehicle.images} title={title} />
        </div>
        <div className="lg:sticky lg:top-20 lg:col-start-2 lg:row-span-7 lg:row-start-1 lg:self-start">
          <BidBox vehicle={vehicle} lot={lot} now={now} />
        </div>
        <div className="lg:col-start-1 lg:row-start-2">
          <ConditionSection vehicle={vehicle} />
        </div>
        <div className="lg:col-start-1 lg:row-start-3">
          <DiagnosticsSection diagnostics={diagnostics} />
        </div>
        <div className="lg:col-start-1 lg:row-start-4">
          <MarketSection vehicle={vehicle} lot={lot} now={now} />
        </div>
        <div className="lg:col-start-1 lg:row-start-5">
          <SpecsSection vehicle={vehicle} />
        </div>
        <div className="lg:col-start-1 lg:row-start-6">
          <SellerSection vehicle={vehicle} />
        </div>
        <div className="lg:col-start-1 lg:row-start-7">
          <QuestionsSection vehicle={vehicle} lot={lot} now={now} />
        </div>
      </div>
      <MobileBidBar lot={lot} now={now} />
    </article>
  )
}

function Fact({ children, strong, className }: { children: ReactNode; strong?: boolean; className?: string }) {
  return (
    <li className={cn('rounded-md bg-muted px-2 py-1 pointer-coarse:py-1.5', strong && 'font-semibold', className)}>{children}</li>
  )
}

/** Goes back to the previous page (keeping the inventory search), or to the inventory if opened directly. */
function BackLink() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasHistory = location.key !== 'default'
  return (
    <Link
      to="/"
      onClick={(e) => {
        if (hasHistory) {
          e.preventDefault()
          navigate(-1)
        }
      }}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:-my-2 pointer-coarse:py-2"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      Back to inventory
    </Link>
  )
}
