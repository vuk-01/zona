import { Plus, Trash2 } from 'lucide-react'
import { type UseFormReturn, useFieldArray, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { MAX_PHOTOS, type SpaceFormValues } from '../hooks/use-space-form'
import { PhotoPreview } from './photo-preview'

type PhotoUrlFieldsProps = {
  form: UseFormReturn<SpaceFormValues>
}

// Links to the space's photos; the first one is the cover. At least one, at most MAX_PHOTOS.
export function PhotoUrlFields({ form }: PhotoUrlFieldsProps) {
  const { control, register, formState, setFocus } = form
  const { fields, append, remove } = useFieldArray({ control, name: 'images' })
  const images = useWatch({ control, name: 'images' })
  const errors = formState.errors.images
  const listError = errors?.message ?? errors?.root?.message

  return (
    <fieldset className="grid gap-2" aria-describedby="photos-hint">
      <legend className="mb-2 text-lg font-semibold">Photos</legend>
      <p id="photos-hint" className="mb-2 text-sm text-muted-foreground">
        Paste links to photos of your space. The first one is the cover; you can add up to {MAX_PHOTOS}.
      </p>

      {fields.map((field, index) => {
        const error = errors?.[index]?.url?.message
        const label = index === 0 ? 'Cover photo link' : `Photo ${index + 1} link`
        return (
          <div key={field.id} className="grid gap-1">
            <div className="flex items-center gap-2">
              <PhotoPreview url={images[index]?.url ?? ''} />
              <Input
                type="url"
                inputMode="url"
                placeholder="https://"
                aria-label={label}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `photo-${index}-error` : undefined}
                className="h-11 rounded-full bg-muted px-4 focus-visible:ring-ring md:h-9"
                {...register(`images.${index}.url`)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${label.replace(' link', '').toLowerCase()}`}
                disabled={fields.length === 1}
                className="size-11 shrink-0 rounded-full text-destructive hover:bg-accent hover:text-destructive focus-visible:ring-ring md:size-9"
                onClick={() => {
                  remove(index)
                  // The removed button had focus: give it to the photo that took its place (or the last one)
                  setTimeout(() => setFocus(`images.${Math.min(index, fields.length - 2)}.url`))
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {error && (
              <p id={`photo-${index}-error`} className="pl-24 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )
      })}

      {listError && <p className="text-sm text-destructive">{listError}</p>}

      {fields.length < MAX_PHOTOS && (
        <Button
          type="button"
          variant="outline"
          className="h-11 justify-self-start rounded-full bg-transparent hover:bg-accent focus-visible:ring-ring md:h-9"
          onClick={() => append({ url: '' })}
        >
          <Plus aria-hidden="true" />
          Add photo
        </Button>
      )}
    </fieldset>
  )
}
