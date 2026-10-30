import { cva } from 'class-variance-authority'
import { Building2, SearchX } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'

import { EmptyState, emptyStateAction } from '@/components/feedback/empty-state'
import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { useSpaces } from '../api/use-spaces'
import type { Space, SpaceFilters } from '../types'
import { type FilterChip, SearchFilterChip } from './search-filter-chip'
import { SpaceCard } from './space-card'

// One column on phones (cards go down the page), 2 at md, 3 at lg.
const grid = 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'
const fadeIn = 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300'

// A removed card (see `only`) fades and shrinks, then leaves the grid: display is transitioned too
// (allow-discrete), so it only turns to none once the fade is done. With reduced motion it goes at once.
const itemVariants = cva(
  'motion-safe:transition-[opacity,scale,display] motion-safe:transition-discrete motion-safe:duration-300 motion-safe:ease-out',
  {
    variants: {
      removed: {
        true: 'hidden scale-95 opacity-0',
        false: '',
      },
    },
  },
)

const emptyVariants = cva(fadeIn, {
  variants: {
    // The search's empty state and a page's own one pop in a little
    zoom: { true: 'motion-safe:zoom-in-95', false: '' },
    // The last removed card fades out first (itemVariants); the empty state comes in once it is gone
    afterRemoval: { true: 'motion-safe:delay-300 motion-safe:fill-mode-backwards', false: '' },
  },
})

const spacesFound = (count: number) => `${count} ${count === 1 ? 'space' : 'spaces'}`

type SpacesListProps = {
  filters?: SpaceFilters
  // Show at most this many spaces (Home shows a few, Explore shows all)
  limit?: number
  // "5 spaces" above the grid (Explore)
  showCount?: boolean
  // When filters are on, the empty state offers "Clear filters" (Explore)
  onClearFilters?: () => void
  // The active search as removable chips above the results, also over the empty state (Explore)
  chips?: FilterChip[]
  // Top right on every card's photo, e.g. the favorite heart (the route passes it in)
  cardAction?: (space: Space) => ReactNode
  // Only these ids, on top of the filters (Favorites: the favorites as they are right now). A card whose
  // id drops out fades away at once, before the list reloads.
  only?: ReadonlySet<number>
  // Instead of "No spaces yet" when nothing is left (Favorites: "No favorites yet" and a way to Explore)
  empty?: ReactNode
}

// Spaces with all three states: loading, empty and error. Every state fades in, and on every filter
// change the cards come in again, one after another along a row; further down they fade in on scroll.
export function SpacesList({
  filters = {},
  limit,
  showCount = false,
  onClearFilters,
  chips = [],
  cardAction,
  only,
  empty,
}: SpacesListProps) {
  const { data: spaces, isLoading, error, refetch, isRefetching } = useSpaces(filters)
  // "Clear filters" disappears once it is used, so focus moves to the results instead of <body>.
  const resultsRef = useRef<HTMLDivElement>(null)
  const shown = spaces?.slice(0, limit)
  const isRemoved = (space: Space) => only !== undefined && !only.has(space.id)
  const visibleCount = shown?.filter((space) => !isRemoved(space)).length

  // A removed card takes its focused heart with it (the last one takes the whole grid): focus moves to
  // the results, whose status line announces the new count (DESIGN.md "Accessibility").
  const trimsCards = only !== undefined
  const lastCount = useRef(visibleCount)
  useEffect(() => {
    const shrank =
      visibleCount !== undefined && lastCount.current !== undefined && visibleCount < lastCount.current
    lastCount.current = visibleCount
    const active = document.activeElement
    if (trimsCards && shrank && (active === document.body || active?.closest('[data-removed]'))) {
      resultsRef.current?.focus({ preventScroll: true })
    }
  }, [visibleCount, trimsCards])

  function emptyState(afterRemoval: boolean) {
    return (
      <div
        className={emptyVariants({ zoom: onClearFilters !== undefined || empty !== undefined, afterRemoval })}
      >
        {onClearFilters ? (
          <EmptyState
            icon={SearchX}
            title="No spaces match this search"
            text="Try another name, city, category or price."
            action={
              <Button
                className={emptyStateAction}
                onClick={() => {
                  onClearFilters()
                  resultsRef.current?.focus()
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          (empty ?? (
            <EmptyState
              icon={Building2}
              title="No spaces yet"
              text="Hosts are adding desks, rooms and halls. Check back soon."
            />
          ))
        )}
      </div>
    )
  }

  function content() {
    if (isLoading) {
      return (
        <div className={`${grid} ${fadeIn}`} aria-busy="true" aria-label="Loading spaces">
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

    if (!shown || shown.length === 0) return emptyState(false)

    // Every card on screen was removed (Favorites): the grid stays until the last one has faded out
    const allRemoved = visibleCount === 0
    return (
      // A new key per filter set: the cards come in again on every change, also from the cache
      <div key={JSON.stringify(filters)} className="flex flex-col gap-4">
        {showCount && !allRemoved && (
          <p className={`text-sm text-muted-foreground ${fadeIn}`}>{spacesFound(visibleCount ?? 0)}</p>
        )}
        <ul className={grid}>
          {shown.map((space, index) => (
            <li
              key={space.id}
              data-removed={isRemoved(space) || undefined}
              className={itemVariants({ removed: isRemoved(space) })}
            >
              <Reveal delay={(index % 3) * 90} className="h-full">
                <SpaceCard space={space} action={cardAction?.(space)} />
              </Reveal>
            </li>
          ))}
        </ul>
        {allRemoved && emptyState(true)}
      </div>
    )
  }

  return (
    <div ref={resultsRef} tabIndex={-1} className="outline-none">
      {/* Always rendered, so screen readers hear the result of every filter change, not the whole grid */}
      <p role="status" className="sr-only">
        {isLoading || error ? '' : visibleCount ? `${spacesFound(visibleCount)} found` : 'No spaces found'}
      </p>
      {chips.length > 0 && (
        <div role="group" aria-label="Active search" className="mb-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            // The chip goes away with its filter, so focus moves to the results, like after "Clear filters"
            <SearchFilterChip key={chip.key} chip={chip} onRemoved={() => resultsRef.current?.focus()} />
          ))}
        </div>
      )}
      {content()}
    </div>
  )
}
