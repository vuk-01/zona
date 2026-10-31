import { ApiError, api } from '@/lib/api-client'
import { clearToken, getToken, setToken } from '@/lib/auth-token'
import type { User } from '@/lib/user'

import type { LoginInput, SignupInput } from '../types'

// What POST /auth/login and /auth/register answer. The token goes to auth-token.ts, so every later
// request sends it and a reload keeps the session; the caller only gets the user.
type AuthResponse = {
  token: string
  user: User
}

const startSession = ({ token, user }: AuthResponse) => {
  setToken(token)
  return user
}

export const authApi = {
  // A visitor without a token is not asked about at all. A token the backend refuses (expired, or the
  // account is gone) answers 401 invalid_token: api-client.ts clears it and ends the session.
  me: async (signal?: AbortSignal): Promise<User | null> => {
    if (getToken() === null) return null
    try {
      return await api.get<User>('/auth/me', { signal })
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },

  // The user comes back in the mode they used last (guest or host).
  login: async (input: LoginInput) => startSession(await api.post<AuthResponse>('/auth/login', input)),

  signup: async (input: SignupInput) => startSession(await api.post<AuthResponse>('/auth/register', input)),

  // The backend has no logout route: forgetting the token ends the session.
  logout: async () => {
    clearToken()
  },
}
