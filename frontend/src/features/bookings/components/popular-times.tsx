import { cva } from 'class-variance-authority'
import { useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { usePopularTimes } from '../api/use-bookings'
import { formatHour } from '../hooks/use-booking-slot'
import type { BookableSpace, Weekday } from '../types'

const DAYS: { key: Weekday; short: string; long: string }[] = [
  { key: 'mon', short: 'Mon', long: 'Monday' },
  { key: 'tue', short: 'Tue', long: 'Tuesday' },
  { key: 'wed', short: 'Wed', long: 'Wednesday' },
  { key: 'thu', short: 'Thu', long: 'Thursday' },
  { key: 'fri', short: 'Fri', long: 'Friday' },
  { key: 'sat', short: 'Sat', long: 'Saturday' },
  { key: 'sun', short: 'Sun', long: 'Sunday' },
]
const BY_JS_DAY: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const AXIS_HOURS = [9, 12, 15, 18, 21]

const chipVariants = cva(
  'h-9 w-11 shrink-0 rounded-full border text-sm font-medium md:w-auto md:px-4 outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      selected: {
        true: 'border-primary bg-primary text-primary-foreground',
        false: 'border-input bg-card text-foreground hover:bg-accent',
      },
    },
  },
)

// Emphasis: the selected hour in chart-1, every other hour in chart-2 (DESIGN.md "Popular time").
// Thin bar (max 24px), 4px rounded top, square on the baseline.
const barVariants = cva('w-full max-w-6 rounded-t-xs transition-colors', {
  variants: {
    selected: {
      true: 'bg-chart-1',
      false: 'bg-chart-2',
    },
  },
})

const describe = (value: number) => (value === 0 ? 'quiet or closed' : `usually ${value}% booked`)

type PopularTimesProps = {
  space: BookableSpace
}

// "Popular time": day chips, an hourly bar chart 08:00–22:00 and one line of text.
// Hover, tap or arrow keys pick an hour; "Show as table" lists every value.
export function PopularTimes({ space }: PopularTimesProps) {
  const { data, isLoading, error, refetch, isRefetching } = usePopularTimes(space)
  const today = BY_JS_DAY[new Date().getDay()]
  const [day, setDay] = useState<Weekday>(today)
  const [picked, setPicked] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const barsRef = useRef<HTMLDivElement>(null)

  const heading = (
    <h2 id="popular-heading" className="text-lg font-semibold">
      Popular time
    </h2>
  )

  if (isLoading) {
    return (
      <section aria-labelledby="popular-heading" className="flex flex-col gap-4">
        {heading}
        <div aria-busy="true" aria-label="Loading popular times" className="flex h-32 items-end gap-0.5">
          {[30, 45, 70, 60, 40, 55, 80, 65, 50, 35, 25, 40, 30, 20].map((height, i) => (
            <div key={i} className="flex flex-1 justify-center" style={{ height: `${height}%` }}>
              <Skeleton className="h-full w-full max-w-6 rounded-t-xs rounded-b-none" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section aria-labelledby="popular-heading" className="flex flex-col items-start gap-3">
        {heading}
        <p role="alert" className="text-sm text-destructive">
          Popular times failed to load.
        </p>
        <Button variant="outline" className="rounded-full" disabled={isRefetching} onClick={() => refetch()}>
          Try again
        </Button>
      </section>
    )
  }

  if (!data) {
    return (
      <section aria-labelledby="popular-heading" className="flex flex-col gap-3">
        {heading}
        <p className="text-sm text-muted-foreground">
          Not enough data yet. Check back after a few weeks of bookings.
        </p>
      </section>
    )
  }

  const dayInfo = DAYS.find((d) => d.key === day) ?? DAYS[0]
  const values = data.days[day]
  const hourAt = (index: number) => data.firstHour + index
  const busiest = values ? values.indexOf(Math.max(...values)) : -1
  // The current hour on today's tab, otherwise the busiest hour
  const nowIndex = new Date().getHours() - data.firstHour
  const defaultIndex = day === today && values && values[nowIndex] > 0 ? nowIndex : busiest
  const selected = picked ?? defaultIndex

  function pickDay(next: Weekday) {
    setDay(next)
    setPicked(null)
  }

  // Roving focus: one tab stop for the chart, arrow keys move between hours
  function onBarKey(event: KeyboardEvent, index: number) {
    if (!values) return
    const last = values.length - 1
    const next =
      event.key === 'ArrowRight'
        ? Math.min(index + 1, last)
        : event.key === 'ArrowLeft'
          ? Math.max(index - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    setPicked(next)
    barsRef.current?.querySelectorAll('button')[next]?.focus()
  }

  return (
    <section aria-labelledby="popular-heading" className="flex flex-col gap-4">
      {heading}

      <div
        role="group"
        aria-label="Day"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 py-1 md:mx-0 md:px-0"
      >
        {DAYS.map((d) => (
          <button
            key={d.key}
            type="button"
            aria-pressed={d.key === day}
            aria-label={d.long}
            className={chipVariants({ selected: d.key === day })}
            onClick={() => pickDay(d.key)}
          >
            {d.short}
          </button>
        ))}
      </div>

      {!values ? (
        <p className="text-sm text-muted-foreground">Closed on {dayInfo.long}s.</p>
      ) : (
        <>
          <figure className="flex flex-col gap-2">
            {/* The selected hour's value, above its bar: the one direct label, the rest are in the table */}
            <div className="relative h-9" aria-hidden="true">
              {selected >= 0 && (
                <div
                  className="absolute bottom-0 flex -translate-x-1/2 items-baseline gap-1 rounded-full border bg-popover px-3 py-1 text-xs whitespace-nowrap shadow-soft"
                  style={{
                    left: `clamp(3.5rem, ${((selected + 0.5) / values.length) * 100}%, calc(100% - 3.5rem))`,
                  }}
                >
                  <span className="font-semibold text-foreground">
                    {values[selected] === 0 ? 'Quiet' : `${values[selected]}%`}
                  </span>
                  <span className="text-muted-foreground">at {formatHour(hourAt(selected))}</span>
                </div>
              )}
            </div>

            <div
              ref={barsRef}
              role="group"
              aria-label={`Popular times on ${dayInfo.long}, use the arrow keys to move between hours`}
              className="flex h-32 items-end border-b border-border"
              // Mouse only: a touch "leaves" as soon as the finger lifts, which would undo the tap
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') setPicked(null)
              }}
            >
              {values.map((value, index) => (
                <button
                  key={index}
                  type="button"
                  tabIndex={index === selected ? 0 : -1}
                  aria-label={`${formatHour(hourAt(index))}, ${describe(value)}`}
                  aria-current={index === selected ? 'true' : undefined}
                  className="flex h-full flex-1 items-end justify-center px-px outline-none focus-visible:rounded-xs focus-visible:ring-[3px] focus-visible:ring-ring"
                  onPointerEnter={() => setPicked(index)}
                  onFocus={() => setPicked(index)}
                  onClick={() => setPicked(index)}
                  onKeyDown={(event) => onBarKey(event, index)}
                >
                  <span
                    className={barVariants({ selected: index === selected })}
                    style={{ height: value === 0 ? 0 : `max(${value}%, 4px)` }}
                  />
                </button>
              ))}
            </div>

            {/* x axis: a label every 3 hours, centered under its bar */}
            <div className="relative h-4 text-xs text-muted-foreground tabular-nums" aria-hidden="true">
              {AXIS_HOURS.map((hour) => (
                <span
                  key={hour}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${((hour - data.firstHour + 0.5) / values.length) * 100}%` }}
                >
                  {hour}
                </span>
              ))}
            </div>

            <figcaption className="text-sm">
              {busiest >= 0 && values[busiest] > 0
                ? `Usually busiest around ${formatHour(hourAt(busiest))}`
                : `Usually quiet on ${dayInfo.long}s`}
            </figcaption>
          </figure>

          <button
            type="button"
            aria-expanded={showTable}
            aria-controls="popular-table"
            className="self-start rounded-sm text-sm font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            onClick={() => setShowTable((open) => !open)}
          >
            {showTable ? 'Hide table' : 'Show as table'}
          </button>
          {showTable && (
            <table id="popular-table" className="w-full max-w-sm text-sm">
              <caption className="sr-only">Popular times on {dayInfo.long}</caption>
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 font-medium">
                    Hour
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Usually booked
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {values.map((value, index) => (
                  <tr key={index} className="border-b last:border-b-0">
                    <td className="py-2">
                      {formatHour(hourAt(index))}–{formatHour(hourAt(index) + 1)}
                    </td>
                    <td className="py-2 text-right">{value === 0 ? '—' : `${value}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  )
}
