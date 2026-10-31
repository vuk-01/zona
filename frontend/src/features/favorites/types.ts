// A space the user saved with the heart on a space card or the space page (docs/entities.md, Favorite).
// The API has no id for it: userId + spaceId identify it.
export type Favorite = {
  userId: number
  spaceId: number
  // When it was saved (ISO date-time); the Favorites page shows the newest first
  createdAt: string
}
