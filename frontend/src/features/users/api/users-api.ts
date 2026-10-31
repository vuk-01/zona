import { type Page, api } from '@/lib/api-client'
import type { PublicUser, User } from '@/lib/user'

import type { ProfileChanges, UserFilters } from '../types'

// Accounts are created by sign-up (auth feature, POST /auth/register); there is no POST /users.
export const usersApi = {
  // Other people's profiles never include the email or the current mode.
  list: (filters: UserFilters = {}, signal?: AbortSignal) =>
    api.get<Page<PublicUser>>('/users', { params: filters, signal }),

  get: (id: number, signal?: AbortSignal) => api.get<PublicUser>(`/users/${id}`, { signal }),

  // Only the user themselves; the answer is their full profile. Switching to host mode turns hosting on
  // for good; switching back to guest keeps isHost.
  update: (id: number, changes: ProfileChanges) => api.patch<User>(`/users/${id}`, changes),

  // Afterwards the user's token answers 401 invalid_token.
  remove: (id: number) => api.delete(`/users/${id}`),
}
