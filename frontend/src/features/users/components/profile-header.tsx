import { MapPin } from 'lucide-react'

import type { User } from '@/lib/user'

import { UserAvatar } from './user-avatar'

type ProfileHeaderProps = {
  user: User
}

// Top of Profile (docs/ref/profilePageUI.png): photo, name, role and city. It sits in the page's hero
// panel under the title, so it has no card of its own.
export function ProfileHeader({ user }: ProfileHeaderProps) {
  return (
    <div className="flex items-center gap-4 md:gap-6">
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="text-lg font-semibold wrap-break-word">{user.name}</h2>
        <p className="text-sm text-muted-foreground">{user.isHost ? 'Guest and host' : 'Guest'}</p>
        {user.city && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {user.city}
          </p>
        )}
      </div>
    </div>
  )
}
