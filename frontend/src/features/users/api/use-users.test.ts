import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api-client'
import { clearToken, getToken, setToken } from '@/lib/auth-token'
import { type User, currentUserQueryKey } from '@/lib/user'

import { deleteAccountOptions } from './use-users'

const fetchMock = vi.fn<typeof fetch>()

// localStorage for Node, enough for @/lib/auth-token
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

const user: User = {
  id: 7,
  name: 'Ana Petrović',
  email: 'ana@zona.app',
  avatarUrl: null,
  city: 'Podgorica',
  bio: '',
  isHost: false,
  mode: 'guest',
  createdAt: '2026-09-02T10:15:00Z',
}

let queryClient: QueryClient

// Runs useDeleteAccount's mutation the way useMutation does, without rendering React
const deleteAccount = (id: number) =>
  new MutationObserver(queryClient, deleteAccountOptions(queryClient)).mutate(id)

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  clearToken()
  queryClient = new QueryClient()
  setToken('token-7')
  queryClient.setQueryData(currentUserQueryKey, user)
})

afterEach(() => {
  queryClient.clear()
  vi.unstubAllGlobals()
})

describe('deleting the account', () => {
  it('sends DELETE with the token, then forgets the token and the signed-in user', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await deleteAccount(user.id)

    const [input, init] = fetchMock.mock.calls[0] ?? []
    expect(String(input)).toBe('/api/users/7')
    expect(init?.method).toBe('DELETE')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-7')
    expect(getToken()).toBeNull()
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeNull()
  })

  it('sends no request after the DELETE for the private lists that are on screen', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    // Favorites and bookings on screen (an active observer each), already loaded: invalidating them
    // would refetch them right away, without the token
    const onScreen = [
      ['favorites', { userId: user.id }],
      ['bookings', { guestId: user.id }],
    ].map((queryKey) => {
      queryClient.setQueryData(queryKey, [])
      const observer = new QueryObserver(queryClient, {
        queryKey,
        queryFn: ({ signal }) => api.get(`/${String(queryKey[0])}`, { signal }),
        staleTime: Infinity,
      })
      return observer.subscribe(() => undefined)
    })

    await deleteAccount(user.id)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE')
    expect(getToken()).toBeNull()
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeNull()
    expect(queryClient.getQueryCache().findAll({ queryKey: ['favorites'] })).toHaveLength(0)
    expect(queryClient.getQueryCache().findAll({ queryKey: ['bookings'] })).toHaveLength(0)
    for (const unsubscribe of onScreen) unsubscribe()
  })

  it('calls onDeleted after the token is cleared and before the user is', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const seen: { user: unknown; token: string | null }[] = []
    const onDeleted = () =>
      seen.push({ user: queryClient.getQueryData(currentUserQueryKey), token: getToken() })

    await new MutationObserver(queryClient, deleteAccountOptions(queryClient, onDeleted)).mutate(user.id)

    // The route leaves the page while the user is still in the cache, so RequireAuth does not
    // redirect, and the page it opens loads without the dead token
    expect(seen).toEqual([{ user, token: null }])
    expect(queryClient.getQueryData(currentUserQueryKey)).toBeNull()
  })

  it('keeps the session when the backend refuses', async () => {
    const body = { detail: 'Only the account owner can change this account', code: 'not_account_owner' }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 403, headers: { 'Content-Type': 'application/json' } }),
    )

    const onDeleted = vi.fn()
    const observer = new MutationObserver(queryClient, deleteAccountOptions(queryClient, onDeleted))

    await expect(observer.mutate(user.id)).rejects.toMatchObject({ status: 403, code: 'not_account_owner' })

    expect(onDeleted).not.toHaveBeenCalled()
    expect(getToken()).toBe('token-7')
    expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(user)
  })
})
