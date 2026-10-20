import { useSearchParams } from 'react-router'

import type { BookableSpace, NewBooking, Weekday } from '../types'

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const BOOKABLE_DAYS = 60

// Dates are 'YYYY-MM-DD' in the browser's time zone; parsing them as UTC keeps the weekday stable.
const localDate = (date: Date) => new Intl.DateTimeFormat('en-CA').format(date)
const atUtcNoon = (date: string) => new Date(`${date}T12:00:00Z`)
const weekdayName = (date: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(atUtcNoon(date))

const hourOf = (time: string) => Number(time.slice(0, 2))
export const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`
const range = (from: number, to: number) =>
  Array.from({ length: Math.max(to - from + 1, 0) }, (_, i) => from + i)

// The slot being picked on a space page, kept in the URL (?date=&from=&to=) so it survives the trip
// through /login. Invalid or missing values fall back to the first bookable hour.
export function useBookingSlot(space: BookableSpace) {
  const [params, setParams] = useSearchParams()

  const now = new Date()
  const today = localDate(now)
  const maxDate = localDate(new Date(now.getTime() + BOOKABLE_DAYS * 86_400_000))

  const dateParam = params.get('date')
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam >= today && dateParam <= maxDate
      ? dateParam
      : today

  const dayHours = space.openingHours[WEEKDAYS[atUtcNoon(date).getUTCDay()]]
  // Today, only hours that have not started yet
  const earliest = dayHours ? Math.max(hourOf(dayHours.open), date === today ? now.getHours() + 1 : 0) : 0
  const fromOptions = dayHours ? range(earliest, hourOf(dayHours.close) - 1) : []

  const fromParam = Number(params.get('from'))
  const from = fromOptions.includes(fromParam) ? fromParam : fromOptions[0]
  const toOptions = dayHours && from !== undefined ? range(from + 1, hourOf(dayHours.close)) : []
  const toParam = Number(params.get('to'))
  const to = toOptions.includes(toParam) ? toParam : toOptions[0]

  const closedReason = !dayHours
    ? `Closed on ${weekdayName(date)}s`
    : fromOptions.length === 0
      ? 'No more hours today. Pick another date.'
      : null

  const slot: NewBooking | null =
    from !== undefined && to !== undefined
      ? { spaceId: space.id, date, startTime: formatHour(from), endTime: formatHour(to) }
      : null

  const set = (changes: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        for (const [name, value] of Object.entries(changes)) {
          if (value === undefined) prev.delete(name)
          else prev.set(name, value)
        }
        return prev
      },
      { replace: true, preventScrollReset: true },
    )

  return {
    date,
    today,
    maxDate,
    from,
    to,
    fromOptions,
    toOptions,
    closedReason,
    slot,
    hours: from !== undefined && to !== undefined ? to - from : 0,
    // A new date resets the hours to that day's first free hour
    setDate: (value: string) => set({ date: value || undefined, from: undefined, to: undefined }),
    // Moving "from" keeps the same length when it still fits, else one hour
    setFrom: (value: number) =>
      set({ from: String(value), to: to !== undefined && to > value ? String(to) : String(value + 1) }),
    setTo: (value: number) => set({ to: String(value) }),
  }
}
