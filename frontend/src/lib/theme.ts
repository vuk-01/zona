import { useSyncExternalStore } from 'react'

// Light, dark, or whatever the device prefers (System, the default). The choice is saved per device
// in localStorage; the inline script in index.html applies it before the first paint with the same
// key and values, so change both together.
export type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'zona-theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    // Storage can be blocked (private window, site data turned off): follow the device
    return 'system'
  }
}

let theme: Theme = readTheme()
const listeners = new Set<() => void>()

function resolveIsDark() {
  return theme === 'dark' || (theme === 'system' && darkQuery.matches)
}

function applyTheme() {
  document.documentElement.classList.toggle('dark', resolveIsDark())
}

// While on System, follow the device when it switches between light and dark
darkQuery.addEventListener('change', () => {
  if (theme !== 'system') return
  applyTheme()
  listeners.forEach((listener) => listener())
})

export function setTheme(next: Theme) {
  theme = next
  try {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Not saved, but the theme still changes for this visit
  }
  applyTheme()
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => theme)
}

// Whether the page is dark right now: the saved choice, or the device setting while on System
export function useIsDark() {
  return useSyncExternalStore(subscribe, resolveIsDark)
}
