import { Link } from 'react-router'

import { GuestOnly } from '@/features/auth/components/guest-only'
import { LoginForm } from '@/features/auth/components/login-form'

export function Login() {
  return (
    <GuestOnly>
      <title>Log in · Zona</title>
      <section>
        <h1 className="text-center text-2xl font-semibold md:text-3xl">Log in</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Welcome back. Book your next zone in a few taps.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm">
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
