import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError, errorMessage } from './api-client'

// Puts the backend's `fieldErrors` on the matching form fields (`fields` lists the names the form
// has, e.g. ['name', 'city']). Returns the message for FormAlert: the `detail` when some error has no
// field in this form (or there are none), or null when every error is shown next to its field. zod checks the same limits
// first, so a field error from the server is rare.
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  if (!(error instanceof ApiError) || !error.fieldErrors) return errorMessage(error)

  const isField = (key: string): key is Path<T> => fields.some((field) => field === key)
  const entries = Object.entries(error.fieldErrors)
  for (const [key, message] of entries) {
    if (isField(key)) setError(key, { type: 'server', message })
  }
  return entries.length > 0 && entries.every(([key]) => isField(key)) ? null : error.message
}
