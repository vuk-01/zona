import { cva } from 'class-variance-authority'
import { Armchair, Clock, Users } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { CATEGORY_LABELS, bookingUnit, type Space, type Weekday } from '../types'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function todayHours(space: Space) {
  const hours = space.openingHours[WEEKDAYS[new Date().getDay()]]
  return hours ? `${hours.open}–${hours.close}` : 'Closed today'
}

// Green only for real availability (DESIGN.md); everything else is meta text.
const availabilityVariants = cva('flex items-center gap-2 whitespace-nowrap', {
  variants: {
    tone: {
      success: 'text-success',
      muted: 'text-muted-foreground',
    },
  },
})

function deskAvailability(available: number | null) {
  if (available === null) return { text: 'Closed now', tone: 'muted' } as const
  if (available === 0) return { text: 'Fully booked now', tone: 'muted' } as const
  return { text: `${available} ${available === 1 ? 'desk' : 'desks'} available`, tone: 'success' } as const
}

type SpaceCardProps = {
  space: Space
}

// The whole card opens the space page.
export function SpaceCard({ space }: SpaceCardProps) {
  const perDesk = bookingUnit(space.category) === 'desk'
  const desks = deskAvailability(space.availableDesks)

  return (
    <Link
      to={`/spaces/${space.id}`}
      // relative: the sr-only text is positioned against the card, not the page, so it can never widen the page
      className="group relative block h-full rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full gap-4 overflow-hidden rounded-lg pt-0 pb-4 shadow-none transition-colors group-hover:border-primary">
        <img
          src={space.images[0]}
          alt={`${space.name}, ${CATEGORY_LABELS[space.category].toLowerCase()} in ${space.city}`}
          className="aspect-[16/10] w-full rounded-lg bg-muted object-cover"
        />
        <CardHeader className="gap-1 px-4">
          <CardTitle className="truncate text-base font-semibold">{space.name}</CardTitle>
          <p className="truncate text-sm text-muted-foreground">{space.address}</p>
        </CardHeader>
        <CardContent className="mt-auto flex items-end justify-between gap-3 px-4 text-sm">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="sr-only">Open today </span>
                {todayHours(space)}
              </span>
            </span>
            {perDesk ? (
              <span className={availabilityVariants({ tone: desks.tone })}>
                <Armchair className="size-4 shrink-0" aria-hidden="true" />
                {desks.text}
              </span>
            ) : (
              <span className={availabilityVariants({ tone: 'muted' })}>
                <Users className="size-4 shrink-0" aria-hidden="true" />
                Up to {space.capacity} people
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 whitespace-nowrap text-secondary-foreground">
            <span className="font-semibold">€{space.pricePerHour}</span>{' '}
            <span className="text-muted-foreground">/hr</span>
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}
