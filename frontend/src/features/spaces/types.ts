export type SpaceCategory = 'desk' | 'meeting-room' | 'office' | 'event-hall'

export const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  desk: 'Desk',
  'meeting-room': 'Meeting room',
  office: 'Office',
  'event-hall': 'Event hall',
}

// For values from the URL (?category=desk); anything else means "all categories".
export const isSpaceCategory = (value: string | null): value is SpaceCategory =>
  value !== null && Object.hasOwn(CATEGORY_LABELS, value)

// A desk space is booked one desk at a time; every other category is booked as a whole space.
export type BookingUnit = 'desk' | 'space'

export const bookingUnit = (category: SpaceCategory): BookingUnit => (category === 'desk' ? 'desk' : 'space')

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

// Times are 'HH:mm' in local time; null means closed that day.
export type DayHours = { open: string; close: string } | null

export type OpeningHours = Record<Weekday, DayHours>

export type SpaceStatus = 'listed' | 'draft'

// Only what a space needs to show about its host; the full user lives in the auth feature.
export type SpaceHost = {
  id: number
  name: string
}

export type Space = {
  id: number
  name: string
  description: string
  category: SpaceCategory
  city: string
  address: string
  // Desk: price for one desk per hour. Other categories: price for the whole space per hour.
  pricePerHour: number
  // Maximum number of people in the space, for every category.
  capacity: number
  // Number of bookable desks: required when category is 'desk', absent otherwise.
  deskCount?: number
  // At least one URL; the first one is the cover photo.
  images: string[]
  openingHours: OpeningHours
  status: SpaceStatus
  host: SpaceHost
  createdAt: string
  // Read-only, computed by the backend on every read: desks with no confirmed booking in the current
  // hour. null for non-desk spaces and while the space is closed.
  availableDesks: number | null
  // Only on the host's own listing (`hostId` filter). Active = upcoming, pending or confirmed;
  // a space with active bookings cannot be deleted.
  bookingCounts?: { active: number; pending: number }
}

// A draft is only visible to its own host; for everyone else it does not exist (404).
export const canView = (space: Space, userId: number | undefined) =>
  space.status === 'listed' || space.host.id === userId

// The host is taken from the session, never from the form; availableDesks and bookingCounts are
// never sent.
export type NewSpace = Omit<Space, 'id' | 'createdAt' | 'host' | 'availableDesks' | 'bookingCounts'>

export type SpaceFilters = {
  search?: string
  category?: SpaceCategory
  city?: string
  // The host's user id, for "My spaces" and a host's profile.
  hostId?: number
  // Guests only see 'listed' spaces; drafts are for their host.
  status?: SpaceStatus
  // Price per hour in EUR, both inclusive.
  minPrice?: number
  maxPrice?: number
}

// Price chips on Explore (?price=10-30). They map to minPrice/maxPrice, so the API stays generic.
export type PriceRange = 'under-10' | '10-30' | 'over-30'

export const PRICE_RANGES: Record<PriceRange, { label: string; minPrice?: number; maxPrice?: number }> = {
  'under-10': { label: 'Under €10', maxPrice: 9.99 },
  '10-30': { label: '€10–30', minPrice: 10, maxPrice: 30 },
  'over-30': { label: 'Over €30', minPrice: 30.01 },
}

export const isPriceRange = (value: string | null): value is PriceRange =>
  value !== null && Object.hasOwn(PRICE_RANGES, value)
