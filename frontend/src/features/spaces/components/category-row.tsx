import { cva } from 'class-variance-authority'
import { useState } from 'react'
import { Link } from 'react-router'

import { useActiveIndicator } from '@/lib/use-active-indicator'

import type { CategoryOption } from '../hooks/use-category-stats'
import { CATEGORY_LABELS, type SpaceCategory } from '../types'
import { CategoryIllustration } from './category-illustration'
import { spacesCount } from './format-spaces'

const options: { value: CategoryOption; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(CATEGORY_LABELS) as SpaceCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  })),
]

const defaultHref = (value: CategoryOption) => (value === 'all' ? '/spaces' : `/spaces?category=${value}`)

const itemVariants = cva(
  // relative: painted above the selection box
  'group relative flex w-16 flex-col items-center gap-2 rounded-lg px-1 py-2 text-center text-xs outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring md:w-28 md:text-sm',
  {
    variants: {
      // The selection box behind the item is the selected look; the label only turns semibold
      selected: {
        true: 'font-semibold text-secondary-foreground',
        false: 'font-medium text-foreground hover:bg-accent',
      },
    },
  },
)

const countVariants = cva(
  'absolute -top-2 -right-2 grid h-5 min-w-5 place-items-center rounded-full border px-1 text-xs leading-none font-semibold tabular-nums transition-colors duration-300',
  {
    variants: {
      selected: {
        true: 'border-primary bg-primary text-primary-foreground',
        false: 'bg-card text-foreground',
      },
    },
  },
)

type CategoryRowProps = {
  // The category shown on the current page; on Home nothing is selected.
  selected?: CategoryOption
  // Explore passes its own links so a category change keeps the search and price filters.
  hrefFor?: (value: CategoryOption) => string
  // Spaces per category, as a badge on each illustration; left out while they load.
  counts?: Record<CategoryOption, number>
}

// Illustration + label per category; each one opens Explore filtered by that category. On Explore a
// selection box (secondary with a primary border) slides to the chosen one. Phones: centered, and when
// the categories do not fit one row they wrap, the last row centered too.
export function CategoryRow({ selected, hrefFor = defaultHref, counts }: CategoryRowProps) {
  const [list, setList] = useState<HTMLUListElement | null>(null)
  const box = useActiveIndicator(list, '[aria-current="page"]', selected)

  return (
    <nav aria-label="Categories">
      {/* pt-3: room for the count badges; the items are not positioned, so the list is their offset parent */}
      <ul ref={setList} className="relative flex flex-wrap justify-center pt-3 md:justify-start md:gap-2">
        {box && (
          <li
            role="presentation"
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 rounded-lg border border-primary bg-secondary transition-[translate,width,height] duration-300 ease-out motion-reduce:transition-none"
            style={{ translate: `${box.x}px ${box.y}px`, width: box.width, height: box.height }}
          />
        )}
        {options.map(({ value, label }) => (
          <li key={value}>
            <Link
              to={hrefFor(value)}
              preventScrollReset
              aria-current={value === selected ? 'page' : undefined}
              className={itemVariants({ selected: value === selected })}
            >
              <span className="relative inline-flex">
                <CategoryIllustration
                  category={value}
                  className="transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-1"
                />
                {counts && (
                  <span className={countVariants({ selected: value === selected })} aria-hidden="true">
                    {counts[value]}
                  </span>
                )}
              </span>
              {label}
              {counts && <span className="sr-only">, {spacesCount(counts[value])}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
