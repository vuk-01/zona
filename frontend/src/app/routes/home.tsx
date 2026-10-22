import { Link } from 'react-router'

import { PageTitle } from '@/components/layout/page-title'
import { CategoryRow } from '@/features/spaces/components/category-row'
import { SpaceSearch } from '@/features/spaces/components/space-search'
import { SpacesList } from '@/features/spaces/components/spaces-list'

// Guest home (slika2): search, categories, then a few listed spaces.
export function Home() {
  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <PageTitle>Find your zone</PageTitle>
      <SpaceSearch />
      <CategoryRow />

      <section aria-labelledby="spaces-near-you" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 id="spaces-near-you" className="text-lg font-semibold">
            Spaces near you
          </h2>
          <Link
            to="/spaces"
            className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0"
          >
            See all
          </Link>
        </div>
        <SpacesList
          filters={{ status: 'listed' }}
          limit={6}
          emptyMessage="No spaces are listed yet. Check back soon."
        />
      </section>
    </section>
  )
}
