import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

import { CATEGORY_LABELS, type Space } from '../types'
import { SpacePrice } from './space-price'

type FeaturedSpaceProps = {
  // The newest listed space; undefined while the spaces load or when none are listed
  space: Space | undefined
  isLoading: boolean
  // Top right on the photo, e.g. the favorite heart (passed in by the route)
  action?: ReactNode
}

// Home, large screens only (the hero panel's aside): the newest space as a photo card on a small fanned
// stack, which opens a little further on hover. The column is kept while loading, so nothing jumps. Like
// the space card, the name is a link stretched over the card and the action sits above it.
export function FeaturedSpace({ space, isLoading, action }: FeaturedSpaceProps) {
  if (isLoading) return <Skeleton className="hidden aspect-square rounded-lg lg:block" />
  if (!space) return <div className="hidden lg:block" />

  return (
    <div className="group relative hidden lg:block">
      <div
        aria-hidden="true"
        className="absolute inset-0 rotate-6 rounded-lg bg-chart-2 transition-transform duration-500 ease-out motion-safe:group-hover:rotate-12"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -rotate-3 rounded-lg bg-primary/30 transition-transform duration-500 ease-out motion-safe:group-hover:-rotate-6"
      />
      <div className="relative flex flex-col gap-3 rounded-lg border bg-card p-3 transition-[translate,box-shadow] duration-300 ease-out group-hover:shadow-lift has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 motion-safe:group-hover:-translate-y-1">
        <div className="relative overflow-hidden rounded-md bg-muted">
          <img
            src={space.images[0]}
            alt={`${space.name}, ${CATEGORY_LABELS[space.category].toLowerCase()} in ${space.city}`}
            className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-out motion-safe:group-hover:scale-105"
          />
          <Badge className="absolute top-3 left-3 rounded-full px-3 py-1">
            <Sparkles aria-hidden="true" />
            New on Zona
          </Badge>
        </div>
        {action && <div className="absolute top-6 right-6 z-10">{action}</div>}
        <div className="flex items-end justify-between gap-3 px-1 pb-1">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="line-clamp-2 font-semibold">
              <Link
                to={`/spaces/${space.id}`}
                className="outline-none after:absolute after:inset-0 after:content-['']"
              >
                {space.name}
              </Link>
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {CATEGORY_LABELS[space.category]} · {space.city}
            </p>
          </div>
          <SpacePrice space={space} />
        </div>
      </div>
    </div>
  )
}
