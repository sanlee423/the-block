import { BellIcon, CircleAlertIcon, MessageSquareReplyIcon, TimerIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Notification } from '@/domain/notifications'
import { vehicleTitle } from '@/domain/vehicle'
import { vehiclesByLot } from '@/domain/vehicles'
import { formatAgo, formatPrice } from '@/lib/format'
import { cn } from '@/lib/utils'
import { auction, useNotifications, useNow } from '@/state/auction-store'

/** P42: the bell in the header, with an unread count and the notification history. */
export function NotificationBell() {
  const notifications = useNotifications()
  const now = useNow()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const unread = notifications.filter((n) => !n.read).length

  function openNotification(n: Notification) {
    auction.markRead(n.id)
    setOpen(false)
    navigate(`/lot/${n.lot}${n.kind === 'answer' ? '#questions-heading' : ''}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <BellIcon aria-hidden />
          <span className="sr-only">Notifications{unread > 0 ? `, ${unread} unread` : ''}</span>
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 grid min-w-4.5 place-items-center rounded-full bg-destructive px-1 text-[10px] leading-4.5 font-semibold text-white tabular-nums"
              aria-hidden
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={unread === 0}
            onClick={() => auction.markRead()}
          >
            Mark all as read
          </Button>
        </div>
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing yet. We'll let you know when you're outbid, a watched car is about to end, or a seller answers you.
          </p>
        ) : (
          <ul className="max-h-[min(24rem,60vh)] overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={n} now={now} onOpen={() => openNotification(n)} />
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

function NotificationRow({ notification: n, now, onOpen }: { notification: Notification; now: number; onOpen: () => void }) {
  const vehicle = vehiclesByLot.get(n.lot)
  const car = vehicle ? vehicleTitle(vehicle) : `Lot ${n.lot}`
  const content = {
    outbid: { icon: CircleAlertIcon, tone: 'text-destructive', title: "You've been outbid", body: `${car} is now ${n.kind === 'outbid' ? formatPrice(n.currentBid) : ''}` },
    'ending-soon': { icon: TimerIcon, tone: 'text-warning', title: 'Ending in 5 minutes', body: `${car}, on your watchlist` },
    answer: { icon: MessageSquareReplyIcon, tone: 'text-primary', title: 'The seller answered your question', body: car },
  }[n.kind]
  const Icon = content.icon

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full gap-2.5 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
        !n.read && 'bg-primary/5',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', content.tone)} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className={cn('block', !n.read && 'font-semibold')}>{content.title}</span>
        <span className="block truncate text-muted-foreground">{content.body}</span>
        <span className="block text-xs text-muted-foreground">{formatAgo(now - n.at)}</span>
      </span>
      {!n.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
          <span className="sr-only">Unread</span>
        </span>
      )}
    </button>
  )
}
