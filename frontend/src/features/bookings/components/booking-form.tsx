import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { UseFormSetError } from 'react-hook-form'
import { Link } from 'react-router'

import { TimeSelect } from '@/components/form/time-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/api-client'
import { applyFieldErrors } from '@/lib/form-errors'

import { useCreateBooking, useSlotAvailability } from '../api/use-bookings'
import { formatHour, useBookingSlot } from '../hooks/use-booking-slot'
import type { BookableSpace, BookingGuest, NewBooking } from '../types'

const euros = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
const shortDayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

const fieldClass =
  'h-12 w-full rounded-full border border-input bg-card px-4 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:text-sm'

const hourOption = (hour: number) => ({ value: String(hour), label: formatHour(hour) })

// The fields the backend's fieldErrors name (invalid_slot, booking_in_past, booking_too_far_ahead,
// validation_error), and the element each one shows under.
type SlotFields = { date: string; startTime: string; endTime: string }
const SLOT_FIELDS = ['date', 'startTime', 'endTime'] as const
const FIELD_IDS: Record<keyof SlotFields, string> = {
  date: 'booking-date',
  startTime: 'booking-from',
  endTime: 'booking-to',
}

const slotKey = ({ date, startTime, endTime }: NewBooking) => `${date} ${startTime}–${endTime}`

// A refused booking: messages under the fields, and the detail for the alert when some error has no
// field (slot_full, cannot_book_own_space). Kept for the slot it was about; picking another hides it.
type BookingErrors = {
  slot: string
  fields: Partial<SlotFields>
  detail: string | null
}

type BookingFormProps = {
  space: BookableSpace
  // The signed-in user; null for a visitor (Book then opens the login dialog), undefined while it loads
  user: BookingGuest | null | undefined
  // Opens the login dialog over this page; `continueWith` runs with the user once they are signed in
  onLogin: (continueWith: (guest: BookingGuest) => void) => void
}

// Date + whole-hour slot inside the opening hours, live availability, the total and "Book".
// On phones "Book" sits in a bar fixed above the bottom navigation.
export function BookingForm({ space, user, onLogin }: BookingFormProps) {
  const slot = useBookingSlot(space)
  const availability = useSlotAvailability(slot.slot)
  const createBooking = useCreateBooking()
  const resultRef = useRef<HTMLDivElement>(null)
  const [errors, setErrors] = useState<BookingErrors | null>(null)
  const shownErrors = errors && slot.slot && errors.slot === slotKey(slot.slot) ? errors : null
  const fieldError = (field: keyof SlotFields) => shownErrors?.fields[field]
  const describedBy = (field: keyof SlotFields) =>
    fieldError(field) ? `${FIELD_IDS[field]}-error` : undefined
  // The backend's message for one field, under it; the field points here with aria-describedby
  const fieldErrorText = (field: keyof SlotFields) =>
    fieldError(field) && (
      <p id={describedBy(field)} className="px-4 text-sm text-destructive">
        {fieldError(field)}
      </p>
    )

  const isDesk = space.category === 'desk'
  const isOwnSpace = user != null && space.host.id === user.id
  const total = space.pricePerHour * slot.hours
  const isFree = availability.data?.available === true
  const canBook = slot.slot !== null && isFree && !isOwnSpace && !createBooking.isPending
  // A visitor can press it while the slot is free; it opens the login dialog first

  // The Book button goes away (success): move focus there
  useEffect(() => {
    if (createBooking.isSuccess) resultRef.current?.focus()
  }, [createBooking.isSuccess])

  // A refused booking: focus the first field at fault, or the alert when no field is
  useEffect(() => {
    if (!errors) return
    const field = SLOT_FIELDS.find((name) => errors.fields[name])
    if (field) document.getElementById(FIELD_IDS[field])?.focus()
    else resultRef.current?.focus()
  }, [errors])

  function book(input: NewBooking) {
    setErrors(null)
    createBooking.mutate(input, {
      onError: (error) => {
        const fields: Partial<SlotFields> = {}
        // The form keeps the slot in the URL, not in react-hook-form, so the field errors go to state
        const setError: UseFormSetError<SlotFields> = (name, { message }) => {
          if (name === 'date' || name === 'startTime' || name === 'endTime') fields[name] = message
        }
        const detail = applyFieldErrors(error, setError, SLOT_FIELDS)
        setErrors({ slot: slotKey(input), fields, detail })
      },
    })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!slot.slot) return
    if (user === null) {
      // The dialog opens over this page, so the picked slot stays. Once signed in the booking goes on,
      // unless the space turns out to be theirs (the form then says so).
      const picked = slot.slot
      onLogin((guest) => {
        if (space.host.id !== guest.id) book(picked)
      })
      return
    }
    if (!user || !canBook) return
    book(slot.slot)
  }

  if (createBooking.isSuccess) {
    const booking = createBooking.data
    return (
      <div
        ref={resultRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col gap-4 rounded-lg border bg-card p-6 outline-none"
      >
        <CircleCheck className="size-8 text-primary" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Booking request sent</h2>
          <p className="text-sm text-muted-foreground">
            {dayFormat.format(new Date(`${booking.date}T12:00:00Z`))}, {booking.startTime}–{booking.endTime} ·{' '}
            {euros.format(booking.totalPrice)}. The host will confirm it soon.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="h-11 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 md:h-9"
          >
            <Link to="/bookings">View my bookings</Link>
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full px-6 focus-visible:ring-ring md:h-9"
            onClick={() => createBooking.reset()}
          >
            Book another time
          </Button>
        </div>
      </div>
    )
  }

  const bookLabel = user === null ? 'Log in to book' : 'Book'

  return (
    <form
      onSubmit={submit}
      aria-labelledby="book-heading"
      className="flex flex-col gap-6 rounded-lg border bg-card p-6 dark:scheme-dark"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="book-heading" className="text-lg font-semibold">
          Book this space
        </h2>
        <span className="text-sm">
          <span className="font-semibold">{euros.format(space.pricePerHour)}</span>{' '}
          <span className="text-muted-foreground">{isDesk ? '/desk·hr' : '/hr'}</span>
        </span>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="booking-date">Date</Label>
          <Input
            id="booking-date"
            type="date"
            min={slot.today}
            max={slot.maxDate}
            value={slot.date}
            onChange={(event) => slot.setDate(event.target.value)}
            aria-invalid={fieldError('date') ? true : undefined}
            aria-describedby={describedBy('date')}
            className={`${fieldClass} shadow-none`}
          />
          {fieldErrorText('date')}
        </div>

        {slot.closedReason ? (
          <p className="text-sm text-muted-foreground">{slot.closedReason}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="booking-from">From</Label>
              <TimeSelect
                id="booking-from"
                value={String(slot.from ?? '')}
                onValueChange={(value) => slot.setFrom(Number(value))}
                options={slot.fromOptions.map(hourOption)}
                aria-invalid={fieldError('startTime') ? true : undefined}
                aria-describedby={describedBy('startTime')}
                className="h-12 bg-card md:h-12"
              />
              {fieldErrorText('startTime')}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="booking-to">To</Label>
              <TimeSelect
                id="booking-to"
                value={String(slot.to ?? '')}
                onValueChange={(value) => slot.setTo(Number(value))}
                options={slot.toOptions.map(hourOption)}
                aria-invalid={fieldError('endTime') ? true : undefined}
                aria-describedby={describedBy('endTime')}
                className="h-12 bg-card md:h-12"
              />
              {fieldErrorText('endTime')}
            </div>
          </div>
        )}

        {/* Availability of the picked slot; polite, so it is read after each change */}
        <p aria-live="polite" className="min-h-5 text-sm">
          {slot.slot && isOwnSpace && (
            <span className="text-muted-foreground">This is your space, so you cannot book it.</span>
          )}
          {slot.slot && !isOwnSpace && availability.isPending && (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Checking availability…
            </span>
          )}
          {slot.slot && !isOwnSpace && availability.error && (
            <span className="text-destructive">{errorMessage(availability.error)}</span>
          )}
          {slot.slot && !isOwnSpace && availability.data && (
            <span className={isFree ? 'text-success' : 'text-destructive'}>
              {!isFree
                ? availability.data.message
                : isDesk
                  ? `${availability.data.freeDesks} of ${space.deskCount ?? 0} desks free ${slot.slot.startTime}–${slot.slot.endTime}`
                  : `Free ${slot.slot.startTime}–${slot.slot.endTime}`}
            </span>
          )}
        </p>
      </div>

      {slot.slot && (
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              {euros.format(space.pricePerHour)} × {slot.hours} {slot.hours === 1 ? 'hour' : 'hours'}
              {isDesk && ', 1 desk'}
            </dt>
            <dd>{euros.format(total)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-dashed pt-3 text-base font-semibold">
            <dt>Total</dt>
            <dd>{euros.format(total)}</dd>
          </div>
        </dl>
      )}

      {shownErrors?.detail && (
        <div
          ref={resultRef}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive p-3 text-sm text-destructive outline-none"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {shownErrors.detail}
        </div>
      )}

      {/* Desktop: the button inside the card */}
      <Button
        type="submit"
        disabled={!canBook}
        className="hidden h-12 w-full rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
      >
        {createBooking.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {bookLabel}
      </Button>

      {/* Phones: total + Book fixed above the bottom navigation. data-booking-bar raises the page's
          scroll padding (index.css), so a focused field never ends up under the bar */}
      <div
        data-booking-bar
        className="fixed inset-x-4 bottom-24 z-10 flex items-center justify-between gap-4 rounded-full border bg-card py-2 pr-2 pl-6 shadow-soft md:hidden"
      >
        <div className="flex min-w-0 flex-col">
          <span className="font-semibold">{slot.slot ? euros.format(total) : '—'}</span>
          <span className="truncate text-xs text-muted-foreground">
            {slot.slot
              ? `${slot.date === slot.today ? 'Today' : shortDayFormat.format(new Date(`${slot.date}T12:00:00Z`))}, ${slot.slot.startTime}–${slot.slot.endTime}`
              : 'Pick a time'}
          </span>
        </div>
        <Button
          type="submit"
          disabled={!canBook}
          className="h-12 shrink-0 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {createBooking.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {bookLabel}
        </Button>
      </div>
    </form>
  )
}
