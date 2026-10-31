// The cities are still a mock (GET /api/spaces/cities is not built); the delay stands in for the request.
const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 400))

// One city in the search suggestions. Contract with the backend: docs/search-suggestions.md
export type CitySuggestion = {
  name: string
  // Listed spaces in that city
  count: number
}

// Towns in Montenegro with a made-up number of listed spaces; GET /api/spaces/cities will count the real
// ones. Šavnik and Plužine have none, so they are never listed.
const cities: CitySuggestion[] = [
  { name: 'Podgorica', count: 128 },
  { name: 'Nikšić', count: 46 },
  { name: 'Budva', count: 41 },
  { name: 'Bar', count: 33 },
  { name: 'Herceg Novi', count: 27 },
  { name: 'Kotor', count: 24 },
  { name: 'Tivat', count: 19 },
  { name: 'Cetinje', count: 15 },
  { name: 'Bijelo Polje', count: 12 },
  { name: 'Ulcinj', count: 11 },
  { name: 'Berane', count: 8 },
  { name: 'Pljevlja', count: 7 },
  { name: 'Danilovgrad', count: 6 },
  { name: 'Rožaje', count: 5 },
  { name: 'Kolašin', count: 4 },
  { name: 'Žabljak', count: 3 },
  { name: 'Mojkovac', count: 2 },
  { name: 'Plav', count: 1 },
  { name: 'Andrijevica', count: 1 },
  { name: 'Šavnik', count: 0 },
  { name: 'Plužine', count: 0 },
]

// Same rules as the backend: every city with a listed space, most spaces first. The search field filters
// them itself (search-suggestions.tsx), so this is asked once, not on every keystroke.
function list(): Promise<CitySuggestion[]> {
  const listed = cities
    .filter((city) => city.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'sr'))
  return delay(listed)
}

export const suggestionsApi = { list }
