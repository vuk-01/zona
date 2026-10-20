import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const avatarVariants = cva(
  'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold text-secondary-foreground',
  {
    variants: {
      size: {
        sm: 'size-10 text-sm',
        lg: 'size-24 text-2xl',
      },
    },
    defaultVariants: { size: 'sm' },
  },
)

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

type UserAvatarProps = VariantProps<typeof avatarVariants> & {
  name: string
  avatarUrl: string | null
  className?: string
}

// Profile photo, or the user's initials when there is none.
export function UserAvatar({ name, avatarUrl, size, className }: UserAvatarProps) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`Photo of ${name}`}
        className={cn(avatarVariants({ size }), 'object-cover', className)}
      />
    )
  }
  return (
    <span role="img" aria-label={name} className={cn(avatarVariants({ size }), className)}>
      {initials(name)}
    </span>
  )
}
