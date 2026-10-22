import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type WordmarkProps = {
  to: string
  // Shows the "Hosting" badge, so it is always clear which mode is on
  isHosting: boolean
  className?: string
}

export function Wordmark({ to, isHosting, className }: WordmarkProps) {
  return (
    <div className="flex items-center gap-2">
      {/* px-2 -mx-2: room for the focus ring around the letters without moving the text;
          min-h-11: a 44 px tap target in the mobile top bar */}
      <Link
        to={to}
        className={cn(
          '-mx-2 inline-flex min-h-11 items-center rounded-full px-2 font-heading text-xl font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-0',
          className,
        )}
      >
        Zona
      </Link>
      {isHosting && (
        <Badge variant="secondary" className="rounded-full">
          Hosting
        </Badge>
      )}
    </div>
  )
}
