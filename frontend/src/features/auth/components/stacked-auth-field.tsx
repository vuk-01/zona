import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { type ComponentProps, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type StackedAuthFieldProps = ComponentProps<typeof Input> & {
  id: string
  label: string
  icon: LucideIcon
  hint?: string
  error?: string
}

// A field of the login dialog (DESIGN.md "Login dialog"): the label above a pill; in the pill the icon, a
// thin line and the input; a password field gets an eye button that shows the password. Same props as
// AuthField (the floating label of /login and /signup), so LoginForm and SignupForm swap it in with
// appearance="stacked".
export function StackedAuthField({
  id,
  label,
  icon: Icon,
  hint,
  error,
  type,
  className,
  ...inputProps
}: StackedAuthFieldProps) {
  const [shown, setShown] = useState(false)
  const isPassword = type === 'password'
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className="group/field grid gap-2">
      <Label htmlFor={id} className="px-1 text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within/field:text-primary"
          aria-hidden="true"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-12 h-6 w-px -translate-y-1/2 bg-border"
        />
        <Input
          id={id}
          type={isPassword && shown ? 'text' : type}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 rounded-full bg-card pl-16 transition-[color,border-color,box-shadow] duration-200 hover:border-primary focus-visible:border-primary focus-visible:ring-ring',
            isPassword ? 'pr-12' : 'pr-4',
            className,
          )}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            aria-label="Show password"
            aria-pressed={shown}
            onClick={() => setShown((value) => !value)}
            className="absolute top-1/2 right-0 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring md:right-1 md:size-9"
          >
            {shown ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="px-1 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="px-1 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
