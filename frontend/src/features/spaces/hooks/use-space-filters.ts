import { useSearchParams } from 'react-router'

import {
  PRICE_RANGES,
  isPriceRange,
  isSpaceCategory,
  type PriceRange,
  type SpaceCategory,
  type SpaceFilters,
} from '../types'

type FilterParam = 'search' | 'category' | 'price'

// Explore's filters live in the URL (?search=&category=&price=), so a link from Home, a refresh and the
// Back button all keep them. Changing one filter keeps the others.
export function useSpaceFilters() {
  const [params, setParams] = useSearchParams()

  const search = params.get('search') ?? ''
  const categoryParam = params.get('category')
  const category = isSpaceCategory(categoryParam) ? categoryParam : undefined
  const priceParam = params.get('price')
  const price = isPriceRange(priceParam) ? priceParam : undefined

  const set = (name: FilterParam, value: string | undefined) =>
    setParams(
      (prev) => {
        if (value) prev.set(name, value)
        else prev.delete(name)
        return prev
      },
      { preventScrollReset: true },
    )

  const filters: SpaceFilters = {
    status: 'listed',
    search: search || undefined,
    category,
    minPrice: price && PRICE_RANGES[price].minPrice,
    maxPrice: price && PRICE_RANGES[price].maxPrice,
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
    search,
    category,
    price,
    filters,
    hasFilters: Boolean(search || category || price),
    // The filter button on Home links here with ?filters=open, so the price chips are already showing
    filtersRequested: params.get('filters') === 'open',
    setSearch: (value: string) => set('search', value.trim() || undefined),
    setPrice: (value: PriceRange | undefined) => set('price', value),
    categoryHref,
    clear: () => setParams({}, { preventScrollReset: true }),
  }
}
