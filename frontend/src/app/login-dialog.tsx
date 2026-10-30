import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from 'react'

import { AuthDialog } from '@/features/auth/components/auth-dialog'
import type { User } from '@/lib/user'

type LoginDialogOptions = {
  // What the visitor was doing (Book, the heart); runs with the user once they are signed in. Not named
  // `then`, which would make the options look like a promise to `await`.
  continueWith?: (user: User) => void
  // The page to go to once signed in (Favorites, Bookings or Profile in the navigation)
  redirect?: string
}

type OpenLoginDialog = (options?: LoginDialogOptions) => void

const LoginDialogContext = createContext<OpenLoginDialog | null>(null)

type LoginDialogProviderProps = {
  children: ReactNode
}

// Logging in without leaving the page (DESIGN.md "Login dialog"). src/app/router.tsx wraps the app layout
// in it, so the account, the navigation, the booking form and the heart can open it; features get it as
// an `onLogin` prop from src/app. /login stays for direct links and RequireAuth's redirects. Closing the
// dialog drops `continueWith` and `redirect`: the visitor changed their mind.
export function LoginDialogProvider({ children }: LoginDialogProviderProps) {
  const [open, setOpen] = useState(false)
  // A new key for every opening mounts the dialog fresh, so it always starts at Log in with empty fields
  const [opening, setOpening] = useState<{ key: number; redirect?: string }>({ key: 0 })
  const continueRef = useRef<((user: User) => void) | undefined>(undefined)
  // The button that opened the dialog, to give focus back to when it closes
  const openerRef = useRef<HTMLElement | null>(null)

  const openLogin = useCallback<OpenLoginDialog>((options) => {
    continueRef.current = options?.continueWith
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpening((previous) => ({ key: previous.key + 1, redirect: options?.redirect }))
    setOpen(true)
  }, [])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) continueRef.current = undefined
  }

  const onSignedIn = (user: User) => {
    const continueWith = continueRef.current
    continueRef.current = undefined
    setOpen(false)
    continueWith?.(user)
  }

  // Back to the opener while it is still there. "Log in" in the account is gone once the user is signed
  // in, and focus then stays on the page.
  const returnFocus = (event: Event) => {
    event.preventDefault()
    if (openerRef.current?.isConnected) openerRef.current.focus()
    openerRef.current = null
  }

  return (
    <LoginDialogContext value={openLogin}>
      {children}
      <AuthDialog
        key={opening.key}
        open={open}
        onOpenChange={onOpenChange}
        onSignedIn={onSignedIn}
        redirect={opening.redirect}
        onCloseAutoFocus={returnFocus}
      />
    </LoginDialogContext>
  )
}

export function useLoginDialog() {
  const openLogin = useContext(LoginDialogContext)
  if (!openLogin) throw new Error('useLoginDialog needs LoginDialogProvider around it (src/app/router.tsx)')
  return openLogin
}
