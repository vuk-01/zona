import { Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const filterButtonClass = 'relative size-12 shrink-0 rounded-full bg-card shadow-none focus-visible:ring-ring'

type SpaceSearchProps = {
  defaultValue?: string
  // Explore: search in place (keeping the other filters). Without it, searching opens Explore.
  onSearch?: (value: string) => void
  // Explore: the filter button opens and closes the filters panel with this id.
  filtersId?: string
  filtersOpen?: boolean
  onToggleFilters?: () => void
  // Price filter is on: a dot on the filter button
  hasActiveFilters?: boolean
}

// Search pill (matches name or city) + round filter button.
export function SpaceSearch({
  defaultValue = '',
  onSearch,
  filtersId,
  filtersOpen = false,
  onToggleFilters,
  hasActiveFilters = false,
}: SpaceSearchProps) {
  const navigate = useNavigate()
  const [value, setValue] = useState(defaultValue)
  // Follow the URL when it changes from outside (e.g. "Clear filters"), without remounting the input.
  const [syncedValue, setSyncedValue] = useState(defaultValue)
  if (defaultValue !== syncedValue) {
    setSyncedValue(defaultValue)
    setValue(defaultValue)
  }

  const search = (term: string) => {
    if (onSearch) onSearch(term.trim())
    else navigate(term.trim() ? `/spaces?${new URLSearchParams({ search: term.trim() })}` : '/spaces')
  }

  return (
    <form
      role="search"
      className="flex w-full max-w-2xl items-center gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        search(value)
      }}
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search by name or city"
          placeholder="Search by name or city"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            // The field's clear (×) button empties it without submitting
            if (onSearch && event.target.value === '') onSearch('')
          }}
          className="h-12 rounded-full bg-muted pr-4 pl-12 focus-visible:ring-ring"
        />
      </div>
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
    </form>
  )
}
