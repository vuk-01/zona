import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

// Back to "My spaces" above the space form; leaving it does not save anything.
export function BackToSpacesLink() {
  return (
    <Link
      to="/host/spaces"
      className="mb-4 inline-flex h-11 items-center gap-2 rounded-full text-sm font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:h-9"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      My spaces
    </Link>
  )
}
