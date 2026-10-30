import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'

// The active search above Explore's results ("Podgorica", "“hub”") and how to remove it
export type FilterChip = {
  key: string
  label: string
  // What screen readers hear: "Remove city filter Podgorica"
  removeLabel: string
  remove: () => void
}

type SearchFilterChipProps = {
  chip: FilterChip
  // Called after the filter is removed (Explore moves focus to the results, since the chip is gone)
  onRemoved?: () => void
}

// A selected chip (DESIGN.md: secondary background, primary border, secondary-foreground label) with an
// X. The whole chip is the button, so it is a 44 px target on phones.
export function SearchFilterChip({ chip, onRemoved }: SearchFilterChipProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={chip.removeLabel}
      onClick={() => {
        chip.remove()
        onRemoved?.()
      }}
      className="h-11 max-w-full rounded-full border border-primary pr-3 pl-4 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
    >
      <span className="truncate">{chip.label}</span>
      <X className="size-4" aria-hidden="true" />
    </Button>
  )
}
