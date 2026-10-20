import { bookingUnit, type Space } from '../types'

type SpacePriceProps = {
  space: Pick<Space, 'category' | 'pricePerHour'>
}

// Price pill: "€4 /hour" for a whole space, "€3 /desk·hr" for a desk space.
export function SpacePrice({ space }: SpacePriceProps) {
  const perDesk = bookingUnit(space.category) === 'desk'

  return (
    <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-secondary-foreground">
      <span className="font-semibold">€{space.pricePerHour}</span>{' '}
      <span className="text-muted-foreground">{perDesk ? '/desk·hr' : '/hour'}</span>
    </span>
  )
}
