import type { UseFormRegisterReturn } from 'react-hook-form'

import { CATEGORY_LABELS, type SpaceCategory } from '../types'

type CategoryPickerProps = {
  field: UseFormRegisterReturn<'category'>
  error?: string
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [SpaceCategory, string][]

// Pill chips backed by real radio buttons, so arrow keys move between them and screen readers
// announce "Desk, radio button, 1 of 4". The selected chip has a primary border, like the category row.
export function CategoryPicker({ field, error }: CategoryPickerProps) {
  return (
    <fieldset
      className="grid gap-2"
      aria-describedby={error ? 'category-error' : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-2 px-4 text-sm leading-none font-medium">Category</legend>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(([value, label]) => (
          <label
            key={value}
            className="flex h-11 cursor-pointer items-center rounded-full border border-input bg-card px-4 text-sm font-medium transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring md:h-9"
          >
            <input type="radio" value={value} className="sr-only" {...field} />
            {label}
          </label>
        ))}
      </div>
      {error && (
        <p id="category-error" className="px-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  )
}
