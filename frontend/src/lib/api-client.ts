// The one place that talks to the backend. Every src/features/<name>/api/<name>-api.ts calls `api`;
// the contract (paths, bodies, error codes) is docs/entities.md. In development Vite proxies /api to
// the backend on port 8000 (vite.config.ts).
import { expireSession, getToken } from './auth-token'

// A paginated GET list: ?page=1&size=50, newest first unless the route says otherwise.
export type Page<T> = {
  total: number
  items: T[]
  pages: number | null
}

// Every error the backend sends: {"detail", "code"} plus `fieldErrors` when a field is at fault.
// status 0: the request never got an answer (no network).
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors?: Record<string, string>

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

const UNAVAILABLE_MESSAGE = "Zona can't be reached right now. Try again in a moment."
const FALLBACK_MESSAGE = 'Something went wrong. Please try again.'

type ErrorBody = { detail: string; code: string; fieldErrors?: unknown }

const isErrorBody = (value: unknown): value is ErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'detail' in value &&
  typeof value.detail === 'string' &&
  'code' in value &&
  typeof value.code === 'string'

// fieldErrors as the contract has it: one message per field. Anything else (a list, a message that
// is not a string) is left out, so a form never shows it; detail and code still count.
const isFieldErrors = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((message) => typeof message === 'string')

type QueryParams = Record<string, string | number | boolean | undefined>

type RequestOptions = {
  params?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

// undefined parameters are left out; false and 0 are real values (?isHost=false).
function url(path: string, params: QueryParams = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const search = query.toString()
  return `/api${path}${search ? `?${search}` : ''}`
}

// A 401 invalid_token ends the session of the token it was sent with (see expireSession). Other 401s
// do not: invalid_credentials is a wrong password, not_authenticated a request without a token.
async function toApiError(response: Response, sentToken: string | null) {
  const body: unknown = await response.json().catch(() => null)
  if (!isErrorBody(body)) {
    // Not the backend's error shape: the dev proxy answers an empty 502 while the backend is down.
    return response.status >= 500
      ? new ApiError(response.status, 'server_unavailable', UNAVAILABLE_MESSAGE)
      : new ApiError(response.status, 'unexpected_response', FALLBACK_MESSAGE)
  }
  if (response.status === 401 && body.code === 'invalid_token' && sentToken !== null) {
    expireSession(sentToken)
  }
  const fieldErrors = isFieldErrors(body.fieldErrors) ? body.fieldErrors : undefined
  return new ApiError(response.status, body.code, body.detail, fieldErrors)
}

async function request(method: string, path: string, { params, body, signal }: RequestOptions = {}) {
  const token = getToken()
  const headers = new Headers()
  if (token !== null) headers.set('Authorization', `Bearer ${token}`)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(url(path, params), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    // TanStack Query cancels a request it no longer needs; that is not a network error.
    if (error instanceof Error && error.name === 'AbortError') throw error
    throw new ApiError(0, 'network_error', UNAVAILABLE_MESSAGE)
  }

  if (!response.ok) throw await toApiError(response, token)
  if (response.status === 204) return undefined
  try {
    const data: unknown = await response.json()
    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error
    // A 2xx without a JSON body (empty, or an HTML page from a wrong host) is not the contract.
    throw new ApiError(response.status, 'unexpected_response', FALLBACK_MESSAGE)
  }
}

// The caller names the response type from docs/entities.md; the client does not check it.
export const api = {
  get: <T>(path: string, options: { params?: QueryParams; signal?: AbortSignal } = {}) =>
    request('GET', path, options) as Promise<T>,
  post: <T>(path: string, body: unknown, options: { signal?: AbortSignal } = {}) =>
    request('POST', path, { ...options, body }) as Promise<T>,
  patch: <T>(path: string, body: unknown, options: { signal?: AbortSignal } = {}) =>
    request('PATCH', path, { ...options, body }) as Promise<T>,
  delete: async (path: string, options: { signal?: AbortSignal } = {}) => {
    await request('DELETE', path, options)
  },
}

// Only for a GET by id: the record does not exist (404), or the id in the path is not a valid id (422).
export const isNotFound = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 422)

// The text to show for a failed request: the backend's `detail`, or `fallback` for anything else.
export const errorMessage = (error: unknown, fallback = FALLBACK_MESSAGE) =>
  error instanceof ApiError ? error.message : fallback
