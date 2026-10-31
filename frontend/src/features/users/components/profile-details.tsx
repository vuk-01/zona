import { cva } from 'class-variance-authority'
import { Loader2, Pencil } from 'lucide-react'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useWatch } from 'react-hook-form'

import { StatusNotice } from '@/components/feedback/status-notice'
import { FormAlert } from '@/components/form/form-alert'
import { FormField } from '@/components/form/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { User } from '@/lib/user'

import { useUpdateProfile } from '../api/use-users'
import { BIO_MAX_LENGTH, toProfileFormValues, useProfileForm } from '../hooks/use-profile-form'

// createdAt is an ISO date-time in UTC; formatting it in UTC keeps the month from shifting.
const memberSinceFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

// A missing value reads as meta text ("Not set"), a real one as the value
const valueVariants = cva('wrap-break-word', {
  variants: {
    missing: {
      true: 'text-muted-foreground',
      false: 'font-medium',
    },
  },
})

const buttonClass =
  'h-12 w-full rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:w-auto md:px-8'

// Edit and back: the fields (or the values) fade in where the other ones were
const fadeIn = 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300'

type ProfileDetailsProps = {
  // The signed-in user; the route passes it in from the auth feature
  user: User
}

// "Personal information" on Profile: label/value pairs, and "Edit" turns name, city and bio into fields
// in the same card. Focus goes to the name on Edit and back to "Edit" after Save or Cancel.
export function ProfileDetails({ user }: ProfileDetailsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const editRef = useRef<HTMLButtonElement>(null)
  const updateProfile = useUpdateProfile()
  const form = useProfileForm(user)
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = form
  const bio = useWatch({ control, name: 'bio' })

  const startEditing = () => {
    form.reset(toProfileFormValues(user))
    updateProfile.reset()
    setNotice(null)
    // flushSync: the fields are on the page before the first one takes focus
    flushSync(() => setIsEditing(true))
    form.setFocus('name')
  }

  const stopEditing = () => {
    flushSync(() => setIsEditing(false))
    editRef.current?.focus()
  }

  const onSubmit = handleSubmit((changes) =>
    updateProfile.mutate(
      { id: user.id, changes },
      {
        // useUpdateProfile waits for the signed-in user to refetch, so the new values show right away
        onSuccess: () => {
          setNotice('Your profile was saved.')
          stopEditing()
        },
      },
    ),
  )

  const details = [
    { label: 'Name', value: user.name },
    { label: 'Email', value: user.email },
    { label: 'City', value: user.city },
    { label: 'Member since', value: memberSinceFormat.format(new Date(user.createdAt)) },
    { label: 'Role', value: user.isHost ? 'Guest and host' : 'Guest' },
  ]

  return (
    <section aria-labelledby="personal-heading" className="rounded-lg border bg-card p-4 md:p-6">
      <div className="border-b pb-4">
        {/* min-h: the row keeps its height while "Edit" is hidden during editing */}
        <div className="flex min-h-11 items-center justify-between gap-4 md:min-h-9">
          <h2 id="personal-heading" className="text-lg font-semibold">
            Personal information
          </h2>
          {!isEditing && (
            <Button
              ref={editRef}
              variant="outline"
              className="h-11 shrink-0 rounded-full bg-transparent hover:bg-accent focus-visible:ring-ring md:h-9"
              aria-label="Edit personal information"
              onClick={startEditing}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <StatusNotice notice={notice} className="mt-6" />

      {isEditing ? (
        <form noValidate onSubmit={onSubmit} className={`mt-6 flex flex-col gap-4 ${fadeIn}`}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              id="profile-name"
              label="Name"
              autoComplete="name"
              error={errors.name?.message}
              {...register('name')}
            />
            <div className="grid content-start gap-2">
              <Label htmlFor="profile-city" className="px-4">
                City <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="profile-city"
                autoComplete="address-level2"
                aria-invalid={errors.city ? true : undefined}
                aria-describedby={errors.city ? 'profile-city-error' : undefined}
                className="h-12 rounded-full bg-muted px-4 focus-visible:ring-ring"
                {...register('city')}
              />
              {errors.city && (
                <p id="profile-city-error" className="px-4 text-sm text-destructive">
                  {errors.city.message}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="profile-bio" className="px-4">
              About <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="profile-bio"
              rows={4}
              placeholder="A line or two about you and how you like to work"
              aria-invalid={errors.bio ? true : undefined}
              aria-describedby={errors.bio ? 'profile-bio-error profile-bio-count' : 'profile-bio-count'}
              className="rounded-lg bg-muted px-4 py-3 focus-visible:ring-ring"
              {...register('bio')}
            />
            <div className="flex gap-4 px-4 text-sm">
              {errors.bio && (
                <p id="profile-bio-error" className="text-destructive">
                  {errors.bio.message}
                </p>
              )}
              <p id="profile-bio-count" className="ml-auto shrink-0 text-muted-foreground">
                {bio.length}/{BIO_MAX_LENGTH}
              </p>
            </div>
          </div>

          {updateProfile.error && <FormAlert message={updateProfile.error.message} />}

          <div className="flex flex-col gap-3 md:flex-row">
            <Button type="submit" size="lg" disabled={updateProfile.isPending} className={buttonClass}>
              {updateProfile.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {updateProfile.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={updateProfile.isPending}
              className={`${buttonClass} bg-transparent hover:bg-accent`}
              onClick={stopEditing}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className={`mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3 ${fadeIn}`}>
          {details.map(({ label, value }) => (
            <div key={label} className="flex min-w-0 flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className={valueVariants({ missing: !value })}>{value || 'Not set'}</dd>
            </div>
          ))}
          <div className="flex min-w-0 flex-col gap-1 md:col-span-2 lg:col-span-3">
            <dt className="text-sm text-muted-foreground">About</dt>
            <dd className={valueVariants({ missing: !user.bio })}>{user.bio || 'No bio yet.'}</dd>
          </div>
        </dl>
      )}
    </section>
  )
}
