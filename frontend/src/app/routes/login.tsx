import { Link } from 'react-router'

import { authEnter } from '@/components/layout/auth-layout'
import { GuestOnly } from '@/features/auth/components/guest-only'
import { LoginForm } from '@/features/auth/components/login-form'

// The heading, the form and "Continue browsing" come in one after another (DESIGN.md "Auth pages")
export function Login() {
  return (
    <GuestOnly>
      <title>Log in · Zona</title>
      <section>
        <div className={`${authEnter} motion-safe:delay-300`}>
          <h1 className="text-center text-2xl font-semibold md:text-left md:text-3xl">Log in</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground md:text-left">
            Welcome back. Book your next zone in a few taps.
          </p>
        </div>
        <div className={`mt-8 ${authEnter} motion-safe:delay-500`}>
          <LoginForm />
        </div>
        <p className={`mt-6 text-center text-sm ${authEnter} motion-safe:delay-700`}>
          <Link
            to="/"
            className="rounded-full text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            Continue browsing
          </Link>
        </p>
      </section>
    </GuestOnly>
  )
}
