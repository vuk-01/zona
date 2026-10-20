import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormFieldProps = ComponentProps<typeof Input> & {
  id: string
  label: string
  hint?: string
  error?: string
}

// Labeled pill input with an optional hint and its validation message, linked for screen readers.
// Every field that uses it is required; the forms use noValidate, so zod shows the messages.
export function FormField({ id, label, hint, error, ...inputProps }: FormFieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  // The hint is replaced by the error, so only one of them describes the input
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="px-4">
        {label}
      </Label>
      <Input
        id={id}
        aria-required="true"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="h-12 rounded-full bg-muted px-4 focus-visible:ring-ring"
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="px-4 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="px-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
