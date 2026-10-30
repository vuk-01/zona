import { useLoginDialog } from '@/app/login-dialog'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import type { Space } from '@/features/spaces/types'

type FavoriteHeartProps = {
  space: Space
  placement?: 'card' | 'page'
}

// The favorite heart with the signed-in user wired in, since the favorites feature does not import auth:
// on the space cards (Home, Explore, Favorites) and next to the title on the space page. A visitor's click
// opens the login dialog and saves the space once they are signed in.
export function FavoriteHeart({ space, placement }: FavoriteHeartProps) {
  const { data: user, isPending } = useCurrentUser()
  const openLogin = useLoginDialog()

  return (
    <FavoriteButton
      spaceId={space.id}
      spaceName={space.name}
      userId={isPending ? undefined : (user?.id ?? null)}
      onLogin={(continueWith) => openLogin({ continueWith: (signedIn) => continueWith(signedIn.id) })}
      placement={placement}
    />
  )
}
