import { type Page, api } from '@/lib/api-client'

import type { NewSpace, Space, SpaceFilters } from '../types'

// The largest page GET /spaces returns. Lists that need every row (the bookings join, the category
// stats, My spaces) ask for this much; past 500 spaces they would need more pages.
export const MAX_PAGE_SIZE = 500

export type Pagination = {
  page?: number
  size?: number
}

// The routes of docs/entities.md (Space). The backend computes availableDesks on every read, adds
// bookingCounts to the host's own listing (hostId = own id) and takes the host of a new space from the
// token. A space with active bookings cannot be deleted: 409 space_has_active_bookings.
export const spacesApi = {
  // Newest first; favoriteOf (own id only) lists the saved spaces, newest saved first.
  list: (filters: SpaceFilters = {}, { page, size }: Pagination = {}, signal?: AbortSignal) =>
    api.get<Page<Space>>('/spaces', { params: { ...filters, page, size }, signal }),

  get: (id: number, signal?: AbortSignal) => api.get<Space>(`/spaces/${id}`, { signal }),

  create: (input: NewSpace) => api.post<Space>('/spaces', input),

  update: (id: number, changes: Partial<NewSpace>) => api.patch<Space>(`/spaces/${id}`, changes),

  remove: (id: number) => api.delete(`/spaces/${id}`),
}
