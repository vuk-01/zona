// Signed-in user. The password is never part of this type (the API never returns it).
export type User = {
  id: number
  name: string
  email: string
  // Everyone starts as a guest; the "Switch to hosting" button in Profile turns this on.
  isHost: boolean
  createdAt: string
}

export type LoginInput = {
  email: string
  password: string
}

export type SignupInput = {
  name: string
  email: string
  password: string
}
