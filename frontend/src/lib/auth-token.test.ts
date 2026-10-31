import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearToken, getToken, onSessionChanged, setToken } from './auth-token'

// localStorage for Node; `failWrites` makes setItem throw like a full storage
function memoryStorage({ failWrites = false } = {}) {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      items.set(key, value)
    },
    removeItem: (key: string) => void items.delete(key),
  }
}

// What the browser fires in this tab when another tab writes to localStorage
const storageEvent = (key: string | null) => Object.assign(new Event('storage'), { key })

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('window', new EventTarget())
  clearToken()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('another tab', () => {
  it('tells the listeners when the token changes there, or storage is cleared', () => {
    const listener = vi.fn()
    const stop = onSessionChanged(listener)

    window.dispatchEvent(storageEvent('zona.token'))
    window.dispatchEvent(storageEvent(null))
    window.dispatchEvent(storageEvent('zona-theme'))

    expect(listener).toHaveBeenCalledTimes(2)
    stop()
  })

  it('stops listening once the last listener is gone', () => {
    const listener = vi.fn()
    onSessionChanged(listener)()

    window.dispatchEvent(storageEvent('zona.token'))

    expect(listener).not.toHaveBeenCalled()
  })
})

describe('storage that cannot be written', () => {
  it('keeps the token in memory when the write fails but reads work', () => {
    vi.stubGlobal('localStorage', memoryStorage({ failWrites: true }))

    setToken('abc')

    expect(getToken()).toBe('abc')
    clearToken()
    expect(getToken()).toBeNull()
  })

  it('ignores other tabs while the token lives only in memory', () => {
    vi.stubGlobal('localStorage', memoryStorage({ failWrites: true }))
    const listener = vi.fn()
    const stop = onSessionChanged(listener)
    setToken('abc')

    window.dispatchEvent(storageEvent('zona.token'))

    expect(listener).not.toHaveBeenCalled()
    stop()
  })
})
