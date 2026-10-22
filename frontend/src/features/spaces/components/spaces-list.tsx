import { useRef } from 'react'

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
  // "5 spaces" above the grid (Explore)
  showCount?: boolean
  emptyMessage?: string
  // When filters are on, the empty state offers "Clear filters" (Explore)
  onClearFilters?: () => void
}

// Spaces with all three states: loading, empty and error.
export function SpacesList({
  filters = {},
  limit,
  showCount = false,
  emptyMessage = 'No spaces are listed yet. Check back soon.',
  onClearFilters,
}: SpacesListProps) {
  const { data: spaces, isLoading, error, refetch, isRefetching } = useSpaces(filters)
  // "Clear filters" disappears once it is used, so focus moves to the results instead of <body>.
  const resultsRef = useRef<HTMLDivElement>(null)

  function content() {
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
          <Button
            variant="outline"
            className="h-11 rounded-full focus-visible:ring-ring md:h-9"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            Try again
          </Button>
        </div>
      )
    }

    if (!spaces || spaces.length === 0) {
      if (!onClearFilters) return <p className="text-muted-foreground">{emptyMessage}</p>
      return (
        <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed p-6">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">No spaces match this search</p>
            <p className="text-sm text-muted-foreground">Try another name, city, category or price.</p>
          </div>
          <Button
            className="rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => {
              onClearFilters()
              resultsRef.current?.focus()
            }}
          >
            Clear filters
          </Button>
        </div>
      )
    }

    const shown = spaces.slice(0, limit)
    return (
      <div className="flex flex-col gap-4">
        {showCount && (
          <p className="text-sm text-muted-foreground">
            {shown.length} {shown.length === 1 ? 'space' : 'spaces'}
          </p>
        )}
        <ul className={grid}>
          {shown.map((space) => (
            <li key={space.id}>
              <SpaceCard space={space} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div ref={resultsRef} tabIndex={-1} className="outline-none">
      {/* Always rendered, so screen readers hear the result of every filter change, not the whole grid */}
      <p role="status" className="sr-only">
        {isLoading || error
          ? ''
          : spaces?.length
            ? `${Math.min(spaces.length, limit ?? spaces.length)} spaces found`
            : 'No spaces found'}
      </p>
      {content()}
    </div>
  )
}
