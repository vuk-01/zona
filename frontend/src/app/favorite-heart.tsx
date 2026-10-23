import { useCurrentUser } from '@/features/auth/api/use-auth'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import type { Space } from '@/features/spaces/types'

type FavoriteHeartProps = {
  space: Space
  placement?: 'card' | 'page'
}

// The favorite heart with the signed-in user wired in, since the favorites feature does not import auth:
// on the space cards (Home, Explore, Favorites) and next to the title on the space page.
export function FavoriteHeart({ space, placement }: FavoriteHeartProps) {
  const { data: user, isPending } = useCurrentUser()

  return (
    <FavoriteButton
      spaceId={space.id}
      spaceName={space.name}
      userId={isPending ? undefined : (user?.id ?? null)}
      placement={placement}
    />
  )
}
