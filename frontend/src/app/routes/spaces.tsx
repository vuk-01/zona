import { useState } from 'react'

import { FavoriteHeart } from '@/app/favorite-heart'
import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { CategoryRow } from '@/features/spaces/components/category-row'
import { CategorySpotlight } from '@/features/spaces/components/category-spotlight'
import { PriceFilter } from '@/features/spaces/components/price-filter'
import { SpaceSearch } from '@/features/spaces/components/space-search'
import { SpacesList } from '@/features/spaces/components/spaces-list'
import { useCategoryStats } from '@/features/spaces/hooks/use-category-stats'
import { useSpaceFilters } from '@/features/spaces/hooks/use-space-filters'

// Explore: every listed space, filtered by search (name or city), category and price per hour.
// All filters live in the URL, e.g. /spaces?category=desk from Home. The hero panel holds the filters,
// and on large screens the selected category's spotlight on its right.
export function Spaces() {
  const filters = useSpaceFilters()
  const [filtersOpen, setFiltersOpen] = useState(filters.price !== undefined || filters.filtersRequested)
  const stats = useCategoryStats(filters.filters)
  const category = filters.category ?? 'all'

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <HeroPanel align="start" aside={<CategorySpotlight category={category} stats={stats} />}>
        <PageTitle>Explore spaces</PageTitle>
        <div className="flex flex-col gap-4">
          <SpaceSearch
            defaultValue={filters.search}
            onSearch={filters.setSearch}
            filtersId="space-filters"
            filtersOpen={filtersOpen}
            onToggleFilters={() => setFiltersOpen((open) => !open)}
            hasActiveFilters={filters.price !== undefined}
          />
          {filtersOpen && (
            <PriceFilter id="space-filters" value={filters.price} onChange={filters.setPrice} />
          )}
        </div>
        <CategoryRow selected={category} hrefFor={filters.categoryHref} counts={stats.counts} />
      </HeroPanel>
      <SpacesList
        filters={filters.filters}
        showCount
        onClearFilters={filters.hasFilters ? filters.clear : undefined}
        cardAction={(space) => <FavoriteHeart space={space} />}
      />
    </section>
  )
}
