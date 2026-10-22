import { Clock } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export type TimeOption = {
  value: string
  // "09:00"
  label: string
}

type TimeSelectProps = Omit<ComponentProps<typeof SelectTrigger>, 'value' | 'defaultValue' | 'children'> & {
  value: string
  onValueChange: (value: string) => void
  options: TimeOption[]
}

// A whole hour (booking From / To, a space's opening hours), DESIGN.md "Time select": a pill with a clock,
// the hour and a chevron chip that turns when the list opens. The list drops down under the field and
// slides back up when it closes; it shows about six hours and scrolls to the selected one. The other
// props (id, aria-*, ref, onBlur) go to the trigger, so a <Label htmlFor> and react-hook-form work.
export function TimeSelect({ value, onValueChange, options, className, ...triggerProps }: TimeSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          'w-full pr-2 pl-4 text-base font-medium tabular-nums focus-visible:ring-ring md:text-sm',
          className,
        )}
        {...triggerProps}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Clock
            className="size-4 text-muted-foreground transition-colors group-hover:text-primary group-data-[state=open]:text-primary"
            aria-hidden="true"
          />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        position="popper"
        className="max-h-[min(18rem,var(--radix-select-content-available-height))]"
      >
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="tabular-nums">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
