import { MapPin, Pencil } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

import { CATEGORY_LABELS, type Space } from '../types'
import { DeleteSpaceDialog } from './delete-space-dialog'
import { SpaceBookingSummary } from './space-booking-summary'
import { SpacePrice } from './space-price'

type HostSpaceCardProps = {
  space: Space
  onDeleted?: (space: Pick<Space, 'id' | 'name'>) => void
}

// A space on the host's "My spaces" page: what guests see, plus its status and Edit / Delete. The whole
// card opens the editor: the Edit link is stretched over the card and Delete sits above it, so the card
// lifts like a space card when the pointer is anywhere on it except Delete (DESIGN.md "Motion"), and Edit
// turns pale blue to show what a click does.
export function HostSpaceCard({ space, onDeleted }: HostSpaceCardProps) {
  const address = `${space.address}, ${space.city}`

  return (
    <Card className="group relative h-full gap-4 overflow-hidden rounded-lg pt-0 pb-4 shadow-none transition-[translate,box-shadow,border-color] duration-300 ease-out has-[a:hover]:border-primary/60 has-[a:hover]:shadow-lift motion-safe:has-[a:hover]:-translate-y-1">
      <div className="overflow-hidden rounded-lg bg-muted">
        <img
          src={space.images[0]}
          alt={`${space.name}, ${CATEGORY_LABELS[space.category].toLowerCase()} in ${space.city}`}
          className="aspect-[16/10] w-full object-cover transition-transform duration-700 ease-out motion-safe:group-has-[a:hover]:scale-105"
        />
      </div>
      <CardHeader className="gap-2 px-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full">
            {CATEGORY_LABELS[space.category]}
          </Badge>
          {space.status === 'draft' && (
            <Badge variant="secondary" className="rounded-full">
              Draft
            </Badge>
          )}
        </div>
        {/* A heading, so screen-reader users can jump from space to space */}
        <h2 className="text-base leading-snug font-semibold wrap-break-word transition-colors group-has-[a:hover]:text-primary">
          {space.name}
        </h2>
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span title={address} className="min-w-0 truncate">
            {address}
          </span>
        </p>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-4 px-4 text-sm">
        {/* The booking count wraps instead of truncating, so "· 1 pending" stays readable on phones; the
            price always has its own row on the right, so every card lines up the same way */}
        <div className="flex flex-col gap-2">
          {space.bookingCounts && <SpaceBookingSummary counts={space.bookingCounts} />}
          <div className="flex justify-end">
            <SpacePrice space={space} />
          </div>
        </div>
        <div className="flex gap-2">
          {/* after: the link covers the whole card (the card is its positioned parent). Ghost with a border
              looks like outline but never lifts: a translate on the link would make it the after's
              containing block, so the cover would shrink to the button the moment it is hovered or pressed */}
          <Button
            asChild
            variant="ghost"
            className="h-11 flex-1 rounded-full border after:absolute after:inset-0 after:content-[''] focus-visible:ring-ring md:h-9"
          >
            <Link to={`/host/spaces/${space.id}/edit`} aria-label={`Edit ${space.name}`}>
              <Pencil aria-hidden="true" />
              Edit
            </Link>
          </Button>
          {/* Above the stretched Edit link, so Delete stays its own target */}
          <div className="relative z-10">
            <DeleteSpaceDialog space={space} onDeleted={onDeleted} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
