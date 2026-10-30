import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { User } from '@/lib/user'
import { cn } from '@/lib/utils'

import { safeRedirect } from '../hooks/use-redirect-target'
import { LoginForm } from './login-form'
import { SignupForm } from './signup-form'

type View = 'login' | 'signup'

const views: Record<View, { title: string; description: string }> = {
  login: { title: 'Welcome back', description: 'Log in to book your next zone in a few taps.' },
  signup: { title: 'Create account', description: 'Start as a guest and list your own space any time.' },
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Phones (DESIGN.md "Login dialog"): the sheet slides up from below the screen in 250ms (ease-out) and
// back down in 200ms (ease-in); the overlay fades along. md+ and reduced motion come from ui/dialog.tsx.
const sheetMotion =
  'max-md:motion-safe:data-[state=open]:animate-in max-md:motion-safe:data-[state=open]:slide-in-from-bottom max-md:motion-safe:data-[state=open]:duration-250 max-md:motion-safe:data-[state=open]:ease-out max-md:motion-safe:data-[state=closed]:animate-out max-md:motion-safe:data-[state=closed]:slide-out-to-bottom max-md:motion-safe:data-[state=closed]:duration-200 max-md:motion-safe:data-[state=closed]:ease-in'
const overlayMotion = 'max-md:motion-safe:data-[state=open]:duration-250'
// Log in ↔ sign up: the new content fades in, a little upward (with reduced motion only fades)
const contentMotion =
  'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-250 motion-safe:ease-out motion-reduce:animate-in motion-reduce:fade-in-0 motion-reduce:duration-150'

type AuthDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Called with the user once they have logged in or created an account
  onSignedIn: (user: User) => void
  // The page to go to once signed in (a nav item that needs a signed-in user); checked like ?redirect=
  redirect?: string
  // Where focus goes on close when there is no redirect: Radix only returns it to a Dialog.Trigger, and
  // this dialog has none
  onCloseAutoFocus?: (event: Event) => void
}

// Log in or create an account over the current page (DESIGN.md "Login dialog"), switching between the two
// without closing. A navy header with the wordmark and, rising over it with a large rounded top, the sky
// card with the form. Phones: a bottom sheet as tall as its content (at most the screen, then it
// scrolls) that slides up. md+: a dialog in the middle of the screen that fades and zooms in
// (ui/dialog.tsx). src/app/login-dialog.tsx mounts it fresh for every opening, so it always starts at
// Log in with empty fields.
export function AuthDialog({ open, onOpenChange, onSignedIn, redirect, onCloseAutoFocus }: AuthDialogProps) {
  const [view, setView] = useState<View>('login')
  // Set by the first switch, so the content fades in on a switch but not again on top of the opening
  const [switched, setSwitched] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  // The page to go to, set once signed in; the dialog goes there after it has closed (see closeAutoFocus)
  const targetRef = useRef<string | null>(null)

  // Log in ↔ sign up. The button that switched is gone with its form, so focus moves to the first field of
  // the other one. The sheet's height then animates from the old to the new one in 250ms (Web Animations
  // API: CSS cannot animate between two auto heights); with reduced motion the height just changes.
  const switchTo = (next: View) => {
    const sheet = sheetRef.current
    const from = sheet?.offsetHeight
    flushSync(() => {
      setSwitched(true)
      setView(next)
    })
    formRef.current?.querySelector('input')?.focus()
    if (!sheet || from === undefined || reducedMotion.matches) return
    const to = sheet.offsetHeight
    if (to === from) return
    // No scrollbar while the taller form is still clipped
    sheet.style.overflowY = 'hidden'
    const animation = sheet.animate(
      { height: [`${from}px`, `${to}px`] },
      { duration: 250, easing: 'ease-out' },
    )
    const reset = () => sheet.style.removeProperty('overflow-y')
    animation.addEventListener('finish', reset)
    animation.addEventListener('cancel', reset)
  }

  const signedIn = (user: User) => {
    targetRef.current = safeRedirect(redirect)
    onSignedIn(user)
  }

  // With a redirect the page changes only once the dialog is gone: until then Radix hides the app from
  // screen readers (aria-hidden), and the new page's PageTitle would take focus inside it. Focus is not
  // given back to the opener either, since the new page's h1 takes it. The user is in the cache by now,
  // so RequireAuth on that page lets them in.
  const closeAutoFocus = (event: Event) => {
    const target = targetRef.current
    if (target) {
      event.preventDefault()
      navigate(target)
    } else {
      onCloseAutoFocus?.(event)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={sheetRef}
        showCloseButton={false}
        onCloseAutoFocus={closeAutoFocus}
        overlayClassName={overlayMotion}
        className={cn(
          'inset-x-0 top-auto bottom-0 left-0 max-h-[calc(100dvh-1rem)] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto overscroll-contain rounded-none rounded-t-xl border-0 bg-background p-0 sm:max-w-none md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[calc(100dvh-4rem)] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:border',
          sheetMotion,
        )}
      >
        <div className="relative isolate overflow-hidden bg-sidebar px-6 pt-8 pb-16 text-center text-sidebar-foreground">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-16 -right-12 size-44 rounded-full bg-sidebar-accent" />
            <div className="absolute -bottom-24 -left-12 size-44 rounded-full border-2 border-dashed border-sidebar-primary/60" />
            <div className="absolute top-6 left-6 h-12 w-24 bg-dots opacity-40" />
          </div>
          <p className="font-heading text-2xl font-bold">Zona</p>
          <p className="mt-1 text-sm text-sidebar-foreground/70">Find your zone</p>
        </div>
        <div className="relative -mt-8 rounded-t-xl bg-background px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] md:px-8 md:pb-8">
          <div key={view} className={switched ? contentMotion : undefined}>
            <DialogHeader className="mb-6 gap-1 text-center sm:text-center">
              <DialogTitle className="text-2xl leading-tight">{views[view].title}</DialogTitle>
              <DialogDescription>{views[view].description}</DialogDescription>
            </DialogHeader>
            <div ref={formRef}>
              {view === 'login' ? (
                <LoginForm appearance="stacked" onLoggedIn={signedIn} onSignUp={() => switchTo('signup')} />
              ) : (
                <SignupForm appearance="stacked" onSignedUp={signedIn} onLogIn={() => switchTo('login')} />
              )}
            </div>
          </div>
        </div>
        {/* Last, so the dialog focuses the first field on open; placed on the header's corner */}
        <DialogClose className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-sidebar-foreground/80 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-[3px] focus-visible:ring-ring md:size-9">
          <X className="size-5" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
