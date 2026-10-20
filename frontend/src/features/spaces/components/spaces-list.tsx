import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { useSpaces } from '../api/use-spaces'
import type { SpaceFilters } from '../types'
import { SpaceCard } from './space-card'

// One column on phones (cards go down the page), 2 at md, 3 at lg.
const grid = 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'

type SpacesListProps = {
  filters?: SpaceFilters
  // Show at most this many spaces (Home shows a few, Explore shows all)
  limit?: number
  emptyMessage?: string
}

// Spaces with all three states: loading, empty and error.
export function SpacesList({
  filters = {},
  limit,
  emptyMessage = 'No spaces match your search yet. Try another category or search.',
}: SpacesListProps) {
  const { data: spaces, isLoading, error, refetch, isRefetching } = useSpaces(filters)

  if (isLoading) {
    return (
      <div className={grid} aria-busy="true" aria-label="Loading spaces">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-80 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-destructive">Spaces failed to load.</p>
        <Button variant="outline" className="rounded-full" disabled={isRefetching} onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!spaces || spaces.length === 0) {
    return <p className="text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <ul className={grid}>
      {spaces.slice(0, limit).map((space) => (
        <li key={space.id}>
          <SpaceCard space={space} />
        </li>
      ))}
    </ul>
  )
}
