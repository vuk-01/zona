import { ArrowLeftRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { User } from '@/lib/user'

import { useSwitchMode } from '../api/use-users'

type ModeSwitchProps = {
  // The signed-in user; the route passes it in from the auth feature.
  user: User
}

// "Switch to hosting" / "Switch to renting" in Profile. The first switch to hosting turns hosting on.
export function ModeSwitch({ user }: ModeSwitchProps) {
  const switchMode = useSwitchMode()
  const nextMode = user.mode === 'host' ? 'guest' : 'host'

  return (
    <div className="flex flex-col gap-2">
      {/* aria-disabled instead of disabled, so keyboard focus stays on the button while it saves */}
      <Button
        variant="secondary"
        className="h-12 w-full rounded-full focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-disabled={switchMode.isPending}
        onClick={() => {
          if (!switchMode.isPending) switchMode.mutate({ id: user.id, mode: nextMode })
        }}
      >
        {switchMode.isPending ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : (
          <ArrowLeftRight aria-hidden />
        )}
        {nextMode === 'host' ? 'Switch to hosting' : 'Switch to renting'}
      </Button>
      {switchMode.isError && (
        <p role="alert" className="text-center text-sm text-destructive">
          Could not switch mode. Please try again.
        </p>
      )}
    </div>
  )
}
