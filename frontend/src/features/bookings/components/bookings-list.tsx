import {
  Building2,
  CalendarCheck,
  CalendarDays,
  CircleAlert,
  History,
  Inbox,
  Loader2,
  type LucideIcon,
  Search,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { EmptyState, emptyStateAction } from '@/components/feedback/empty-state'
import { StatusNotice } from '@/components/feedback/status-notice'
import { HeroPanel } from '@/components/layout/hero-panel'
import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MAX_PAGE_SIZE } from '@/lib/api-client'
import { useActiveIndicator } from '@/lib/use-active-indicator'

import { useBookings } from '../api/use-bookings'
import {
  type BookingTab,
  type BookingView,
  VIEW_TABS,
  splitBookings,
  useBookingTab,
} from '../hooks/use-booking-tabs'
import type { Booking } from '../types'
import { BookingCard } from './booking-card'

type BookingsListProps = {
  // guest: My bookings (the user's own bookings); host: Reservations (the bookings of the user's spaces)
  view: BookingView
  userId: number
  // The page title (the route's PageTitle), shown in the hero panel above the tabs
  title: ReactNode
}

type EmptyCopy = { icon: LucideIcon; title: string; text: string }

const TAB_LABELS: Record<BookingTab, string> = {
  pending: 'Pending',
  upcoming: 'Upcoming',
  past: 'Past & cancelled',
}

const exploreSpaces = (
  <Button asChild className={emptyStateAction}>
    <Link to="/spaces">
      <Search aria-hidden="true" />
      Explore spaces
    </Link>
  </Button>
)

const mySpaces = (
  <Button asChild className={emptyStateAction}>
    <Link to="/host/spaces">
      <Building2 aria-hidden="true" />
      Go to My spaces
    </Link>
  </Button>
)

const COPY: Record<
  BookingView,
  {
    label: string
    loading: string
    failed: string
    empty: EmptyCopy & { action: ReactNode }
    tabs: Partial<Record<BookingTab, EmptyCopy & { action?: ReactNode }>>
  }
> = {
  guest: {
    label: 'Bookings',
    loading: 'Loading your bookings…',
    failed: 'Your bookings failed to load.',
    empty: {
      icon: CalendarDays,
      title: 'You have no bookings yet',
      text: 'Find a desk, a meeting room or a hall and book your first hours.',
      action: exploreSpaces,
    },
    tabs: {
      upcoming: {
        icon: CalendarDays,
        title: 'No upcoming bookings',
        text: 'Find a space for your next work day.',
        action: exploreSpaces,
      },
      past: {
        icon: History,
        title: 'Nothing here yet',
        text: 'Finished, declined and cancelled bookings show up here.',
      },
    },
  },
  host: {
    label: 'Reservations',
    loading: 'Loading reservations…',
    failed: 'Reservations failed to load.',
    empty: {
      icon: CalendarCheck,
      title: 'No reservations yet',
      text: 'When guests book one of your spaces, their requests show up here for you to approve.',
      action: mySpaces,
    },
    tabs: {
      pending: {
        icon: Inbox,
        title: 'All caught up',
        text: 'New booking requests show up here for you to approve or decline.',
      },
      upcoming: {
        icon: CalendarDays,
        title: 'No upcoming reservations',
        text: 'Bookings you approve show up here until their day comes.',
      },
      past: {
        icon: History,
        title: 'Nothing here yet',
        text: 'Finished, declined and cancelled bookings show up here.',
      },
    },
  },
}

const grid = 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'
const fadeIn = 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300'

// Bookings in tabs with loading, empty and error states: the guest's own (Upcoming, Past & cancelled)
// or, for a host, those of their spaces (Pending, Upcoming, Past & cancelled). The title and the tabs
// share the hero panel; the panel stays in place in every state, so the title never remounts. The tab
// underline slides to the open tab, and the cards fade in, one after another along a row.
export function BookingsList({ view, userId, title }: BookingsListProps) {
  // Every booking at once, so the tabs can split and count them. The backend sorts earliest first, so
  // past MAX_PAGE_SIZE the latest ones, Upcoming and Pending, are left out, not the past ones
  // (docs/follow-ups.md, "lists capped at 500").
  const {
    data: page,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useBookings(view === 'guest' ? { guestId: userId } : { hostId: userId }, { size: MAX_PAGE_SIZE })
  const bookings = page?.items
  const copy = COPY[view]
  const [tab, setTab] = useBookingTab(view)
  const [tabList, setTabList] = useState<HTMLDivElement | null>(null)
  const underline = useActiveIndicator(tabList, '[data-state="active"]', tab)

  // A cancelled (guest) or approved / declined (host) booking leaves the open tab with its button: once
  // the refetched list no longer has it there, focus moves to the tab panel. The guest's cancel is
  // announced in the status notice; the host's actions in a toast.
  const panelRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const [movedId, setMovedId] = useState<number | null>(null)

  const onCancelled = (booking: Booking) => {
    setAnnouncement(
      `Your booking at ${booking.space.name} was cancelled. You can find it under Past & cancelled.`,
    )
    setMovedId(booking.id)
  }
  const onReviewed = (booking: Booking) => setMovedId(booking.id)

  const byTab = splitBookings(bookings ?? [], view)
  const movedOut = movedId !== null && bookings !== undefined && !byTab[tab].some((b) => b.id === movedId)
  useEffect(() => {
    if (!movedOut) return
    // In a timeout: after Radix has tried to give focus back to the (now removed) trigger
    const timer = setTimeout(() => {
      panelRef.current?.focus()
      setMovedId(null)
    })
    return () => clearTimeout(timer)
  }, [movedOut])

  // Phones: the tab row scrolls sideways (three tabs do not fit at 375px), so the open tab is scrolled into
  // view, also when the page opens on ?tab=past. Only the row scrolls, never the page; the 16px edge
  // matches the row's padding.
  useEffect(() => {
    const scroller = tabList?.parentElement
    const active = tabList?.querySelector<HTMLElement>('[data-state="active"]')
    if (!scroller || !active) return
    const row = scroller.getBoundingClientRect()
    const box = active.getBoundingClientRect()
    const edge = 16
    if (box.left < row.left + edge) scroller.scrollBy({ left: box.left - row.left - edge })
    else if (box.right > row.right - edge) scroller.scrollBy({ left: box.right - row.right + edge })
  }, [tab, tabList])

  // Error first: a retry keeps the error block (and the focused "Try again" button) on screen
  const state = error
    ? 'error'
    : isLoading || !bookings
      ? 'loading'
      : bookings.length === 0
        ? 'empty'
        : 'ready'

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6 md:gap-8">
      <HeroPanel>
        {title}
        {state === 'loading' && <Skeleton className="h-9 w-56 rounded-full" />}
        {state === 'ready' && (
          // Phones: the row scrolls sideways, edge to edge of the panel; py-1 leaves room for the focus ring.
          // overflow-x also clips vertically, so the list grows to its triggers (shadcn's h-9 is replaced
          // under the same group variant, or a plain h-auto loses to it) and nothing scrolls up and down.
          <div className="-mx-4 -my-1 overflow-x-auto px-4 py-1 motion-safe:scroll-smooth md:mx-0 md:overflow-visible md:px-0">
            <TabsList
              ref={setTabList}
              variant="line"
              className="relative gap-6 border-b py-0 group-data-[orientation=horizontal]/tabs:h-auto"
              aria-label={copy.label}
            >
              {underline && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-primary transition-[translate,width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ translate: `${underline.x}px 0`, width: underline.width }}
                />
              )}
              {VIEW_TABS[view].map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="h-11 flex-none rounded-none px-1 pb-3 text-base text-muted-foreground after:hidden hover:text-foreground focus-visible:rounded-sm focus-visible:ring-ring data-[state=active]:font-semibold data-[state=active]:text-primary md:h-9 dark:data-[state=active]:text-primary"
                >
                  {TAB_LABELS[value]}
                  {/* The card-colored ring outlines the pill where it sits on the panel's pale-blue circle
                    (phones, three tabs); on the card itself it does not show */}
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground ring-2 ring-card">
                    {byTab[value].length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        )}
      </HeroPanel>

      {state === 'error' && (
        <div
          role="alert"
          className={`flex flex-col items-start gap-4 rounded-lg border bg-card p-6 text-destructive ${fadeIn}`}
        >
          <p className="flex items-center gap-2">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {copy.failed}
          </p>
          <Button
            variant="outline"
            className="h-11 rounded-full bg-transparent text-foreground hover:bg-accent focus-visible:ring-ring md:h-9"
            aria-disabled={isFetching}
            onClick={() => {
              if (!isFetching) void refetch()
            }}
          >
            {isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isFetching ? 'Trying…' : 'Try again'}
          </Button>
        </div>
      )}

      {state === 'loading' && (
        <div aria-busy="true" className={`${grid} ${fadeIn}`}>
          <span className="sr-only">{copy.loading}</span>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-4 rounded-lg border bg-card pb-4">
              <Skeleton className="aspect-[16/10] w-full rounded-lg" />
              <div className="flex flex-col gap-3 px-4">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {state === 'empty' && (
        <div className={fadeIn}>
          <EmptyState
            icon={copy.empty.icon}
            title={copy.empty.title}
            text={copy.empty.text}
            action={copy.empty.action}
          />
        </div>
      )}

      {state === 'ready' && (
        <>
          <StatusNotice notice={announcement || null} />
          {VIEW_TABS[view].map((value) => {
            const empty = copy.tabs[value]
            return (
              <TabsContent
                key={value}
                value={value}
                ref={value === tab ? panelRef : undefined}
                tabIndex={-1}
                className={`rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-sheet md:focus-visible:ring-offset-background ${fadeIn}`}
              >
                {byTab[value].length === 0 && empty ? (
                  <EmptyState icon={empty.icon} title={empty.title} text={empty.text} action={empty.action} />
                ) : (
                  <ul className={grid}>
                    {byTab[value].map((booking, index) => (
                      <li key={booking.id}>
                        <Reveal delay={(index % 3) * 90} className="h-full">
                          <BookingCard
                            booking={booking}
                            variant={view}
                            onCancelled={onCancelled}
                            onReviewed={onReviewed}
                          />
                        </Reveal>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            )
          })}
        </>
      )}
    </Tabs>
  )
}
