import { Skeleton } from '@/components/ui/skeleton'

// Loading state of the space page, in the same two-column layout.
export function SpaceDetailSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading space"
      className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12"
    >
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-2/3 rounded-full" />
        <Skeleton className="aspect-[16/10] w-full rounded-lg" />
        <Skeleton className="h-5 w-1/2 rounded-full" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  )
}
