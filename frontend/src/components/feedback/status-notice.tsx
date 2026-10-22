import { CircleCheck } from 'lucide-react'

import { cn } from '@/lib/utils'

type StatusNoticeProps = {
  notice: string | null
  // Spacing around the visible line, which depends on where it sits
  className?: string
}

// The result of an action, visible and announced: "Glass Room is published" on My spaces after the
// form, "Glass Room was deleted", "Your booking at … was cancelled". The live region is always
// rendered (sr-only while empty, so it takes no space in a flex or grid gap), so screen readers
// announce the message when it appears.
export function StatusNotice({ notice, className }: StatusNoticeProps) {
  return (
    <div role="status" className="empty:sr-only">
      {notice && (
        <p
          className={cn(
            'flex items-center gap-2 rounded-lg border border-primary bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground',
            className,
          )}
        >
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {notice}
        </p>
      )}
    </div>
  )
}
