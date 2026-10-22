import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { User } from '@/lib/user'

export const BIO_MAX_LENGTH = 200

// The same limits as normalize() in users-api.ts, so the form shows them before the request is sent
const profileFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter your name, at least 2 characters')
    .max(60, 'Keep your name under 60 characters'),
  city: z.string().trim(),
  bio: z.string().trim().max(BIO_MAX_LENGTH, `Keep your bio under ${BIO_MAX_LENGTH} characters`),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>

export const toProfileFormValues = (user: User): ProfileFormValues => ({
  name: user.name,
  city: user.city,
  bio: user.bio,
})

// Name, city and bio of the signed-in user's own profile; email and password changes come later
// with the backend.
export function useProfileForm(user: User) {
  return useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toProfileFormValues(user),
  })
}
