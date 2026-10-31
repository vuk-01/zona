import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('keeps the session when the backend refuses', async () => {
    const body = { detail: 'Only the account owner can change this account', code: 'not_account_owner' }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 403, headers: { 'Content-Type': 'application/json' } }),
    )

    await expect(deleteAccount(user.id)).rejects.toMatchObject({ status: 403, code: 'not_account_owner' })

    expect(getToken()).toBe('token-7')
    expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(user)
  })
})
