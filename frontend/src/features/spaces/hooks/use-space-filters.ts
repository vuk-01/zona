import { useSearchParams } from 'react-router'

import type { FilterChip } from '../components/search-filter-chip'
import {
  PRICE_RANGES,
  isPriceRange,
  isSpaceCategory,
  type PriceRange,
  type SpaceCategory,
  type SpaceFilters,
} from '../types'

type FilterParam = 'q' | 'city' | 'category' | 'price'

// Explore's filters live in the URL (?q=&city=&category=&price=), so a search from Home, a refresh and the
// Back button all keep them. Changing one filter keeps the others. The search is either a city picked from
// the list (?city=, the exact name) or free text that matches a space's name or city (?q=).
export function useSpaceFilters() {
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  const city = params.get('city') ?? ''
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

  // One removable chip per active search, above the results
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
