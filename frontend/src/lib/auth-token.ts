// The API token from POST /api/auth/login or /register, sent as `Authorization: Bearer` by
// ./api-client.ts. Kept in the browser, so a reload keeps the session. Storage can be blocked
// (private mode); then the token only lives in memory, for this tab.
const TOKEN_KEY = 'zona.token'

let memoryToken: string | null = null

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return memoryToken
  }
}

export function setToken(token: string) {
  memoryToken = token
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Only in memory for this tab.
  }
}

export function clearToken() {
  memoryToken = null
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing stored.
  }
}

type SessionExpiredListener = () => void

const listeners = new Set<SessionExpiredListener>()

// src/app listens here (the signed-in user is cleared, a toast is shown); src/lib cannot import it.
export function onSessionExpired(listener: SessionExpiredListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// The backend answered 401 invalid_token to a request sent with `token`. Only that token is cleared:
// an answer that arrives after the user logged in again must not log the new session out.
export function expireSession(token: string) {
  if (getToken() !== token) return
  clearToken()
  for (const listener of listeners) listener()
}
