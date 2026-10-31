import { MAX_PAGE_SIZE } from '@/lib/api-client'

import { useSpaces } from '../api/use-spaces'
import { CATEGORY_LABELS, type Space, type SpaceCategory, type SpaceFilters, type Weekday } from '../types'

// A category in the category row, or all of them
export type CategoryOption = SpaceCategory | 'all'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function isOpenNow(space: Space, now: Date) {
  const hours = space.openingHours[WEEKDAYS[now.getDay()]]
  const time = now.toTimeString().slice(0, 5)
  return hours !== null && hours.open <= time && time < hours.close
}

export type CategoryStats = {
  count: number
  // The lowest price per hour with its unit ("from €3 /desk·hr" under All comes from a desk space);
  // undefined when the category has no spaces
  cheapest: Pick<Space, 'category' | 'pricePerHour'> | undefined
  openNow: number
  // Desks free right now across all desk spaces; null while every desk space is closed
  freeDesks: number | null
}

function statsFor(spaces: Space[], now: Date): CategoryStats {
  const desks = spaces.flatMap((space) => (space.availableDesks === null ? [] : [space.availableDesks]))
  return {
    count: spaces.length,
    cheapest: spaces.toSorted((a, b) => a.pricePerHour - b.pricePerHour)[0],
    openNow: spaces.filter((space) => isOpenNow(space, now)).length,
    freeDesks: desks.length > 0 ? desks.reduce((sum, free) => sum + free, 0) : null,
  }
}

const OPTIONS: CategoryOption[] = ['all', ...(Object.keys(CATEGORY_LABELS) as SpaceCategory[])]

const countsOf = (of: (category: CategoryOption) => CategoryStats) =>
  Object.fromEntries(OPTIONS.map((option) => [option, of(option).count])) as Record<CategoryOption, number>

// Numbers for the hero panel on Home and Explore: spaces per category, what is open now, the newest
// space. They follow the other filters (search, price) but never the category itself, so every category
// says how many spaces it would show. Every matching space counts, so it asks for the largest page.
export function useCategoryStats(filters: SpaceFilters = { status: 'listed' }) {
  const { data, isLoading, isError } = useSpaces({ ...filters, category: undefined }, { size: MAX_PAGE_SIZE })
  const spaces = data?.items ?? []
  const now = new Date()
  const of = (category: CategoryOption) =>
    statsFor(category === 'all' ? spaces : spaces.filter((space) => space.category === category), now)
  const cities = [...new Set(spaces.map((space) => space.city))]

  return {
    isLoading,
    isError,
    of,
    // For the category row; undefined until the numbers are known
    counts: data && countsOf(of),
    // "in Podgorica", or "in 3 cities"
    where: cities.length === 1 ? cities[0] : `${cities.length} cities`,
    newest: spaces.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
  }
}

export type CategoryStatsResult = ReturnType<typeof useCategoryStats>
