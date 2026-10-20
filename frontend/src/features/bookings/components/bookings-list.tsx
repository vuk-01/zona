import { Skeleton } from '@/components/ui/skeleton'

import { useBookings } from '../api/use-bookings'
import type { BookingFilters } from '../types'
import { BookingCard } from './booking-card'

type BookingsListProps = {
  filters?: BookingFilters
}

// Bookings with all three states: loading, empty and error.
export function BookingsList({ filters = {} }: BookingsListProps) {
  const { data: bookings, isLoading, error } = useBookings(filters)

  if (isLoading) {
    return (
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="mt-8 text-destructive">Bookings failed to load. Please try again.</p>
  }

  if (!bookings || bookings.length === 0) {
    return (
      <p className="mt-8 text-muted-foreground">No bookings yet. Find a space and book your first hour.</p>
    )
  }

  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <BookingCard booking={booking} />
        </li>
      ))}
    </ul>
  )
}
