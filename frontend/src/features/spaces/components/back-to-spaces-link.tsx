import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

// Back to "My spaces" above the space form's title, in the hero panel; leaving it does not save anything.
// The arrow nudges left on hover, like "See all" nudges its arrow right.
export function BackToSpacesLink() {
  return (
    <Link
      to="/host/spaces"
      className="group inline-flex h-11 items-center gap-2 self-start rounded-full text-sm font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:h-9"
    >
      <ArrowLeft
        className="size-4 transition-transform duration-200 motion-safe:group-hover:-translate-x-1"
        aria-hidden="true"
      />
      My spaces
    </Link>
  )
}
