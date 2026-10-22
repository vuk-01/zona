import { cva } from 'class-variance-authority'

import { PRICE_RANGES, type PriceRange } from '../types'

const chipVariants = cva(
  'h-11 shrink-0 rounded-full border px-3 text-sm md:h-9 md:px-4 font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      selected: {
        true: 'border-primary bg-primary text-primary-foreground',
        false: 'border-input bg-card text-foreground hover:bg-accent',
      },
    },
  },
)

const options: { value: PriceRange | undefined; label: string }[] = [
  { value: undefined, label: 'Any' },
  ...(Object.keys(PRICE_RANGES) as PriceRange[]).map((value) => ({
    value,
    label: PRICE_RANGES[value].label,
  })),
]

type PriceFilterProps = {
  id?: string
  value: PriceRange | undefined
  onChange: (value: PriceRange | undefined) => void
}

// Price per hour as pill chips; one is always selected ("Any" when there is no price filter).
export function PriceFilter({ id, value, onChange }: PriceFilterProps) {
  return (
    <div id={id} role="group" aria-labelledby="price-filter-label" className="flex flex-col gap-3">
      <span id="price-filter-label" className="text-sm font-medium">
        Price per hour
      </span>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:gap-2 md:px-0">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={option.value === value}
            className={chipVariants({ selected: option.value === value })}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
