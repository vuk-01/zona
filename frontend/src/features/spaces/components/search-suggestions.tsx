import { MapPin, MapPinOff, Search } from 'lucide-react'
import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'

import type { CitySuggestion } from '../api/suggestions-api'
import { useCitySuggestions } from '../api/use-suggestions'
import { spacesCount } from './format-spaces'

const NO_CITY = 'No city matches this search'
const NO_CITIES_YET = 'No cities with spaces yet'
// "19 cities", "1 city": what the status line reads out
const citiesCount = (count: number) => `${count} ${count === 1 ? 'city' : 'cities'}`

// "Nikšić" -> "niksic": lowercase, without accents. NFD splits š, č, ć and ž into a letter and a mark;
// đ is a letter of its own (no mark to drop), so it is mapped by hand.
const fold = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replaceAll('đ', 'd')

type Match = { start: number; end: number }

// Where the folded term sits in the original name. The name is folded letter by letter, remembering which
// letter each folded character came from, so "niksic" marks all of "Nikšić". A mark stored as its own
// character folds to nothing and stays with its letter.
function findMatch(name: string, term: string): Match | null {
  let folded = ''
  const from: number[] = []
  for (let i = 0; i < name.length; i++) {
    for (const char of fold(name[i])) {
      folded += char
      from.push(i)
    }
  }
  const at = folded.indexOf(term)
  if (at === -1) return null
  let end = from[at + term.length - 1] + 1
  while (end < name.length && fold(name[end]) === '') end++
  return { start: from[at], end }
}

type CityRow = CitySuggestion & { match: Match | null }

// An empty field lists every city. Otherwise the cities whose name starts with the term come first, then
// the ones that only contain it; both keep the API's order (most spaces first).
function filterCities(cities: CitySuggestion[], query: string): CityRow[] {
  const term = fold(query.trim())
  if (!term) return cities.map((city) => ({ ...city, match: null }))

  const starts: CityRow[] = []
  const contains: CityRow[] = []
  for (const city of cities) {
    const match = findMatch(city.name, term)
    if (match) (match.start === 0 ? starts : contains).push({ ...city, match })
  }
  return [...starts, ...contains]
}

// A pill row like the time select's: the arrow keys or the pointer give it an accent background, turn
// the pin primary and nudge the name right. shrink-0: in the scrolling list the rows keep their height
// instead of squeezing together.
const optionClass =
  'group flex h-11 shrink-0 items-center gap-3 rounded-full px-4 outline-none transition-colors aria-selected:bg-accent aria-selected:text-accent-foreground md:h-10'

// Explore's city filter (connected later)
const cityHref = (city: string) => `/spaces?${new URLSearchParams({ city })}`

// Typing makes the best match active; an empty field has none, so Enter on the untouched list goes nowhere
const firstRow = (text: string) => (text.trim() ? 0 : -1)

// Search pill with city suggestions (docs/ref/search-reference.png, cities only). A click or focus opens
// every city with spaces under the field, most spaces first, and the list scrolls after six. Typing
// filters it (starts with the term first, then contains it; case and accents do not matter) and bolds
// the matching part. ↑/↓ move, Enter or a click opens that city on Explore, Esc or a click outside
// closes. The list is portaled, so it also opens fully inside the hero panel (overflow-hidden), and it
// is as wide as the field: full width on phones.
export function SearchSuggestions() {
  const navigate = useNavigate()
  const listId = useId()
  const headingId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const { data, isPending, isError, isFetching, refetch } = useCitySuggestions()

  const rows = filterCities(data ?? [], value)
  const hasOptions = !isPending && !isError && rows.length > 0
  const activeIndex = Math.min(active, rows.length - 1)
  const activeRow = open && hasOptions && activeIndex >= 0 ? rows[activeIndex] : undefined
  const optionId = (index: number) => `${listId}-option-${index}`
  const emptyText = value.trim() ? NO_CITY : NO_CITIES_YET

  const openList = () => {
    if (open) return
    setOpen(true)
    setActive(firstRow(value))
  }

  const moveTo = (index: number) => {
    setActive(index)
    // Only the keys scroll the list; the pointer already sees the row it is on
    listRef.current?.children.item(index)?.scrollIntoView({ block: 'nearest' })
  }

  const choose = (city: string) => {
    setValue(city)
    setOpen(false)
    navigate(cityHref(city))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        // A closed list (after Esc) opens again on its first city
        if (!open) {
          setOpen(true)
          setActive(0)
        } else if (hasOptions) {
          // From no row, ↓ goes to the first city and ↑ to the last; then they wrap around
          const down = event.key === 'ArrowDown'
          const last = rows.length - 1
          const next =
            activeIndex < 0 ? (down ? 0 : last) : (activeIndex + (down ? 1 : -1) + rows.length) % rows.length
          moveTo(next)
        }
        break
      }
      case 'Enter':
        if (!open) break
        event.preventDefault()
        if (isError) void refetch()
        else if (activeRow) choose(activeRow.name)
        break
      case 'Escape':
        // Without preventDefault, Chrome also empties a search field on Esc
        if (open) {
          event.preventDefault()
          setOpen(false)
        }
        break
    }
  }

  const status = !open || isPending || isError ? '' : hasOptions ? citiesCount(rows.length) : emptyText

  return (
    <div className="w-full max-w-2xl">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="group relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
              aria-hidden="true"
            />
            <Input
              type="search"
              role="combobox"
              aria-label="Search by city"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={open && hasOptions ? listId : undefined}
              aria-activedescendant={activeRow ? optionId(activeIndex) : undefined}
              placeholder="Search by city"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setActive(firstRow(event.target.value))
                setOpen(true)
                // A new term starts the list from the top
                listRef.current?.scrollTo({ top: 0 })
              }}
              onFocus={openList}
              // The field already has focus after Esc, so a click opens the list again
              onClick={openList}
              onKeyDown={onKeyDown}
              className="h-12 rounded-full bg-muted pr-4 pl-12 transition-[color,background-color,border-color,box-shadow] duration-200 hover:border-primary focus-visible:bg-card focus-visible:ring-ring"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          // Not a dialog: the field keeps focus and points into the listbox (aria-activedescendant)
          role={undefined}
          side="bottom"
          align="start"
          sideOffset={8}
          avoidCollisions={false}
          // 1rem from the bottom of the screen; when that is close (a phone's keyboard), the list gets
          // shorter and scrolls
          collisionPadding={16}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // Clicking or focusing the field itself keeps the list open
          onInteractOutside={(event) => {
            if (event.target instanceof Node && anchorRef.current?.contains(event.target))
              event.preventDefault()
          }}
          // Keep focus in the field, so a click on a row lands before the list closes
          onMouseDown={(event) => event.preventDefault()}
          className="flex max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) flex-col p-2"
        >
          {isError ? (
            <div className="flex flex-wrap items-center justify-between gap-2 py-1 pr-1 pl-4">
              <p role="alert" className="text-sm text-destructive">
                Cities failed to load.
              </p>
              <Button
                variant="outline"
                className="h-11 rounded-full focus-visible:ring-ring md:h-9"
                disabled={isFetching}
                onClick={() => refetch()}
              >
                Try again
              </Button>
            </div>
          ) : isPending ? (
            <div aria-hidden="true" className="flex flex-col gap-1">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-11 rounded-full md:h-10" />
              ))}
            </div>
          ) : hasOptions ? (
            <>
              {/* Like the side menu's section titles; it stays put while the cities scroll */}
              <p
                id={headingId}
                className="shrink-0 px-4 pt-1 pb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase"
              >
                Cities
              </p>
              <div
                ref={listRef}
                role="listbox"
                id={listId}
                aria-labelledby={headingId}
                // Six rows and half of the seventh, so it shows that the list goes on
                className="flex max-h-78 min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain md:max-h-71"
              >
                {rows.map((city, index) => (
                  <Link
                    key={city.name}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    to={cityHref(city.name)}
                    onMouseMove={() => setActive(index)}
                    onClick={() => setOpen(false)}
                    className={optionClass}
                  >
                    <MapPin
                      className="size-5 shrink-0 text-muted-foreground transition-colors group-aria-selected:text-primary"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-base font-medium motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-aria-selected:translate-x-1 md:text-sm">
                      {city.match ? (
                        <>
                          {city.name.slice(0, city.match.start)}
                          {/* The part that matches the search; screen readers still hear the whole name */}
                          <mark className="bg-transparent font-bold text-inherit">
                            {city.name.slice(city.match.start, city.match.end)}
                          </mark>
                          {city.name.slice(city.match.end)}
                        </>
                      ) : (
                        city.name
                      )}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums group-aria-selected:text-accent-foreground">
                      {spacesCount(city.count)}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p className="flex h-11 items-center gap-3 px-4 text-sm text-muted-foreground md:h-10">
              <MapPinOff className="size-5 shrink-0" aria-hidden="true" />
              {emptyText}
            </p>
          )}
        </PopoverContent>
      </Popover>
      {/* Screen readers hear how many cities the list has */}
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  )
}
