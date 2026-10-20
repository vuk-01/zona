// The signed-in user is the shared `User` type from `@/lib/user`, also used by the users feature.

export type LoginInput = {
  email: string
  password: string
}

export type SignupInput = {
  name: string
  email: string
  password: string
}
