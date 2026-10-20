import { CalendarDays, MapPin } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundError } from '@/lib/mock-db'

import { useUser } from '../api/use-users'
import { UserAvatar } from './user-avatar'

// Dates are stored as 'YYYY-MM-DD'; formatting them in UTC keeps the month from shifting.
const joinedFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

type ProfileCardProps = {
  userId: number
}

// A user's public profile with all three states: loading, error (or not found) and an empty bio.
export function ProfileCard({ userId }: ProfileCardProps) {
  const { data: user, isLoading, error } = useUser(userId)

  if (isLoading) return <Skeleton className="h-64 rounded-lg" />

  if (error || !user) {
    return (
      <p className="text-destructive">
        {error instanceof NotFoundError
          ? 'This profile does not exist.'
          : 'Profile failed to load. Please try again.'}
      </p>
    )
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:text-left">
        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <h2 className="text-lg font-semibold">{user.name}</h2>
            {user.isHost && <Badge variant="secondary">Host</Badge>}
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground md:justify-start">
            {user.city && (
              <span className="flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {user.city}
              </span>
            )}
            <span className="flex items-center gap-1">
              <CalendarDays className="size-4" aria-hidden />
              Joined {joinedFormat.format(new Date(`${user.createdAt}T00:00:00Z`))}
            </span>
          </div>
          <p className={user.bio ? 'text-sm' : 'text-sm text-muted-foreground'}>
            {user.bio || 'No bio yet.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
