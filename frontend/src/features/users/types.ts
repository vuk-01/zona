// The user entity itself is the shared `User` / `PublicUser` from `@/lib/user` (auth uses it too).
// This file only has the inputs the profile needs.
import type { User } from '@/lib/user'

// What a user can change on their own profile. Email and password changes come later with auth.
export type ProfileChanges = Partial<Pick<User, 'name' | 'avatarUrl' | 'city' | 'bio' | 'mode'>>

// In the app, accounts are created by sign-up in the auth feature; this mirrors POST /users.
export type NewUser = Pick<User, 'name' | 'email'> & { password: string }

export type UserFilters = {
  search?: string
  isHost?: boolean
}
