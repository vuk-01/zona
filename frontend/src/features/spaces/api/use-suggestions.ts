import { useQuery } from '@tanstack/react-query'

import { suggestionsApi } from './suggestions-api'

// Every city with spaces, for the search field. The key starts with 'spaces', so adding or deleting a
// space (which invalidates ['spaces']) refreshes the counts too.
export function useCitySuggestions() {
  return useQuery({
    queryKey: ['spaces', 'cities'],
    queryFn: () => suggestionsApi.list(),
  })
}
