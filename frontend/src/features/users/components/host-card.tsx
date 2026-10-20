import { MapPin } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'

import { useUser } from '../api/use-users'
import { UserAvatar } from './user-avatar'

const sinceFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

type HostCardProps = {
  userId: number
}

// "Hosted by …" on a space page: photo, name, host since, city and a short bio.
export function HostCard({ userId }: HostCardProps) {
  const { data: host, isLoading, error } = useUser(userId)

  if (isLoading) return <Skeleton className="h-32 rounded-lg" />
  if (error || !host)
    return <p className="text-sm text-muted-foreground">Host details are not available right now.</p>

  return (
    <div className="flex gap-4 rounded-lg border bg-card p-4">
      <UserAvatar name={host.name} avatarUrl={host.avatarUrl} className="size-14" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">Hosted by {host.name}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>Host since {sinceFormat.format(new Date(`${host.createdAt}T00:00:00Z`))}</span>
          {host.city && (
            <span className="flex items-center gap-1">
              <MapPin className="size-4" aria-hidden="true" />
              {host.city}
            </span>
          )}
        </p>
        {host.bio && <p className="line-clamp-3 text-sm">{host.bio}</p>}
      </div>
    </div>
  )
}
