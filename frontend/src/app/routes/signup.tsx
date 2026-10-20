import { Link } from 'react-router'

import { GuestOnly } from '@/features/auth/components/guest-only'
import { SignupForm } from '@/features/auth/components/signup-form'

export function Signup() {
  return (
    <GuestOnly>
      <title>Create account · Zona</title>
      <section>
        <h1 className="text-center text-2xl font-semibold md:text-3xl">Create account</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Start as a guest. You can list your own space any time from your profile.
        </p>
        <div className="mt-8">
          <SignupForm />
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
