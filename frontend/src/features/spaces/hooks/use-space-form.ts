import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  CATEGORY_LABELS,
  type NewSpace,
  type Space,
  type SpaceCategory,
  type SpaceStatus,
  type Weekday,
} from '../types'

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const MAX_PHOTOS = 8

// Bookings are in whole hours, so opening hours are too: opens 00:00–23:00, closes 01:00–24:00.
const hour = (h: number) => `${String(h).padStart(2, '0')}:00`
export const OPEN_TIMES = Array.from({ length: 24 }, (_, h) => hour(h))
export const CLOSE_TIMES = Array.from({ length: 24 }, (_, h) => hour(h + 1))

const isHttpUrl = (value: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

const isWholeNumber = (value: string) => /^\d+$/.test(value)

const dayHours = z.object({ isOpen: z.boolean(), open: z.string(), close: z.string() })

// Every value stays a string (or boolean) while the host types, so the form's input and output types
// are the same; toNewSpace turns them into numbers once the form is valid.
const spaceFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Give your space a name of at least 3 characters')
      .max(80, 'Keep the name under 80 characters'),
    description: z.string().trim().max(500, 'Keep the description under 500 characters'),
    category: z.enum(Object.keys(CATEGORY_LABELS) as [SpaceCategory, ...SpaceCategory[]], {
      error: 'Pick a category',
    }),
    deskCount: z.string().trim(),
    city: z.string().trim().min(1, 'Enter the city'),
    address: z.string().trim().min(1, 'Enter the street address'),
    pricePerHour: z
      .string()
      .trim()
      .min(1, 'Enter a price per hour')
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v) && Number(v) > 0, 'Enter a price above €0, like 4 or 12.50')
      .refine((v) => Number(v) <= 1000, 'Keep the price at €1000 per hour or less'),
    capacity: z
      .string()
      .trim()
      .min(1, 'Enter how many people fit')
      .refine((v) => isWholeNumber(v) && Number(v) >= 1, 'Enter a whole number, at least 1')
      .refine((v) => Number(v) <= 1000, 'Keep it at 1000 people or fewer'),
    openingHours: z.object({
      mon: dayHours,
      tue: dayHours,
      wed: dayHours,
      thu: dayHours,
      fri: dayHours,
      sat: dayHours,
      sun: dayHours,
    }),
    images: z
      .array(
        z.object({
          url: z
            .string()
            .trim()
            .min(1, 'Paste a link to a photo')
            .refine(isHttpUrl, 'Enter a link that starts with https://'),
        }),
      )
      .min(1, 'Add at least one photo')
      .max(MAX_PHOTOS, `Add at most ${MAX_PHOTOS} photos`),
    // Only shown when editing; a new space is published or saved as a draft with its own button.
    listed: z.boolean(),
  })
  .superRefine((values, ctx) => {
    // Desks: required and a whole number only for a desk space, and never more desks than people
    if (values.category === 'desk') {
      const desks = values.deskCount
      if (!isWholeNumber(desks) || Number(desks) < 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['deskCount'],
          message: 'Enter a whole number of desks, at least 1',
        })
      } else if (isWholeNumber(values.capacity) && Number(desks) > Number(values.capacity)) {
        ctx.addIssue({
          code: 'custom',
          path: ['deskCount'],
          message: `A space for ${values.capacity} people can have at most ${values.capacity} desks`,
        })
      }
    }

    const openDays = WEEKDAYS.filter((day) => values.openingHours[day].isOpen)
    if (openDays.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['openingHours'], message: 'Open your space on at least one day' })
    }
    for (const day of openDays) {
      const { open, close } = values.openingHours[day]
      if (close <= open) {
        ctx.addIssue({
          code: 'custom',
          path: ['openingHours', day, 'close'],
          message: 'Close after it opens',
        })
      }
    }
  })

export type SpaceFormValues = z.infer<typeof spaceFormSchema>

const NEW_SPACE_VALUES: Omit<SpaceFormValues, 'category'> = {
  name: '',
  description: '',
  deskCount: '',
  city: '',
  address: '',
  pricePerHour: '',
  capacity: '',
  // Office hours on weekdays, closed on the weekend: the most common start, easy to change
  openingHours: {
    mon: { isOpen: true, open: '09:00', close: '17:00' },
    tue: { isOpen: true, open: '09:00', close: '17:00' },
    wed: { isOpen: true, open: '09:00', close: '17:00' },
    thu: { isOpen: true, open: '09:00', close: '17:00' },
    fri: { isOpen: true, open: '09:00', close: '17:00' },
    sat: { isOpen: false, open: '10:00', close: '16:00' },
    sun: { isOpen: false, open: '10:00', close: '16:00' },
  },
  images: [{ url: '' }],
  listed: true,
}

// An existing space as form values; a closed day keeps a sensible time for when it is opened again.
function toFormValues(space: Space): SpaceFormValues {
  const openingHours = Object.fromEntries(
    WEEKDAYS.map((day) => {
      const hours = space.openingHours[day]
      return [
        day,
        hours ? { isOpen: true, ...hours } : { ...NEW_SPACE_VALUES.openingHours[day], isOpen: false },
      ]
    }),
  ) as SpaceFormValues['openingHours']

  return {
    name: space.name,
    description: space.description,
    category: space.category,
    deskCount: space.deskCount === undefined ? '' : String(space.deskCount),
    city: space.city,
    address: space.address,
    pricePerHour: String(space.pricePerHour),
    capacity: String(space.capacity),
    openingHours,
    images: space.images.map((url) => ({ url })),
    listed: space.status === 'listed',
  }
}

// Valid form values as what the API takes. A new space gets its status from the button; an edit
// takes it from the Listed switch.
export function toNewSpace(values: SpaceFormValues, status: SpaceStatus): NewSpace {
  const openingHours = Object.fromEntries(
    WEEKDAYS.map((day) => {
      const { isOpen, open, close } = values.openingHours[day]
      return [day, isOpen ? { open, close } : null]
    }),
  ) as NewSpace['openingHours']

  return {
    name: values.name,
    description: values.description,
    category: values.category,
    deskCount: values.category === 'desk' ? Number(values.deskCount) : undefined,
    city: values.city,
    address: values.address,
    pricePerHour: Number(values.pricePerHour),
    capacity: Number(values.capacity),
    openingHours,
    images: values.images.map((image) => image.url),
    status,
  }
}

// The space form: empty for a new space, filled in with `space` when editing.
export function useSpaceForm(space?: Space) {
  return useForm<SpaceFormValues>({
    resolver: zodResolver(spaceFormSchema),
    defaultValues: space ? toFormValues(space) : NEW_SPACE_VALUES,
  })
}
