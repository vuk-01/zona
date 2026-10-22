import type { User, UserMode } from '@/lib/user'

import { ModeSwitch } from './mode-switch'

type ProfileModeCardProps = {
  user: User
  // Passed on to ModeSwitch: the route goes to the new mode's home
  onSwitched?: (mode: UserMode) => void | Promise<void>
}

// Bottom card of Profile: which mode the app is in, and the switch to the other one.
export function ProfileModeCard({ user, onSwitched }: ProfileModeCardProps) {
  return (
    <section
      aria-labelledby="mode-heading"
      className="flex flex-col gap-4 rounded-lg border bg-card p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="mode-heading" className="text-lg font-semibold">
          Mode
        </h2>
        <p className="text-sm text-muted-foreground">
          {user.mode === 'host' ? 'You are hosting now.' : 'You are renting spaces now.'}
        </p>
      </div>
      <div className="md:max-w-sm">
        <ModeSwitch user={user} onSwitched={onSwitched} />
      </div>
    </section>
  )
}
