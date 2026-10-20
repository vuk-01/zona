import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useWatch } from 'react-hook-form'

import { FormAlert } from '@/components/form/form-alert'
import { FormField } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { type SpaceFormValues, toNewSpace, useSpaceForm } from '../hooks/use-space-form'
import type { NewSpace, Space, SpaceStatus } from '../types'
import { CategoryPicker } from './category-picker'
import { OpeningHoursFields } from './opening-hours-fields'
import { PhotoUrlFields } from './photo-url-fields'

type SpaceFormProps = {
  // The space being edited; without it the form adds a new space.
  space?: Space
  isPending: boolean
  // Server error from the create or update request
  error: Error | null
  onSubmit: (input: NewSpace) => void
}

const sectionTitle = 'text-lg font-semibold'

// Adding and editing a space. A new space is published or saved as a draft with its own button;
// an existing one is saved with the Listed switch deciding whether guests can see it.
export function SpaceForm({ space, isPending, error, onSubmit }: SpaceFormProps) {
  const form = useSpaceForm(space)
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = form
  const category = useWatch({ control, name: 'category' })
  const listed = useWatch({ control, name: 'listed' })
  // Which button sent the form, so only that one shows the spinner
  const [sentAs, setSentAs] = useState<SpaceStatus>('listed')

  const submitAs = (status: SpaceStatus | 'from-switch') =>
    handleSubmit((values: SpaceFormValues) => {
      const next = status === 'from-switch' ? (values.listed ? 'listed' : 'draft') : status
      setSentAs(next)
      onSubmit(toNewSpace(values, next))
    })

  const isEditing = space !== undefined
  const buttonClass =
    'h-12 w-full rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:w-auto md:px-8'

  return (
    <form
      noValidate
      onSubmit={submitAs(isEditing ? 'from-switch' : 'listed')}
      className="mt-6 flex max-w-2xl flex-col gap-10 md:mt-8"
    >
      <fieldset className="grid gap-4">
        <legend className={`${sectionTitle} mb-4`}>About the space</legend>
        <FormField
          id="name"
          label="Name"
          placeholder="e.g. Sunny desks by the river"
          error={errors.name?.message}
          {...register('name')}
        />
        <div className="grid gap-2">
          <Label htmlFor="description" className="px-4">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="description"
            rows={4}
            placeholder="What makes it a good place to work? Wi-Fi, coffee, parking, quiet…"
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? 'description-error' : undefined}
            className="rounded-lg bg-muted px-4 py-3 focus-visible:ring-ring"
            {...register('description')}
          />
          {errors.description && (
            <p id="description-error" className="px-4 text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>
        <CategoryPicker field={register('category')} error={errors.category?.message} />
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className={`${sectionTitle} mb-4`}>Location, size and price</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="city"
            label="City"
            autoComplete="address-level2"
            error={errors.city?.message}
            {...register('city')}
          />
          <FormField
            id="address"
            label="Address"
            autoComplete="street-address"
            placeholder="e.g. Njegoševa 24"
            error={errors.address?.message}
            {...register('address')}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            id="pricePerHour"
            label={category === 'desk' ? 'Price per desk per hour (€)' : 'Price per hour (€)'}
            inputMode="decimal"
            error={errors.pricePerHour?.message}
            {...register('pricePerHour')}
          />
          <FormField
            id="capacity"
            label="Capacity (people)"
            inputMode="numeric"
            error={errors.capacity?.message}
            {...register('capacity')}
          />
          {category === 'desk' && (
            <FormField
              id="deskCount"
              label="Number of desks"
              inputMode="numeric"
              hint="Guests book one desk at a time"
              error={errors.deskCount?.message}
              {...register('deskCount')}
            />
          )}
        </div>
      </fieldset>

      <OpeningHoursFields form={form} />

      <PhotoUrlFields form={form} />

      {isEditing && (
        <div className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3">
          <div className="grid gap-1">
            <Label htmlFor="listed">Listed</Label>
            <p id="listed-hint" className="text-sm text-muted-foreground">
              {listed ? 'Guests can find and book this space.' : 'A draft: only you can see it.'}
            </p>
          </div>
          <Controller
            control={control}
            name="listed"
            render={({ field }) => (
              <Switch
                id="listed"
                aria-describedby="listed-hint"
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {error && <FormAlert message={error.message} />}

        <div className="flex flex-col gap-3 md:flex-row">
          <Button type="submit" size="lg" disabled={isPending} className={buttonClass}>
            {isPending && (isEditing || sentAs === 'listed') && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            {isEditing
              ? isPending
                ? 'Saving…'
                : 'Save changes'
              : isPending && sentAs === 'listed'
                ? 'Publishing…'
                : 'Publish space'}
          </Button>
          {!isEditing && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isPending}
              className={`${buttonClass} bg-transparent hover:bg-accent`}
              onClick={submitAs('draft')}
            >
              {isPending && sentAs === 'draft' && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isPending && sentAs === 'draft' ? 'Saving…' : 'Save as draft'}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}
