import { Skeleton } from '@/components/ui/skeleton'

// The edit form while the space loads: the same section cards, so nothing jumps when it appears.
export function SpaceFormSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex max-w-2xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 md:gap-8"
    >
      <span className="sr-only">Loading the space…</span>
      {Array.from({ length: 3 }, (_, section) => (
        <div key={section} className="grid gap-4 rounded-lg border bg-card p-4 md:p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-full md:w-40" />
    </div>
  )
}
