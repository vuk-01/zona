import { Skeleton } from '@/components/ui/skeleton'

// The edit form while the space loads: the same sections, so nothing jumps when it appears.
export function SpaceFormSkeleton() {
  return (
    <div aria-busy="true" className="mt-6 flex max-w-2xl flex-col gap-10 md:mt-8">
      <span className="sr-only">Loading the space…</span>
      {Array.from({ length: 3 }, (_, section) => (
        <div key={section} className="grid gap-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-12 w-full rounded-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-full md:w-40" />
    </div>
  )
}
