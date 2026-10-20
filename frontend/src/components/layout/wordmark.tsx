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
      {/* px-2 -mx-2: room for the focus ring around the letters without moving the text */}
      <Link
        to={to}
        className={cn(
          '-mx-2 rounded-full px-2 font-heading text-xl font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
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
