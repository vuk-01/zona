import { cva } from 'class-variance-authority'
import { Heart } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'

import { useFavoriteIds, useSetFavorite } from '../api/use-favorites'

const buttonVariants = cva(
  'group/heart size-11 shrink-0 rounded-full text-foreground focus-visible:ring-ring focus-visible:ring-offset-2 md:size-9',
  {
    variants: {
      // On a card's photo it is a disc floating over the photo; next to a page title, an outline button
      // like the theme toggle
      placement: {
        card: 'border-0 bg-card shadow-soft hover:bg-card',
        page: '',
      },
    },
  },
)

const heartVariants = cva('size-5 transition-colors duration-200', {
  variants: {
    saved: {
      true: 'fill-favorite text-favorite',
      false: 'group-hover/heart:text-favorite',
    },
    // Set from the first click on: every click mounts a new icon, so the pulse runs again
    pulse: {
      true: 'motion-safe:animate-heart-pulse',
      false: '',
    },
  },
})

type FavoriteButtonProps = {
  spaceId: number
  spaceName: string
  // undefined while the session loads; null for a visitor, whom a click sends to log in first
  userId: number | null | undefined
  placement?: 'card' | 'page'
}

// The heart (DESIGN.md "Favorite heart"): an outline that turns red on hover, filled red once the space
// is saved; every click pulses it once. It is a toggle button (aria-pressed), and all hearts of one space
// share the favorites query, so they always show the same state.
export function FavoriteButton({ spaceId, spaceName, userId, placement = 'card' }: FavoriteButtonProps) {
  const { data: savedIds } = useFavoriteIds(userId)
  const setFavorite = useSetFavorite()
  const navigate = useNavigate()
  const location = useLocation()
  const [clicks, setClicks] = useState(0)
  const saved = savedIds?.has(spaceId) ?? false

  function toggle() {
    if (userId === undefined) return
    if (userId === null) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`)
      return
    }
    setClicks((count) => count + 1)
    setFavorite.mutate({ userId, spaceId, saved: !saved })
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className={buttonVariants({ placement })}
      aria-label={`Save ${spaceName} to favorites`}
      aria-pressed={saved}
      onClick={toggle}
    >
      <Heart key={clicks} className={heartVariants({ saved, pulse: clicks > 0 })} aria-hidden="true" />
    </Button>
  )
}
