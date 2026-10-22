import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'

import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

import { CLOSE_TIMES, OPEN_TIMES, type SpaceFormValues, WEEKDAYS } from '../hooks/use-space-form'
import type { Weekday } from '../types'

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const selectClass =
  'h-11 min-w-0 flex-1 rounded-full border border-input bg-muted px-4 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive md:h-9 md:text-sm'

type OpeningHoursFieldsProps = {
  form: UseFormReturn<SpaceFormValues>
}

// One row per day: an Open switch and, while open, the opening and closing hour.
export function OpeningHoursFields({ form }: OpeningHoursFieldsProps) {
  const { control, register, formState } = form
  const openingHours = useWatch({ control, name: 'openingHours' })
  const errors = formState.errors.openingHours

  return (
    <fieldset className="grid gap-2" aria-describedby={errors?.message ? 'opening-hours-error' : undefined}>
      <legend className="mb-2 text-lg font-semibold">Opening hours</legend>
      <p className="mb-2 text-sm text-muted-foreground">Guests can book whole hours while you are open.</p>

      {WEEKDAYS.map((day) => {
        const isOpen = openingHours[day].isOpen
        const closeError = errors?.[day]?.close?.message
        return (
          <div key={day} className="grid gap-1 border-b py-2 last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex w-36 items-center gap-3">
                <Controller
                  control={control}
                  name={`openingHours.${day}.isOpen`}
                  render={({ field }) => (
                    // after: grows the 18 px switch to a 44 px+ tap target without changing its look
                    <Switch
                      id={`${day}-open`}
                      className="relative after:absolute after:-inset-x-2 after:-inset-y-4"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
                {/* The label toggles the switch, so the whole day name is a tap target */}
                <Label htmlFor={`${day}-open`} className="h-11 cursor-pointer md:h-9">
                  {DAY_LABELS[day]}
                </Label>
              </div>

              {isOpen ? (
                <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
                  <select
                    aria-label={`${DAY_LABELS[day]} opens at`}
                    className={selectClass}
                    {...register(`openingHours.${day}.open`)}
                  >
                    {OPEN_TIMES.map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                  </select>
                  <span aria-hidden="true" className="text-muted-foreground">
                    –
                  </span>
                  <select
                    aria-label={`${DAY_LABELS[day]} closes at`}
                    aria-invalid={closeError ? true : undefined}
                    aria-describedby={closeError ? `${day}-close-error` : undefined}
                    className={selectClass}
                    {...register(`openingHours.${day}.close`)}
                  >
                    {CLOSE_TIMES.map((time) => (
                      <option key={time}>{time}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
            {isOpen && closeError && (
              <p id={`${day}-close-error`} className="text-right text-sm text-destructive">
                {closeError}
              </p>
            )}
          </div>
        )
      })}

      {errors?.message && (
        <p id="opening-hours-error" className="text-sm text-destructive">
          {errors.message}
        </p>
      )}
    </fieldset>
  )
}
