import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type AuthFieldProps = ComponentProps<typeof Input> & {
  id: string
  label: string
  icon: LucideIcon
  hint?: string
  error?: string
}

// A field of the login and sign-up forms (DESIGN.md "Auth pages"): a tall muted pill with an icon and the
// label inside it, like a placeholder. On focus the pill turns card with a primary border, the focus ring
// grows in, the icon turns primary and the label moves up (smaller, primary); it stays up once there is a
// value. The placeholder only shows once the label has moved up. The movement only without reduced
// motion; the colors always change. Every field that uses it is required (the forms use noValidate, so
// zod shows the messages).
export function AuthField({
  id,
  label,
  icon: Icon,
  hint,
  error,
  placeholder,
  ...inputProps
}: AuthFieldProps) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  // The hint is replaced by the error, so only one of them describes the input
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className="group/field grid gap-2">
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within/field:text-primary motion-safe:transition-[color,scale] motion-safe:group-focus-within/field:scale-110"
          aria-hidden="true"
        />
        <Input
          id={id}
          aria-required="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // :placeholder-shown tells the label whether the field is empty, so there is always one
          placeholder={placeholder ?? ' '}
          className="peer h-14 rounded-full bg-muted pt-6 pr-4 pb-2 pl-12 transition-[color,background-color,border-color,box-shadow] duration-200 placeholder:text-transparent hover:border-primary focus-visible:border-primary focus-visible:bg-card focus-visible:ring-ring focus-visible:placeholder:text-muted-foreground"
          {...inputProps}
        />
        {/* After the input, so peer-focus and peer-placeholder-shown can move it */}
        <Label
          htmlFor={id}
          className="pointer-events-none absolute top-4 left-12 origin-top-left text-base leading-6 font-normal text-muted-foreground transition-colors duration-200 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:font-medium peer-focus:text-primary peer-[:not(:placeholder-shown)]:-translate-y-3 peer-[:not(:placeholder-shown)]:scale-75 motion-safe:transition-[translate,scale,color]"
        >
          {label}
        </Label>
      </div>
      {hint && !error && (
        <p id={hintId} className="px-4 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="px-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
