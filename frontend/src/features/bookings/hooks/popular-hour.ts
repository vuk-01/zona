import type { BookableSpace } from '../types'

type DayHours = BookableSpace['openingHours'][keyof BookableSpace['openingHours']]

// "HH:mm" on a whole hour to the hour; "24:00" (midnight at closing) is 24
const toHour = (time: string) => Number(time.slice(0, 2))

// Whether the space is open during the hour that starts at `hour` (the slot is [open, close)); a closed
// day (null) is never open.
export function isOpenAt(hours: DayHours, hour: number) {
  return hours !== null && toHour(hours.open) <= hour && hour < toHour(hours.close)
}

// The chart index of the current hour, so Popular time marks it also when it is usually quiet (0);
// null when the hour is outside the chart (firstHour…firstHour + length − 1) or the space is closed then.
export function currentHourIndex(firstHour: number, length: number, hour: number, hours: DayHours) {
  const index = hour - firstHour
  if (index < 0 || index >= length || !isOpenAt(hours, hour)) return null
  return index
}
