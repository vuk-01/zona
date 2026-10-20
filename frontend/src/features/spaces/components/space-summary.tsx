import { Armchair, MapPin, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import { CATEGORY_LABELS, bookingUnit, type Space } from '../types'

type SpaceSummaryProps = {
  space: Space
}

// Under the page title: category, address, capacity and the price per hour.
export function SpaceSummary({ space }: SpaceSummaryProps) {
  const perDesk = bookingUnit(space.category) === 'desk'

  return (
    <div className="flex flex-col gap-3">
      <Badge variant="outline" className="rounded-full px-3 py-1">
        {CATEGORY_LABELS[space.category]}
      </Badge>
      <p className="flex items-center gap-2 text-muted-foreground">
        <MapPin className="size-5 shrink-0" aria-hidden="true" />
        {space.address}, {space.city}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-2">
          {perDesk ? (
            <Armchair className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <Users className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          {perDesk ? `${space.deskCount ?? 0} desks, one per booking` : `Up to ${space.capacity} people`}
        </span>
        <span className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
          <span className="font-semibold">€{space.pricePerHour}</span>{' '}
          <span className="text-muted-foreground">{perDesk ? '/desk·hr' : '/hr'}</span>
        </span>
      </div>
    </div>
  )
}
