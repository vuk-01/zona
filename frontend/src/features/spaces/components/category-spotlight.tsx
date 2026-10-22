import { cva } from 'class-variance-authority'
import { Armchair, Clock, DoorOpen } from 'lucide-react'

import type { CategoryOption, CategoryStats, CategoryStatsResult } from '../hooks/use-category-stats'
import { CATEGORY_LABELS } from '../types'
import { CategoryIllustration } from './category-illustration'
import { SpacePrice } from './space-price'

// One short line per category
const DESCRIPTIONS: Record<CategoryOption, string> = {
  all: 'Every desk, room and hall',
  desk: 'Drop in and focus by the hour',
  'meeting-room': 'Room to plan with your team',
  office: 'A private room for your team',
  'event-hall': 'Workshops, launches, parties',
}

// Green only for real availability (DESIGN.md)
const statusVariants = cva('flex items-center gap-2 text-sm', {
  variants: {
    tone: {
      success: 'font-medium text-success',
      muted: 'text-muted-foreground',
    },
  },
})

// Every category has one status line, so the card keeps its height when the category changes
function status(category: CategoryOption, { count, openNow, freeDesks }: CategoryStats) {
  if (count === 0) return { icon: Clock, text: 'None listed yet', tone: 'muted' } as const
  if (category === 'desk' && freeDesks !== null && freeDesks > 0) {
    const text = `${freeDesks} ${freeDesks === 1 ? 'desk' : 'desks'} free now`
    return { icon: Armchair, text, tone: 'success' } as const
  }
  if (openNow > 0) return { icon: DoorOpen, text: `${openNow} open now`, tone: 'success' } as const
  return { icon: Clock, text: 'Closed now', tone: 'muted' } as const
}

type CategorySpotlightProps = {
  category: CategoryOption
  stats: CategoryStatsResult
}

// Explore, large screens only (the hero panel's aside): what the selected category is, what it costs
// and what is open. It fades in again on every category change.
export function CategorySpotlight({ category, stats }: CategorySpotlightProps) {
  const categoryStats = stats.of(category)
  const ready = !stats.isLoading && !stats.isError
  const { icon: StatusIcon, text, tone } = status(category, categoryStats)

  return (
    <div className="relative hidden lg:block">
      <div
        key={category}
        className="flex flex-col gap-4 rounded-lg border bg-card p-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
      >
        <span className="grid size-20 place-items-center rounded-full bg-background">
          <CategoryIllustration category={category} className="size-14" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">
            {category === 'all' ? 'All spaces' : CATEGORY_LABELS[category]}
          </p>
          <p className="text-sm text-muted-foreground">{DESCRIPTIONS[category]}</p>
        </div>
        <dl className="grid min-h-16 grid-cols-2 gap-4 border-t pt-4 text-sm">
          {ready && (
            <>
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">Spaces</dt>
                <dd className="font-semibold">{categoryStats.count}</dd>
              </div>
              <div className="flex flex-col items-start gap-1">
                <dt className="text-muted-foreground">From</dt>
                <dd>{categoryStats.cheapest ? <SpacePrice space={categoryStats.cheapest} /> : '–'}</dd>
              </div>
            </>
          )}
        </dl>
        {ready && (
          <p className={statusVariants({ tone })}>
            <StatusIcon className="size-4 shrink-0" aria-hidden="true" />
            {text}
          </p>
        )}
      </div>
    </div>
  )
}
