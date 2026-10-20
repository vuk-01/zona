import { useSearchParams } from 'react-router'

import { PageTitle } from '@/components/layout/page-title'
import { CategoryRow } from '@/features/spaces/components/category-row'
import { SpaceSearch } from '@/features/spaces/components/space-search'
import { SpacesList } from '@/features/spaces/components/spaces-list'
import { isSpaceCategory } from '@/features/spaces/types'

// Explore: all listed spaces, filtered by ?category= and ?search= (links from Home). The filters
// panel comes later.
export function Spaces() {
  const [params] = useSearchParams()
  const categoryParam = params.get('category')
  const category = isSpaceCategory(categoryParam) ? categoryParam : undefined
  const search = params.get('search') ?? ''

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageTitle>Explore spaces</PageTitle>
      {/* key: a new ?search= from the URL resets the field */}
      <SpaceSearch key={search} defaultValue={search} />
      <CategoryRow selected={category ?? 'all'} />
      <SpacesList filters={{ status: 'listed', category, search }} />
    </section>
  )
}
