import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, api, errorMessage, isNotFound } from './api-client'
import { clearToken, getToken, onSessionExpired, setToken } from './auth-token'

const fetchMock = vi.fn<typeof fetch>()

// localStorage for Node, enough for ./auth-token.ts
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const errorBody = (code: string, detail: string, fieldErrors?: Record<string, string>) => ({
  detail,
  code,
  ...(fieldErrors && { fieldErrors }),
})

function lastRequest() {
  const call = fetchMock.mock.lastCall
  if (!call) throw new Error('fetch was not called')
  const [input, init] = call
  return { url: String(input), init, headers: new Headers(init?.headers) }
}

// The error a request rejects with, so its fields can be checked
async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('the request did not fail')
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  clearToken()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requests', () => {
  it('builds the URL from the path and the defined params', async () => {
    fetchMock.mockResolvedValue(json(200, { total: 0, items: [], pages: 0 }))

    await api.get('/spaces', {
      params: { category: 'desk', page: 2, city: undefined, search: 'Žabljak & co', isHost: false },
    })

    expect(lastRequest().url).toBe('/api/spaces?category=desk&page=2&search=%C5%BDabljak+%26+co&isHost=false')
  })

  it('sends the token only when there is one, and a JSON body with its content type', async () => {
    fetchMock.mockImplementation(async () => json(200, {}))

    await api.get('/auth/me')
    expect(lastRequest().headers.has('Authorization')).toBe(false)
    expect(lastRequest().headers.has('Content-Type')).toBe(false)

    setToken('abc')
    await api.post('/favorites', { spaceId: 3 })
    const { init, headers } = lastRequest()
    expect(init?.method).toBe('POST')
    expect(headers.get('Authorization')).toBe('Bearer abc')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe('{"spaceId":3}')
  })

  it('passes the abort signal on to fetch', async () => {
    fetchMock.mockResolvedValue(json(200, {}))
    const controller = new AbortController()

    await api.get('/spaces/1', { signal: controller.signal })

    expect(lastRequest().init?.signal).toBe(controller.signal)
  })
})

describe('answers', () => {
  it('returns the parsed body for 200 and 201, null for 200 null, and nothing for 204', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { id: 1 }))
    await expect(api.get('/spaces/1')).resolves.toEqual({ id: 1 })

    fetchMock.mockResolvedValueOnce(json(201, { spaceId: 3 }))
    await expect(api.post('/favorites', { spaceId: 3 })).resolves.toEqual({ spaceId: 3 })

    fetchMock.mockResolvedValueOnce(json(200, null))
    await expect(api.get('/bookings/popular-times', { params: { spaceId: 9 } })).resolves.toBeNull()

    const noContent = new Response(null, { status: 204 })
    const readBody = vi.spyOn(noContent, 'json')
    fetchMock.mockResolvedValueOnce(noContent)
    await expect(api.delete('/favorites/3')).resolves.toBeUndefined()
    expect(readBody).not.toHaveBeenCalled()
  })

  it('turns an error in the contract shape into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      json(
        409,
        errorBody('email_already_registered', 'Email is already registered', {
          email: 'Email is already registered',
        }),
      ),
    )

    const error = await failure(api.post('/auth/register', { name: 'Ana', email: 'ana@zona.app' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: 'email_already_registered',
      message: 'Email is already registered',
      fieldErrors: { email: 'Email is already registered' },
    })
  })

  it('keeps the field errors of a 422', async () => {
    fetchMock.mockResolvedValue(
      json(
        422,
        errorBody('validation_error', 'Validation failed', {
          name: 'String should have at least 3 characters',
        }),
      ),
    )

    const error = await failure(api.patch('/spaces/1', { name: 'ab' }))

    expect(error).toMatchObject({
      status: 422,
      code: 'validation_error',
      fieldErrors: { name: 'String should have at least 3 characters' },
    })
  })
})

describe('answers outside the contract', () => {
  it('turns a 2xx without a JSON body into unexpected_response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 200 }))
    expect(await failure(api.post('/favorites', { spaceId: 3 }))).toMatchObject({
      status: 200,
      code: 'unexpected_response',
    })

    fetchMock.mockResolvedValueOnce(
      new Response('<!doctype html><title>Zona</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    const error = await failure(api.get('/spaces'))
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'unexpected_response' })
  })

  it('keeps detail and code but drops fieldErrors that are not one string per field', async () => {
    fetchMock.mockResolvedValueOnce(
      json(422, {
        detail: 'Validation failed',
        code: 'validation_error',
        fieldErrors: { name: ['Too short'] },
      }),
    )
    const error = await failure(api.patch('/spaces/1', { name: 'ab' }))
    expect(error).toMatchObject({ code: 'validation_error', message: 'Validation failed' })
    expect(error).toHaveProperty('fieldErrors', undefined)

    fetchMock.mockResolvedValueOnce(
      json(422, { detail: 'Validation failed', code: 'validation_error', fieldErrors: ['name'] }),
    )
    expect(await failure(api.patch('/spaces/1', { name: 'ab' }))).toHaveProperty('fieldErrors', undefined)
  })
})

describe('session', () => {
  it('clears the token and tells the listeners on 401 invalid_token', async () => {
    const listener = vi.fn()
    const stop = onSessionExpired(listener)
    setToken('expired')
    fetchMock.mockResolvedValue(json(401, errorBody('invalid_token', 'Invalid or expired token')))

    await failure(api.get('/spaces'))

    expect(getToken()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
  })

  it('keeps the session on 401 invalid_credentials (a wrong password)', async () => {
    const listener = vi.fn()
    const stop = onSessionExpired(listener)
    setToken('valid')
    fetchMock.mockResolvedValue(json(401, errorBody('invalid_credentials', 'Wrong email or password')))

    const error = await failure(api.post('/auth/login', { email: 'ana@zona.app', password: 'nope' }))

    expect(error).toMatchObject({ code: 'invalid_credentials' })
    expect(getToken()).toBe('valid')
    expect(listener).not.toHaveBeenCalled()
    stop()
  })

  it('does not end a session on 401 not_authenticated without a token', async () => {
    const listener = vi.fn()
    const stop = onSessionExpired(listener)
    fetchMock.mockResolvedValue(json(401, errorBody('not_authenticated', 'Authentication required')))

    await failure(api.get('/favorites'))

    expect(listener).not.toHaveBeenCalled()
    stop()
  })

  it('keeps a new token when a 401 for the old one arrives after logging in again', async () => {
    const listener = vi.fn()
    const stop = onSessionExpired(listener)
    setToken('old')
    let answer: (response: Response) => void = () => {}
    fetchMock.mockReturnValue(new Promise((resolve) => (answer = resolve)))

    const pending = failure(api.get('/spaces'))
    setToken('new')
    answer(json(401, errorBody('invalid_token', 'Invalid or expired token')))
    await pending

    expect(getToken()).toBe('new')
    expect(listener).not.toHaveBeenCalled()
    stop()
  })
})

describe('no answer from the backend', () => {
  it('reports server_unavailable for the empty 502 of the dev proxy', async () => {
    fetchMock.mockResolvedValue(
      new Response('', { status: 502, statusText: 'Bad Gateway', headers: { 'Content-Type': 'text/plain' } }),
    )

    const error = await failure(api.get('/spaces'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: 'server_unavailable' })
    expect(errorMessage(error)).toBe("Zona can't be reached right now. Try again in a moment.")
  })

  it('reports network_error with status 0 when fetch itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const error = await failure(api.get('/spaces'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0, code: 'network_error' })
  })

  it('rethrows an abort unchanged, so TanStack Query can cancel', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValue(abort)

    const error = await failure(api.get('/spaces'))

    expect(error).toBe(abort)
    expect(error).not.toBeInstanceOf(ApiError)
  })
})

describe('helpers', () => {
  it('isNotFound is true for 404 and 422, false for anything else', () => {
    expect(isNotFound(new ApiError(404, 'space_not_found', 'Space not found'))).toBe(true)
    expect(isNotFound(new ApiError(422, 'validation_error', 'Validation failed'))).toBe(true)
    expect(isNotFound(new ApiError(409, 'slot_full', 'No desks left at 10:00'))).toBe(false)
    expect(isNotFound(new Error('Space with id 9 does not exist'))).toBe(false)
  })

  it('errorMessage shows the detail of an ApiError and the fallback otherwise', () => {
    expect(errorMessage(new ApiError(409, 'slot_full', 'No desks left at 10:00'))).toBe(
      'No desks left at 10:00',
    )
    expect(errorMessage(new Error('boom'), 'Could not save')).toBe('Could not save')
    expect(errorMessage('x')).toBe('Something went wrong. Please try again.')
  })
})
