import { zodResolver } from '@hookform/resolvers/zod'
import { LockKeyhole, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormAlert } from '@/components/form/form-alert'
import { Button } from '@/components/ui/button'
import { applyFieldErrors } from '@/lib/form-errors'
import type { User } from '@/lib/user'

import { useLogin } from '../api/use-auth'
import { useRedirectTarget } from '../hooks/use-redirect-target'
import { AuthField } from './auth-field'
import { StackedAuthField } from './stacked-auth-field'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Enter your password').max(72, 'Use at most 72 characters'),
})

type LoginValues = z.infer<typeof loginSchema>

const switchLinkClass =
  'cursor-pointer rounded-full font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring'

type LoginFormProps = {
  // The login dialog passes both: it gets the user once they are logged in, and "Sign up" switches it to
  // the sign-up form. On /login neither is passed: GuestOnly redirects and "Sign up" goes to /signup.
  onLoggedIn?: (user: User) => void
  onSignUp?: () => void
  // The login dialog's look (DESIGN.md "Login dialog"): labels above the fields, "Remember me" and
  // "Forgot password?". /login keeps the floating labels.
  appearance?: 'stacked'
}

export function LoginForm({ onLoggedIn, onSignUp, appearance }: LoginFormProps) {
  const { search } = useRedirectTarget()
  const login = useLogin()
  // A wrong password (401 invalid_credentials) has no field of its own, so it shows in FormAlert
  const [formError, setFormError] = useState<string | null>(null)
  const isStacked = appearance === 'stacked'
  const Field = isStacked ? StackedAuthField : AuthField
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = (values: LoginValues) => {
    setFormError(null)
    // No navigate here: the user lands in the cache and GuestOnly (around this form on /login) redirects.
    // onSuccess runs after that, so the dialog's next step already sees the signed-in user.
    login.mutate(values, {
      onSuccess: (user) => onLoggedIn?.(user),
      onError: (error) => setFormError(applyFieldErrors(error, setError, ['email', 'password'])),
    })
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <Field
        icon={Mail}
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Field
        icon={LockKeyhole}
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {/* Neither has a backend yet: the box is not sent with the form, and "Forgot password?" only says
          that resetting comes later (DESIGN.md "Sign-in rules") */}
      {isStacked && (
        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 md:min-h-0">
            <input type="checkbox" name="remember" className="size-4 accent-primary" />
            Remember me
          </label>
          <button
            type="button"
            className={switchLinkClass}
            onClick={() => toast('Resetting a password comes with the real backend')}
          >
            Forgot password?
          </button>
        </div>
      )}

      {formError && <FormAlert message={formError} />}

      <Button
        type="submit"
        size="lg"
        disabled={login.isPending}
        className="mt-2 h-12 w-full rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        {login.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {login.isPending ? 'Logging in…' : 'Log in'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isStacked ? "Don't have an account?" : 'No account?'}{' '}
        {onSignUp ? (
          <button type="button" onClick={onSignUp} className={switchLinkClass}>
            Sign up
          </button>
        ) : (
          <Link to={`/signup${search}`} className={switchLinkClass}>
            Sign up
          </Link>
        )}
      </p>
    </form>
  )
}
