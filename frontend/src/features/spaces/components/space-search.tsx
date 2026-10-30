import { Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'

import { SearchSuggestions, type SearchValue } from './search-suggestions'

// Outline buttons lift on hover (Button); this one also turns blue, and stays tinted while the filters
// are open
const filterButtonClass =
  'relative size-12 shrink-0 rounded-full bg-card shadow-none hover:border-primary hover:bg-card hover:text-primary focus-visible:ring-ring aria-expanded:border-primary aria-expanded:bg-secondary aria-expanded:text-secondary-foreground'

const EMPTY: SearchValue = { text: '', city: null }

// One search at a time: a city picked from the list (?city=), or free text that matches a space's name
// or city (?q=)
export type SpaceSearchQuery = { city?: string; q?: string }

const toQuery = ({ text, city }: SearchValue): SpaceSearchQuery =>
  city ? { city } : text.trim() ? { q: text.trim() } : {}

// /spaces?city=Podgorica, /spaces?q=hub, or all of Explore
function exploreHref({ city, q }: SpaceSearchQuery) {
  const params = new URLSearchParams()
  if (city) params.set('city', city)
  if (q) params.set('q', q)
  const query = params.toString()
  return query ? `/spaces?${query}` : '/spaces'
}

type SpaceSearchProps = {
  // Explore: the search in the URL, so the field shows it
  defaultValue?: SearchValue
  // Explore: search in place (keeping the other filters). Without it, searching opens Explore.
  onSearch?: (query: SpaceSearchQuery) => void
  // Explore: the filter button opens and closes the filters panel with this id.
  filtersId?: string
  filtersOpen?: boolean
  onToggleFilters?: () => void
  // Price filter is on: a dot on the filter button
  hasActiveFilters?: boolean
}

// Search pill with city suggestions, the round filter button and Search. Picking a city only fills the
// field; Search (or Enter with no city marked) runs it.
export function SpaceSearch({
  defaultValue = EMPTY,
  onSearch,
  filtersId,
  filtersOpen = false,
  onToggleFilters,
  hasActiveFilters = false,
}: SpaceSearchProps) {
  const navigate = useNavigate()
  const [value, setValue] = useState(defaultValue)
  // Follow the URL when it changes from outside (a removed filter, "Clear filters"), without remounting
  // the field.
  const [syncedValue, setSyncedValue] = useState(defaultValue)
  if (defaultValue.text !== syncedValue.text || defaultValue.city !== syncedValue.city) {
    setSyncedValue(defaultValue)
    setValue(defaultValue)
  }

  const search = () => {
    const query = toQuery(value)
    if (onSearch) onSearch(query)
    else navigate(exploreHref(query))
  }

  return (
    <form
      role="search"
      className="flex w-full max-w-2xl items-center gap-2 md:gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        search()
      }}
    >
      <SearchSuggestions value={value} onValueChange={setValue} className="min-w-0 flex-1" />
      {onToggleFilters ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={filterButtonClass}
          aria-label={hasActiveFilters ? 'Filters, price filter on' : 'Filters'}
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={onToggleFilters}
        >
          <SlidersHorizontal className="size-5" aria-hidden="true" />
          {hasActiveFilters && (
            <span className="absolute top-2 right-2 size-2.5 rounded-full bg-primary" aria-hidden="true" />
          )}
        </Button>
      ) : (
        <Button asChild variant="outline" size="icon" className={filterButtonClass}>
          <Link to="/spaces?filters=open" aria-label="Filters">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      )}
      {/* Round on phones, where the field needs the room; "Search" in words from md */}
      <Button
        type="submit"
        className="size-12 shrink-0 rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:w-auto md:has-[>svg]:px-6"
      >
        <Search className="size-5" aria-hidden="true" />
        <span className="sr-only md:not-sr-only">Search</span>
      </Button>
    </form>
  )
}
