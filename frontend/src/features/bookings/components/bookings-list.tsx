import { CalendarDays, CircleAlert, History, Loader2, type LucideIcon, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState, emptyStateAction } from '@/components/feedback/empty-state'
import { StatusNotice } from '@/components/feedback/status-notice'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Booking, isActive } from '@/lib/booking'

import { useBookings } from '../api/use-bookings'
import { type BookingTab, splitBookings, useBookingTab } from '../hooks/use-booking-tabs'
import { BookingCard } from './booking-card'

type BookingsListProps = {
  guestId: number
  // Cover photo per space id, joined in by the route (the bookings feature does not load spaces).
  // undefined while the spaces load; a space missing from the map shows a placeholder.
  spaceImages?: Map<number, string>
}

const TABS: { value: BookingTab; label: string; empty: { icon: LucideIcon; title: string; text: string } }[] =
  [
    {
      value: 'upcoming',
      label: 'Upcoming',
      empty: {
        icon: CalendarDays,
        title: 'No upcoming bookings',
        text: 'Find a space for your next work day.',
      },
    },
    {
      value: 'past',
      label: 'Past',
      empty: {
        icon: History,
        title: 'Nothing here yet',
        text: 'Finished and cancelled bookings show up here.',
      },
    },
  ]

const exploreSpaces = (
  <Button asChild className={emptyStateAction}>
    <Link to="/spaces">
      <Search aria-hidden="true" />
      Explore spaces
    </Link>
  </Button>
)

// The guest's bookings in two tabs, Upcoming and Past, with loading, empty and error states.
export function BookingsList({ guestId, spaceImages }: BookingsListProps) {
  const { data: bookings, isLoading, error, refetch, isFetching } = useBookings({ guestId })
  const [tab, setTab] = useBookingTab()

  // A cancelled booking leaves Upcoming with its button: once the refetched list no longer has it
  // there, focus moves to the tab panel and the result is announced.
  const panelRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const [cancelledId, setCancelledId] = useState<number | null>(null)

  const onCancelled = (booking: Booking) => {
    setAnnouncement(`Your booking at ${booking.space.name} was cancelled. You can find it under Past.`)
    setCancelledId(booking.id)
  }

  const cancelledLeftUpcoming =
    cancelledId !== null &&
    bookings !== undefined &&
    !bookings.some((b) => b.id === cancelledId && isActive(b.status))
  useEffect(() => {
    if (!cancelledLeftUpcoming) return
    // In a timeout: after Radix has tried to give focus back to the (now removed) trigger
    const timer = setTimeout(() => {
      panelRef.current?.focus()
      setCancelledId(null)
    })
    return () => clearTimeout(timer)
  }, [cancelledLeftUpcoming])

  // Error first: a retry keeps the error block (and the focused "Try again" button) on screen
  if (error) {
    return (
      <div
        role="alert"
        className="mt-8 flex flex-col items-start gap-4 rounded-lg border bg-card p-6 text-destructive"
      >
        <p className="flex items-center gap-2">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          Your bookings failed to load.
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
    )
  }

  if (isLoading || !bookings) {
    return (
      <div aria-busy="true" className="mt-8 flex flex-col gap-6">
        <span className="sr-only">Loading your bookings…</span>
        <Skeleton className="h-9 w-56 rounded-full" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
      </div>
    )
  }

  if (bookings.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={CalendarDays}
          title="You have no bookings yet"
          text="Find a desk, a meeting room or a hall and book your first hours."
          action={exploreSpaces}
        />
      </div>
    )
  }

  const byTab = splitBookings(bookings)

  return (
    <Tabs value={tab} onValueChange={setTab} className="mt-6 gap-6">
      <StatusNotice notice={announcement || null} />
      <TabsList variant="line" className="h-auto gap-6 border-b pb-0" aria-label="Bookings">
        {TABS.map(({ value, label }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="h-11 flex-none rounded-none px-1 pb-3 text-base text-muted-foreground after:bottom-[-1px] after:bg-primary hover:text-foreground focus-visible:rounded-sm focus-visible:ring-ring data-[state=active]:font-semibold data-[state=active]:text-primary md:h-9 dark:data-[state=active]:text-primary"
          >
            {label}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              {byTab[value].length}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {TABS.map(({ value, empty }) => (
        <TabsContent
          key={value}
          value={value}
          ref={value === 'upcoming' ? panelRef : undefined}
          tabIndex={-1}
          className="rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card md:focus-visible:ring-offset-background"
        >
          {byTab[value].length === 0 ? (
            <EmptyState
              icon={empty.icon}
              title={empty.title}
              text={empty.text}
              action={value === 'upcoming' ? exploreSpaces : undefined}
            />
          ) : (
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {byTab[value].map((booking) => (
                <li key={booking.id}>
                  <BookingCard
                    booking={booking}
                    imageUrl={spaceImages ? (spaceImages.get(booking.spaceId) ?? null) : undefined}
                    onCancelled={onCancelled}
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
