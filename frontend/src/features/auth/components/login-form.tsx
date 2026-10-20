import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { z } from 'zod'

import { Button } from '@/components/ui/button'

import { useLogin } from '../api/use-auth'
import { useRedirectTarget } from '../hooks/use-redirect-target'
import { FormAlert } from './form-alert'
import { FormField } from './form-field'

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email')),
  password: z.string().min(1, 'Enter your password'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const navigate = useNavigate()
  const { redirectTo, search } = useRedirectTarget()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const onSubmit = (values: LoginValues) =>
    login.mutate(values, { onSuccess: () => navigate(redirectTo, { replace: true }) })

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {login.error && <FormAlert message={login.error.message} />}

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
        No account?{' '}
        <Link
          to={`/signup${search}`}
          className="rounded-full font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Sign up
        </Link>
      </p>
    </form>
  )
}
