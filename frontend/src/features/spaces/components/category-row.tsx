import { cva } from 'class-variance-authority'
import { Link } from 'react-router'

import { CATEGORY_LABELS, type SpaceCategory } from '../types'
import { CategoryIllustration } from './category-illustration'

type CategoryOption = SpaceCategory | 'all'

const options: { value: CategoryOption; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(CATEGORY_LABELS) as SpaceCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABELS[value],
  })),
]

const defaultHref = (value: CategoryOption) => (value === 'all' ? '/spaces' : `/spaces?category=${value}`)

const itemVariants = cva(
  'flex w-16 flex-col items-center gap-2 rounded-lg border px-1 py-2 text-center text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring md:w-28 md:text-sm',
  {
    variants: {
      selected: {
        true: 'border-primary text-primary',
        false: 'border-transparent text-foreground',
      },
    },
  },
)

type CategoryRowProps = {
  // The category shown on the current page; on Home nothing is selected.
  selected?: CategoryOption
  // Explore passes its own links so a category change keeps the search and price filters.
  hrefFor?: (value: CategoryOption) => string
}

// Illustration + label per category; each one opens Explore filtered by that category.
export function CategoryRow({ selected, hrefFor = defaultHref }: CategoryRowProps) {
  return (
    <nav aria-label="Categories">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:gap-2 md:px-0">
        {options.map(({ value, label }) => (
          <li key={value} className="shrink-0">
            <Link
              to={hrefFor(value)}
              preventScrollReset
              aria-current={value === selected ? 'page' : undefined}
              className={itemVariants({ selected: value === selected })}
            >
              <CategoryIllustration category={value} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
