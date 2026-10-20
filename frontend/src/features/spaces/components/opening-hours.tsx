import { cva } from 'class-variance-authority'

import type { OpeningHours as Hours, Weekday } from '../types'

const DAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
]
const TODAY_INDEX: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const rowVariants = cva('flex justify-between gap-4 rounded-full px-4 py-2 text-sm', {
  variants: {
    today: {
      true: 'bg-secondary font-semibold text-secondary-foreground',
      false: '',
    },
  },
})

type OpeningHoursProps = {
  hours: Hours
}

// The whole week; today is highlighted, closed days say so.
export function OpeningHours({ hours }: OpeningHoursProps) {
  const today = TODAY_INDEX[new Date().getDay()]

  return (
    <dl className="flex flex-col gap-1">
      {DAYS.map(({ key, label }) => {
        const day = hours[key]
        return (
          <div key={key} className={rowVariants({ today: key === today })}>
            <dt>
              {label}
              {key === today && <span className="sr-only"> (today)</span>}
            </dt>
            <dd className={day ? '' : 'text-muted-foreground'}>
              {day ? `${day.open}–${day.close}` : 'Closed'}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
