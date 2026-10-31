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

type SessionListener = () => void

const listeners = new Set<SessionListener>()

// src/app listens here (the signed-in user is cleared, a toast is shown); src/lib cannot import it.
export function onSessionExpired(listener: SessionListener) {
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

const changeListeners = new Set<SessionListener>()

// Another tab logged in, logged out or switched accounts: the token this tab sends from now on belongs
// to someone else (or to no one). The browser fires `storage` only in the other tabs, never in the
// one that wrote; `key` is null when that tab cleared all of storage.
function handleStorage(event: StorageEvent) {
  if (event.key !== TOKEN_KEY && event.key !== null) return
  for (const listener of changeListeners) listener()
}

// src/app listens here (the signed-in user is read again, every query runs with the new token).
export function onSessionChanged(listener: SessionListener) {
  if (changeListeners.size === 0) window.addEventListener('storage', handleStorage)
  changeListeners.add(listener)
  return () => {
    changeListeners.delete(listener)
    if (changeListeners.size === 0) window.removeEventListener('storage', handleStorage)
  }
}
