import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'

import { TimeSelect } from '@/components/form/time-select'
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

const selectClass = 'min-w-0 flex-1 bg-muted'

const toOption = (time: string) => ({ value: time, label: time })
const OPEN_OPTIONS = OPEN_TIMES.map(toOption)
const CLOSE_OPTIONS = CLOSE_TIMES.map(toOption)

type OpeningHoursFieldsProps = {
  form: UseFormReturn<SpaceFormValues>
}

// One row per day: an Open switch and, while open, the opening and closing hour (time selects).
export function OpeningHoursFields({ form }: OpeningHoursFieldsProps) {
  const { control, formState } = form
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
                <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
                  <Controller
                    control={control}
                    name={`openingHours.${day}.open`}
                    render={({ field }) => (
                      <TimeSelect
                        aria-label={`${DAY_LABELS[day]} opens at`}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        options={OPEN_OPTIONS}
                        className={selectClass}
                      />
                    )}
                  />
                  <span aria-hidden="true" className="text-muted-foreground">
                    –
                  </span>
                  <Controller
                    control={control}
                    name={`openingHours.${day}.close`}
                    render={({ field }) => (
                      <TimeSelect
                        aria-label={`${DAY_LABELS[day]} closes at`}
                        aria-invalid={closeError ? true : undefined}
                        aria-describedby={closeError ? `${day}-close-error` : undefined}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        options={CLOSE_OPTIONS}
                        className={selectClass}
                      />
                    )}
                  />
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
