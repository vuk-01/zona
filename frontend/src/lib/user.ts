// The account, shared by the auth feature (sign-in and sign-up) and the users feature (profile).
// The password is never part of this type (the API never returns it).

export type UserMode = 'guest' | 'host'

export type User = {
  id: number
  name: string
  email: string
  // null shows the user's initials instead of a photo.
  avatarUrl: string | null
  city: string
  // Short "about me", at most 200 characters; empty after sign-up.
  bio: string
  // Hosting is turned on: the user can list spaces. Stays true once on.
  isHost: boolean
  // The mode the app is in right now; 'host' is only possible when isHost is true.
  mode: UserMode
  createdAt: string
}

// What other people see of a user: no email and no current mode.
export type PublicUser = Omit<User, 'email' | 'mode'>

// TanStack Query key of the signed-in user. The auth feature fills it; profile changes invalidate it.
export const currentUserQueryKey = ['auth', 'me'] as const
