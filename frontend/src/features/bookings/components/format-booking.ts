// Dates are stored as 'YYYY-MM-DD'; formatting them in UTC keeps the day from shifting.
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

// "Wed 21 Oct"
export const formatBookingDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`))

// Slots are whole hours, 'HH:00'
export const bookingHours = (start: string, end: string) =>
  Number(end.slice(0, 2)) - Number(start.slice(0, 2))
