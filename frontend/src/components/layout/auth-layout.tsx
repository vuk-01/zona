import type { ReactNode } from 'react'
import { Link, Outlet } from 'react-router'

import { ThemeToggle } from './theme-toggle'

// The parts of an auth page come in one after another, a little upward, once the card is in; the routes
// add the delay (motion-safe:delay-300, -500, -700)
export const authEnter =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 motion-safe:ease-out motion-safe:fill-mode-both'

type AuthLayoutProps = {
  // What Zona is: src/app/auth-shell.tsx passes the category illustrations and the live line in, since
  // layout imports no features. md+ the left half of the card, phones the sky band above the sheet.
  showcase: ReactNode
}

// Shell for /login and /signup (DESIGN.md "Auth pages"). md+: one wide card in the middle of the screen,
// in two halves: a sky panel with the hero panel's flat shapes (a pale-blue circle, a slowly turning
// dashed ring, dots), the wordmark and the showcase on the left, the form on the right. The card grows in
// and the form slides in from the side. Phones: the wordmark and the showcase in the sky band, the form in
// the sheet sliding up. The theme toggle sits top right: in the wordmark's row on phones, where the app's
// top bar has it on md+.
export function AuthLayout({ showcase }: AuthLayoutProps) {
  return (
    // md+: the card's top sits half the Log in card's height (16.5rem) above the middle of the screen, so
    // Log in is centered and errors only make the card grow downward, never move it; at least 4rem
    <div className="relative flex min-h-dvh flex-col md:items-center md:px-4 md:pt-[max(4rem,calc(50dvh_-_16.5rem))] md:pb-16">
      {/* Outside the card, which is transformed while it grows in */}
      <div className="absolute top-6 right-4 z-10 md:right-8">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col motion-safe:md:animate-in motion-safe:md:fade-in motion-safe:md:zoom-in-95 motion-safe:md:duration-500 motion-safe:md:ease-out md:grid md:w-full md:max-w-4xl md:flex-none md:grid-cols-2 md:gap-2 md:rounded-xl md:border md:bg-card md:p-2">
        <div className="relative isolate flex flex-col gap-6 overflow-hidden px-4 pt-6 pb-8 md:rounded-lg md:bg-background md:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden md:block">
            <div className="absolute -right-24 -bottom-24 size-72 rounded-full bg-secondary dark:bg-secondary/60" />
            <div className="absolute -top-16 -right-16 size-56 rounded-full border-2 border-dashed border-primary/30 motion-safe:animate-spin-slow" />
            <div className="absolute top-8 right-8 h-12 w-24 bg-dots" />
          </div>
          {/* min-h-11: the same height as the theme toggle next to it on phones */}
          <div className="flex min-h-11 items-center md:min-h-0">
            <Link
              to="/"
              className="rounded-full font-heading text-2xl font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              Zona
            </Link>
          </div>
          {showcase}
        </div>
        <main className="flex-1 rounded-t-xl bg-sheet px-4 pt-8 pb-12 shadow-soft motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-700 motion-safe:ease-out md:rounded-none md:bg-transparent md:px-8 md:py-10 md:shadow-none motion-safe:md:slide-in-from-bottom-0 motion-safe:md:slide-in-from-right-4 motion-safe:md:delay-150 motion-safe:md:fill-mode-both">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
