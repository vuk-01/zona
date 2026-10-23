// A space the user saved with the heart on a space card or the space page. Shared because the mock
// rows in ./mock-db.ts are read by two features: favorites (the hearts) and spaces
// (GET /spaces?favoriteOf=, the Favorites page).
export type Favorite = {
  userId: number
  spaceId: number
  // When it was saved (ISO date-time); the Favorites page shows the newest first
  createdAt: string
}
