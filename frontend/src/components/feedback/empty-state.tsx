import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

// The one primary pill action of an empty state (a Button or a Link inside Button asChild)
export const emptyStateAction =
  'h-12 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card'

type EmptyStateProps = {
  icon: LucideIcon
  // A string becomes the card's h2; a "not found" route passes its <PageTitle> (the page's h1) instead
  title: ReactNode
  text: string
  // Left out only when there is nothing to do next (e.g. no spaces are listed at all)
  action?: ReactNode
}

// DESIGN.md "Empty state": white card, a lucide icon in primary, one heading, one line of text and one
// primary pill action. Used by lists that come back empty (bookings, spaces) and by "not found" pages.
export function EmptyState({ icon: Icon, title, text, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-12 text-center">
      <Icon className="size-10 text-primary" aria-hidden="true" />
      {typeof title === 'string' ? <h2 className="text-lg font-semibold">{title}</h2> : title}
      <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  )
}
