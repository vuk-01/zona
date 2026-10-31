import type { Weekday } from '../types'

// The backend's clock: dates, hours and weekdays of bookings are local time in Podgorica, whatever the
// browser's time zone is.
const clock = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Podgorica',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})

const WEEKDAYS: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
}

// Today's date ('YYYY-MM-DD'), the current hour (0–23) and the weekday in Podgorica
export function podgoricaNow(now = new Date()) {
  const parts = Object.fromEntries(clock.formatToParts(now).map((part) => [part.type, part.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: WEEKDAYS[parts.weekday] ?? 'mon',
  }
}
