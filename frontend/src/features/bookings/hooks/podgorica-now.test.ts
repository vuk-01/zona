import { describe, expect, it } from 'vitest'

import { podgoricaNow } from './podgorica-now'

describe('podgoricaNow', () => {
  it('is an hour ahead of UTC in winter', () => {
    expect(podgoricaNow(new Date('2026-01-15T09:30:00Z'))).toEqual({
      date: '2026-01-15',
      hour: 10,
      weekday: 'thu',
    })
  })

  it('is two hours ahead of UTC in summer', () => {
    expect(podgoricaNow(new Date('2026-07-01T09:30:00Z'))).toEqual({
      date: '2026-07-01',
      hour: 11,
      weekday: 'wed',
    })
  })

  it('is already the next day when it is late evening in UTC', () => {
    expect(podgoricaNow(new Date('2026-10-31T23:30:00Z'))).toEqual({
      date: '2026-11-01',
      hour: 0,
      weekday: 'sun',
    })
  })
})
