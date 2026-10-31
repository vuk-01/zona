import { describe, expect, it, vi } from 'vitest'

import { ApiError } from './api-client'
import { applyFieldErrors } from './form-errors'

type SpaceForm = { name: string; city: string }

const fields = ['name', 'city'] as const

const validation = (fieldErrors?: Record<string, string>) =>
  new ApiError(422, 'validation_error', 'Validation failed', fieldErrors)

describe('applyFieldErrors', () => {
  it('puts every error on its field and returns null', () => {
    const setError = vi.fn()

    const message = applyFieldErrors<SpaceForm>(validation({ name: 'Too short' }), setError, fields)

    expect(setError).toHaveBeenCalledWith(
      'name',
      { type: 'server', message: 'Too short' },
      { shouldFocus: true },
    )
    expect(message).toBeNull()
  })

  it('focuses only the first field with an error, in the order of fields', () => {
    const setError = vi.fn()

    // The server lists city first; the form lists name first, so name takes focus
    applyFieldErrors<SpaceForm>(validation({ city: 'Too long', name: 'Too short' }), setError, fields)

    expect(setError).toHaveBeenCalledTimes(2)
    expect(setError).toHaveBeenCalledWith(
      'name',
      { type: 'server', message: 'Too short' },
      { shouldFocus: true },
    )
    expect(setError).toHaveBeenCalledWith('city', { type: 'server', message: 'Too long' }, undefined)
  })

  it('focuses the only field with an error', () => {
    const setError = vi.fn()

    applyFieldErrors<SpaceForm>(validation({ city: 'Too long' }), setError, fields)

    expect(setError).toHaveBeenCalledExactlyOnceWith(
      'city',
      { type: 'server', message: 'Too long' },
      { shouldFocus: true },
    )
  })

  it('returns the detail when an error has no field in this form', () => {
    const setError = vi.fn()

    const message = applyFieldErrors<SpaceForm>(
      validation({ name: 'Too short', deskCount: 'Required for a desk' }),
      setError,
      fields,
    )

    expect(setError).toHaveBeenCalledTimes(1)
    expect(message).toBe('Validation failed')
  })

  it('returns the detail when fieldErrors is empty or missing', () => {
    const setError = vi.fn()

    expect(applyFieldErrors<SpaceForm>(validation({}), setError, fields)).toBe('Validation failed')
    expect(applyFieldErrors<SpaceForm>(validation(), setError, fields)).toBe('Validation failed')
    expect(setError).not.toHaveBeenCalled()
  })

  it('returns the fallback for an error that is not an ApiError', () => {
    expect(applyFieldErrors<SpaceForm>(new Error('boom'), vi.fn(), fields)).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
