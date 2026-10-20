import { CircleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'

type FormAlertProps = {
  message: string
}

// Server error above the submit button. It takes focus when it appears, because the submit
// button was disabled while pending and keyboard focus would otherwise be lost.
export function FormAlert({ message }: FormAlertProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [message])

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="flex items-center gap-2 rounded-lg border border-destructive px-4 py-3 text-sm text-destructive outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      {message}
    </div>
  )
}
