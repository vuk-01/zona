import { useState } from 'react'

import { PageTitle } from '@/components/layout/page-title'
import { CategoryRow } from '@/features/spaces/components/category-row'
import { PriceFilter } from '@/features/spaces/components/price-filter'
import { SpaceSearch } from '@/features/spaces/components/space-search'
import { SpacesList } from '@/features/spaces/components/spaces-list'
import { useSpaceFilters } from '@/features/spaces/hooks/use-space-filters'

// Explore: every listed space, filtered by search (name or city), category and price per hour.
// All filters live in the URL, e.g. /spaces?category=desk from Home.
export function Spaces() {
  const filters = useSpaceFilters()
  const [filtersOpen, setFiltersOpen] = useState(filters.price !== undefined || filters.filtersRequested)

  return (
    <section className="flex flex-col gap-6 md:gap-8">
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
        {filtersOpen && <PriceFilter id="space-filters" value={filters.price} onChange={filters.setPrice} />}
      </div>
      <CategoryRow selected={filters.category ?? 'all'} hrefFor={filters.categoryHref} />
      <SpacesList
        filters={filters.filters}
        showCount
        onClearFilters={filters.hasFilters ? filters.clear : undefined}
      />
    </section>
  )
}
