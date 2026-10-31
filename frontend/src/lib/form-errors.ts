import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError, errorMessage } from './api-client'

// Puts the backend's `fieldErrors` on the matching form fields (`fields` lists the names the form
// has, e.g. ['name', 'city']). Returns the message for FormAlert: the `detail` when some error has no
// field in this form (or there are none), or null when every error is shown next to its field. zod checks the same limits
// first, so a field error from the server is rare.
// The first field with an error, in the order of `fields`, takes focus: with no FormAlert the submit
// button (disabled while the request ran) would otherwise leave focus nowhere.
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError) || !error.fieldErrors) return errorMessage(error)

  const fieldErrors = error.fieldErrors
  const isField = (key: string): key is Path<T> => fields.some((field) => field === key)
  const firstField = fields.find((field) => Object.hasOwn(fieldErrors, field))
  const entries = Object.entries(fieldErrors)
  for (const [key, message] of entries) {
    if (isField(key))
      setError(key, { type: 'server', message }, key === firstField ? { shouldFocus: true } : undefined)
  }
  return entries.length > 0 && entries.every(([key]) => isField(key)) ? null : error.message
}
