import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { SearchSuggestions } from '@/features/spaces/components/search-suggestions'

// Temporary (/dev/search): the city search on its own until it moves onto Home and Explore; delete this
// route then. It sits in a hero panel on purpose, so the test shows the list opening past its
// overflow-hidden edge, as it will have to there.
export function DevSearch() {
  return (
    <section className="flex flex-col gap-8 md:gap-12">
      <HeroPanel>
        <PageTitle>Search by city</PageTitle>
        <SearchSuggestions />
      </HeroPanel>
    </section>
  )
}
