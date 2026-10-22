import { cva } from 'class-variance-authority'

import { PRICE_RANGES, type PriceRange } from '../types'

const chipVariants = cva(
  'h-11 shrink-0 rounded-full border px-3 text-sm md:h-9 md:px-4 font-medium outline-none transition-[translate,background-color,border-color,color,box-shadow] duration-200 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      selected: {
        true: 'border-primary bg-primary text-primary-foreground',
        // Like the buttons: lifts with the soft shadow and turns blue on hover
        false:
          'border-input bg-card text-foreground hover:border-primary hover:text-primary hover:shadow-soft motion-safe:hover:-translate-y-0.5',
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

// Price per hour as pill chips; one is always selected ("Any" when there is no price filter). The panel
// slides in when the filter button opens it.
export function PriceFilter({ id, value, onChange }: PriceFilterProps) {
  return (
    <div
      id={id}
      role="group"
      aria-labelledby="price-filter-label"
      className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300"
    >
      <span id="price-filter-label" className="text-sm font-medium">
        Price per hour
      </span>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:gap-2 md:overflow-visible md:px-0">
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
