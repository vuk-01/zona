import { zodResolver } from '@hookform/resolvers/zod'
import { LockKeyhole, Loader2, Mail, UserRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { FormAlert } from '@/components/form/form-alert'
import { Button } from '@/components/ui/button'
import type { User } from '@/lib/user'

import { useSignup } from '../api/use-auth'
import { useRedirectTarget } from '../hooks/use-redirect-target'
import { AuthField } from './auth-field'
import { StackedAuthField } from './stacked-auth-field'

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .min(2, 'Use at least 2 characters')
    .max(60, 'Use at most 60 characters'),
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email')),
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
})

type SignupValues = z.infer<typeof signupSchema>

const switchLinkClass =
  'cursor-pointer rounded-full font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring'

type SignupFormProps = {
  // The login dialog passes both: it gets the user once the account is created, and "Log in" switches it
  // back to the login form. On /signup neither is passed: GuestOnly redirects and "Log in" goes to /login.
  onSignedUp?: (user: User) => void
  onLogIn?: () => void
  // The login dialog's look (DESIGN.md "Login dialog"): labels above the fields. /signup keeps the
  // floating labels.
  appearance?: 'stacked'
}

// No role choice here: every new account starts as a guest (see DESIGN.md).
export function SignupForm({ onSignedUp, onLogIn, appearance }: SignupFormProps) {
  const { search } = useRedirectTarget()
  const signup = useSignup()
  const isStacked = appearance === 'stacked'
  const Field = isStacked ? StackedAuthField : AuthField
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) })

  const onSubmit = (values: SignupValues) =>
    // No navigate here: the user lands in the cache and GuestOnly (around this form on /signup) redirects.
    // onSuccess runs after that, so the dialog's next step already sees the signed-in user.
    signup.mutate(values, { onSuccess: (user) => onSignedUp?.(user) })

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <Field
        icon={UserRound}
        id="name"
        label="Name"
        autoComplete="name"
        placeholder="Your full name"
        error={errors.name?.message}
        {...register('name')}
      />
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
        autoComplete="new-password"
        hint="At least 8 characters"
        error={errors.password?.message}
        {...register('password')}
      />

      {signup.error && <FormAlert message={signup.error.message} />}

      <Button
        type="submit"
        size="lg"
        disabled={signup.isPending}
        className="mt-2 h-12 w-full rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        {signup.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {signup.isPending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isStacked ? 'Already have an account?' : 'Have an account?'}{' '}
        {onLogIn ? (
          <button type="button" onClick={onLogIn} className={switchLinkClass}>
            Log in
          </button>
        ) : (
          <Link to={`/login${search}`} className={switchLinkClass}>
            Log in
          </Link>
        )}
      </p>
    </form>
  )
}
