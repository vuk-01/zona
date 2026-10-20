import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'

import { FormAlert } from '@/components/form/form-alert'
import { FormField } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'

import { useSignup } from '../api/use-auth'
import { useRedirectTarget } from '../hooks/use-redirect-target'

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .min(2, 'Use at least 2 characters')
    .max(60, 'Use at most 60 characters'),
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email')),
  password: z.string().min(8, 'Use at least 8 characters'),
})

type SignupValues = z.infer<typeof signupSchema>

// No role choice here: every new account starts as a guest (see DESIGN.md).
export function SignupForm() {
  const { search } = useRedirectTarget()
  const signup = useSignup()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({ resolver: zodResolver(signupSchema) })

  const onSubmit = (values: SignupValues) =>
    // No navigate here: the user lands in the cache and GuestOnly (around this form) redirects
    signup.mutate(values)

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <FormField
        id="name"
        label="Name"
        autoComplete="name"
        placeholder="Your full name"
        error={errors.name?.message}
        {...register('name')}
      />
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <FormField
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
        Have an account?{' '}
        <Link
          to={`/login${search}`}
          className="rounded-full font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Log in
        </Link>
      </p>
    </form>
  )
}
