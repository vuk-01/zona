import { Skeleton } from '@/components/ui/skeleton'

import type { CategoryStatsResult } from '../hooks/use-category-stats'
import { spacesCount } from './format-spaces'

type LiveStatsProps = {
  stats: CategoryStatsResult
}

// One live line under Home's title: "● 4 open now · 5 spaces in Podgorica". Green only for real
// availability (DESIGN.md); the dot pulses slowly unless the user prefers reduced motion.
export function LiveStats({ stats }: LiveStatsProps) {
  if (stats.isLoading) return <Skeleton className="h-5 w-56 rounded-full" />
  const all = stats.of('all')
  if (stats.isError || all.count === 0) return null

  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      {all.openNow > 0 && (
        <span className="inline-flex items-center gap-2 font-medium text-success">
          <span
            className="size-2 rounded-full bg-success ring-4 ring-success/20 motion-safe:animate-pulse"
            aria-hidden="true"
          />
          {all.openNow} open now
        </span>
      )}
      <span>
        {spacesCount(all.count)} in {stats.where}
      </span>
    </p>
  )
}
