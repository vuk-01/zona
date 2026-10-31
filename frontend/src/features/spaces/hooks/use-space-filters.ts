import { useSearchParams } from 'react-router'

import type { FilterChip } from '../components/search-filter-chip'
import {
  CATEGORY_LABELS,
  PRICE_RANGES,
  isPriceRange,
  isSpaceCategory,
  type PriceRange,
  type SpaceCategory,
  type SpaceFilters,
} from '../types'

type FilterParam = 'q' | 'city' | 'category' | 'price'

// GET /spaces answers 422 for a longer search or city, so a longer one from the URL is cut
const MAX_SEARCH_LENGTH = 80

// Explore's filters live in the URL (?q=&city=&category=&price=), so a search from Home, a refresh and the
// Back button all keep them. Changing one filter keeps the others. The search is either a city picked from
// the list (?city=, the exact name) or free text that matches a space's name or city (?q=).
export function useSpaceFilters() {
  const [params, setParams] = useSearchParams()

  const q = (params.get('q') ?? '').slice(0, MAX_SEARCH_LENGTH)
  const city = (params.get('city') ?? '').slice(0, MAX_SEARCH_LENGTH)
  const categoryParam = params.get('category')
  const category = isSpaceCategory(categoryParam) ? categoryParam : undefined
  const priceParam = params.get('price')
  const price = isPriceRange(priceParam) ? priceParam : undefined

  const update = (change: (next: URLSearchParams) => void) =>
    setParams(
      (prev) => {
        change(prev)
        return prev
      },
      { preventScrollReset: true },
    )

  const set = (name: FilterParam, value: string | undefined) =>
    update((next) => {
      if (value) next.set(name, value)
      else next.delete(name)
    })

  const filters: SpaceFilters = {
    status: 'listed',
    search: q || undefined,
    city: city || undefined,
    category,
    minPrice: price && PRICE_RANGES[price].minPrice,
    maxPrice: price && PRICE_RANGES[price].maxPrice,
  }

  // One removable chip per active filter, above the results: city, text, price, category. "Any" price and
  // "All" categories are no parameter at all, so they have no chip.
  const chips: FilterChip[] = []
  if (city) {
    chips.push({
      key: 'city',
      label: city,
      removeLabel: `Remove city filter ${city}`,
      remove: () => set('city', undefined),
    })
  }
  if (q) {
    chips.push({
      key: 'q',
      label: `“${q}”`,
      removeLabel: `Remove search “${q}”`,
      remove: () => set('q', undefined),
    })
  }
  if (price) {
    const label = PRICE_RANGES[price].label
    chips.push({
      key: 'price',
      label,
      removeLabel: `Remove price filter ${label}`,
      remove: () => set('price', undefined),
    })
  }
  if (category) {
    const label = CATEGORY_LABELS[category]
    chips.push({
      key: 'category',
      label,
      removeLabel: `Remove category filter ${label}`,
      remove: () => set('category', undefined),
    })
  }

  // Link to a category with the other filters kept (for the category row).
  const categoryHref = (value: SpaceCategory | 'all') => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('category')
    else next.set('category', value)
    const query = next.toString()
    return query ? `/spaces?${query}` : '/spaces'
  }

  return {
    category,
    price,
    filters,
    // What the search field shows: the city, or the text
    searchValue: { text: city || q, city: city || null },
    chips,
    hasFilters: Boolean(q || city || category || price),
    // The filter button on Home links here with ?filters=open, so the price chips are already showing
    filtersRequested: params.get('filters') === 'open',
    // A new search replaces the city or the text; category and price stay
    setSearch: (search: { city?: string; q?: string }) =>
      update((next) => {
        next.delete('city')
        next.delete('q')
        if (search.city) next.set('city', search.city)
        else if (search.q) next.set('q', search.q)
      }),
    setPrice: (value: PriceRange | undefined) => set('price', value),
    categoryHref,
    clear: () => setParams({}, { preventScrollReset: true }),
  }
}
