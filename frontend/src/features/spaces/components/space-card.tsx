import { Clock, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { CATEGORY_LABELS, bookingUnit, type Space, type Weekday } from '../types'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function todayHours(space: Space) {
  const hours = space.openingHours[WEEKDAYS[new Date().getDay()]]
  return hours ? `Today ${hours.open}–${hours.close}` : 'Closed today'
}

type SpaceCardProps = {
  space: Space
}

export function SpaceCard({ space }: SpaceCardProps) {
  const perDesk = bookingUnit(space.category) === 'desk'

  return (
    <Card className="overflow-hidden pt-0">
      <img
        src={space.images[0]}
        alt={`${space.name}, ${CATEGORY_LABELS[space.category].toLowerCase()} in ${space.city}`}
        className="aspect-[16/10] w-full rounded-lg bg-muted object-cover"
      />
      <CardHeader className="gap-2">
        <Badge variant="outline">{CATEGORY_LABELS[space.category]}</Badge>
        <CardTitle className="text-base font-semibold">{space.name}</CardTitle>
        <p className="truncate text-sm text-muted-foreground">
          {space.address}, {space.city}
        </p>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-4 text-sm">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            {todayHours(space)}
          </span>
          <span className="flex items-center gap-2 text-success">
            <Users className="size-4" aria-hidden />
            {perDesk ? `${space.deskCount ?? 0} desks` : `Up to ${space.capacity} people`}
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
          <span className="font-semibold">€{space.pricePerHour}</span>{' '}
          <span className="text-muted-foreground">{perDesk ? '/desk·hr' : '/hour'}</span>
        </span>
      </CardContent>
    </Card>
  )
}
