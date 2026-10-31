import { describe, expect, it } from 'vitest'

import { currentHourIndex, isOpenAt } from './popular-hour'

// The chart of GET /api/bookings/popular-times: 14 hours from 08:00
const FIRST_HOUR = 8
const LENGTH = 14
const officeHours = { open: '09:00', close: '17:00' }

describe('isOpenAt', () => {
  it('is open from the opening hour up to, not including, the closing hour', () => {
    expect(isOpenAt(officeHours, 8)).toBe(false)
    expect(isOpenAt(officeHours, 9)).toBe(true)
    expect(isOpenAt(officeHours, 16)).toBe(true)
    expect(isOpenAt(officeHours, 17)).toBe(false)
  })

  it('is open until midnight when the space closes at 24:00', () => {
    expect(isOpenAt({ open: '08:00', close: '24:00' }, 23)).toBe(true)
  })

  it('is never open on a closed day', () => {
    expect(isOpenAt(null, 12)).toBe(false)
  })
})

describe('currentHourIndex', () => {
  it('marks the current hour inside the opening hours, whatever its value', () => {
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 9, officeHours)).toBe(1)
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 16, officeHours)).toBe(8)
  })

  it('marks nothing before opening or from the closing hour on', () => {
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 8, officeHours)).toBeNull()
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 17, officeHours)).toBeNull()
  })

  it('marks nothing outside the chart, also when the space is open then', () => {
    const allDay = { open: '00:00', close: '24:00' }
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 7, allDay)).toBeNull()
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 21, allDay)).toBe(13)
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 22, allDay)).toBeNull()
  })

  it('marks nothing on a closed day', () => {
    expect(currentHourIndex(FIRST_HOUR, LENGTH, 12, null)).toBeNull()
  })
})
