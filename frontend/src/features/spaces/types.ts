export type SpaceCategory = 'desk' | 'meeting-room' | 'office' | 'event-hall'

export const CATEGORY_LABELS: Record<SpaceCategory, string> = {
  desk: 'Desk',
  'meeting-room': 'Meeting room',
  office: 'Office',
  'event-hall': 'Event hall',
}

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
}

// The host is taken from the session, never from the form.
export type NewSpace = Omit<Space, 'id' | 'createdAt' | 'host'>

export type SpaceFilters = {
  search?: string
  category?: SpaceCategory
  city?: string
  // The host's user id, for "My spaces" and a host's profile.
  hostId?: number
}
