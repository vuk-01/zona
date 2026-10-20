import { CircleCheck } from 'lucide-react'

type SavedNoticeProps = {
  notice: string | null
}

// "Glass Room is published" on My spaces after the form. The live region is always rendered, so the
// message is announced when it appears.
export function SavedNotice({ notice }: SavedNoticeProps) {
  return (
    <div role="status" className="empty:hidden">
      {notice && (
        <p className="mt-6 flex items-center gap-2 rounded-lg border border-primary bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground">
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {notice}
        </p>
      )}
    </div>
  )
}
