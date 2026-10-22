import type { CategoryStatsResult } from '../hooks/use-category-stats'
import { CATEGORY_LABELS, type SpaceCategory } from '../types'
import { CategoryIllustration } from './category-illustration'
import { LiveStats } from './live-stats'

const CATEGORIES = Object.keys(CATEGORY_LABELS) as SpaceCategory[]

type SpacesShowcaseProps = {
  stats: CategoryStatsResult
}

// What Zona is, next to the login and sign-up forms (DESIGN.md "Auth pages"): one line about it, the
// category illustrations, which pop in one by one and then float, and (md+) the live line.
export function SpacesShowcase({ stats }: SpacesShowcaseProps) {
  return (
    <div className="flex flex-col gap-6 md:flex-1 md:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-lg font-semibold">Find your zone</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Desks, meeting rooms, offices and event halls, by the hour.
        </p>
      </div>
      {/* Decorative: the line above says what they are */}
      <ul aria-hidden="true" className="grid grid-cols-4 justify-items-center gap-3 md:grid-cols-2 md:gap-6">
        {CATEGORIES.map((category, index) => (
          <li
            key={category}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-50 motion-safe:duration-500 motion-safe:ease-out motion-safe:fill-mode-both"
            style={{ animationDelay: `${300 + index * 100}ms` }}
          >
            <span
              className="grid size-16 place-items-center rounded-full border bg-card motion-safe:animate-float md:size-28"
              style={{ animationDelay: `${-index * 1.5}s` }}
            >
              <CategoryIllustration category={category} className="size-10 md:size-16" />
            </span>
          </li>
        ))}
      </ul>
      <div className="hidden md:block">
        <LiveStats stats={stats} />
      </div>
    </div>
  )
}
