import { Skeleton } from '@/components/ui/skeleton'

import { useSpaces } from '../api/use-spaces'
import type { SpaceFilters } from '../types'
import { SpaceCard } from './space-card'

type SpacesListProps = {
  filters?: SpaceFilters
}

// Spaces with all three states: loading, empty and error.
export function SpacesList({ filters = {} }: SpacesListProps) {
  const { data: spaces, isLoading, error } = useSpaces(filters)

  if (isLoading) {
    return (
      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-80 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="mt-8 text-destructive">Spaces failed to load. Please try again.</p>
  }

  if (!spaces || spaces.length === 0) {
    return (
      <p className="mt-8 text-muted-foreground">
        No spaces match your search yet. Try another category or city.
      </p>
    )
  }

  return (
    <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {spaces.map((space) => (
        <li key={space.id}>
          <SpaceCard space={space} />
        </li>
      ))}
    </ul>
  )
}
