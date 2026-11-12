import { RotateCcwIcon } from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { OutbidBadge } from '@/components/OutbidBadge'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/NotificationBell'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { vehicleTitle } from '@/domain/vehicle'
import { vehiclesByLot } from '@/domain/vehicles'
import { formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { auction } from '@/state/auction-store'

const navItems = [
  { to: '/', label: 'Inventory', end: true },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/my-bids', label: 'My bids', badge: <OutbidBadge /> },
]

export function AppLayout() {
  useOutbidToasts()
  useClaimToasts()
  useAnswerToasts()
  useEndingSoonToasts()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-6 px-4 sm:h-14 sm:flex-nowrap">
            <NavLink to="/" className="flex h-12 shrink-0 items-center text-lg font-semibold tracking-tight sm:h-auto">
              The Block
            </NavLink>
            {/* On phones the nav drops to its own row under the wordmark. */}
            <nav className="order-last -mx-1 flex w-full gap-1 overflow-x-auto pb-2 text-sm sm:order-none sm:mx-0 sm:w-auto sm:pb-0">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex shrink-0 items-center rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground',
                      isActive && 'bg-secondary text-foreground',
                    )
                  }
                >
                  {item.label}
                  {item.badge}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NotificationBell />
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground pointer-coarse:size-9"
                onClick={() => {
                  if (window.confirm('Reset the demo? This clears your bids, watchlist and notifications and restarts every auction.')) {
                    auction.reset()
                    toast('Demo reset')
                  }
                }}
              >
                <RotateCcwIcon aria-hidden />
                <span className="hidden sm:inline">Reset demo</span>
                <span className="sr-only sm:hidden">Reset demo</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-screen-2xl px-4 py-6">
          <Outlet />
        </main>
        {/* Top right, just under the sticky header. --header-height (index.css) follows the header's breakpoint. */}
        <Toaster
          position="top-right"
          offset={{ top: 'calc(var(--header-height) + 12px)', right: 16 }}
          mobileOffset={{ top: 'calc(var(--header-height) + 12px)', left: 16, right: 16 }}
        />
        <ScrollRestoration />
      </div>
    </TooltipProvider>
  )
}

/** P42: warn when a watched lot is 5 minutes from ending. */
function useEndingSoonToasts() {
  const navigate = useNavigate()
  useEffect(
    () =>
      auction.onEvent((event) => {
        if (event.type !== 'ending-soon') return
        const vehicle = vehiclesByLot.get(event.lot)
        toast.warning('Ending in 5 minutes', {
          id: `ending-${event.lot}`,
          duration: 10_000,
          description: `${vehicle ? vehicleTitle(vehicle) : `Lot ${event.lot}`}, on your watchlist`,
          action: { label: 'View', onClick: () => navigate(`/lot/${event.lot}`) },
        })
      }),
    [navigate],
  )
}

/** P40: tell the buyer when a seller answers their question. */
function useAnswerToasts() {
  const navigate = useNavigate()
  useEffect(
    () =>
      auction.onEvent((event) => {
        if (event.type !== 'question-answered') return
        const vehicle = vehiclesByLot.get(event.lot)
        toast('The seller answered your question', {
          id: `answer-${event.questionId}`,
          description: vehicle ? vehicleTitle(vehicle) : `Lot ${event.lot}`,
          action: { label: 'View', onClick: () => navigate(`/lot/${event.lot}#questions-heading`) },
        })
      }),
    [navigate],
  )
}

/** P35: tell the buyer when a claim review finishes, wherever they are in the app. */
function useClaimToasts() {
  const navigate = useNavigate()
  useEffect(
    () =>
      auction.onEvent((event) => {
        if (event.type !== 'claim-decided') return
        const vehicle = vehiclesByLot.get(event.lot)
        const show = event.status === 'approved' ? toast.success : toast.error
        show(event.status === 'approved' ? 'Claim approved' : 'Claim denied', {
          id: `claim-${event.claimId}`,
          duration: 10_000,
          description: `${vehicle ? vehicleTitle(vehicle) : `Lot ${event.lot}`}. See the reason on the car's page.`,
          action: { label: 'View', onClick: () => navigate(`/lot/${event.lot}`) },
        })
      }),
    [navigate],
  )
}

/** P16: tell the buyer when a rival outbids them, wherever they are in the app. */
function useOutbidToasts() {
  const navigate = useNavigate()
  useEffect(
    () =>
      auction.onEvent((event) => {
        if (event.type !== 'outbid') return
        const vehicle = vehiclesByLot.get(event.lot)
        toast.error("You've been outbid", {
          id: `outbid-${event.lot}`,
          // Needs action before the auction ends, so it stays longer than the 4 s default.
          duration: 10_000,
          description: `${vehicle ? vehicleTitle(vehicle) : `Lot ${event.lot}`} is now ${formatPrice(event.currentBid)}`,
          action: { label: 'View', onClick: () => navigate(`/lot/${event.lot}`) },
        })
      }),
    [navigate],
  )
}
