import { Building2, CircleAlert, Loader2, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { useSpaces } from '../api/use-spaces'
import type { Space } from '../types'
import { HostSpaceCard } from './host-space-card'

type HostSpacesListProps = {
  hostId: number
}

// The host's own spaces (listed and drafts) with all three states: loading, empty and error.
export function HostSpacesList({ hostId }: HostSpacesListProps) {
  const { data: spaces, isLoading, error, refetch, isFetching } = useSpaces({ hostId })

  // After a delete the card and its button are gone: focus moves to the list and the result is
  // announced. Focus only moves once the refetched list no longer has the space, i.e. after the
  // dialog (and its focus trap) has unmounted with the card.
  const resultsRef = useRef<HTMLDivElement>(null)
  const [announcement, setAnnouncement] = useState('')
  const [deletedId, setDeletedId] = useState<number | null>(null)

  const onDeleted = (space: Pick<Space, 'id' | 'name'>) => {
    setAnnouncement(`${space.name} was deleted`)
    setDeletedId(space.id)
  }

  useEffect(() => {
    if (deletedId === null || spaces?.some((s) => s.id === deletedId)) return
    // In a timeout: after Radix has tried to give focus back to the (now removed) Delete button.
    // The reset happens inside it too; resetting here would re-run the effect and cancel the timer.
    const timer = setTimeout(() => {
      resultsRef.current?.focus()
      setDeletedId(null)
    })
    return () => clearTimeout(timer)
  }, [deletedId, spaces])

  // Error first: a retry keeps the error block (and the focused "Try again" button) on screen
  if (error) {
    return (
      <div
        role="alert"
        className="mt-8 flex flex-col items-start gap-4 rounded-lg border bg-card p-6 text-destructive"
      >
        <p className="flex items-center gap-2">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          Your spaces failed to load.
        </p>
        <Button
          variant="outline"
          className="h-11 rounded-full bg-transparent text-foreground hover:bg-accent focus-visible:ring-ring md:h-9"
          aria-disabled={isFetching}
          onClick={() => {
            if (!isFetching) void refetch()
          }}
        >
          {isFetching && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isFetching ? 'Trying…' : 'Try again'}
        </Button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div aria-busy="true" className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <span className="sr-only">Loading your spaces…</span>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-lg border bg-card pb-6">
            <Skeleton className="aspect-[16/10] w-full rounded-lg" />
            <div className="flex flex-col gap-3 px-6">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const isEmpty = !spaces || spaces.length === 0

  return (
    <div
      ref={resultsRef}
      tabIndex={-1}
      role="region"
      aria-label="Your spaces"
      className="mt-8 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card md:focus-visible:ring-offset-background"
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {isEmpty ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-6 py-12 text-center">
          <Building2 className="size-10 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold">You have no spaces yet</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Add a desk, a meeting room, an office or an event hall and start getting bookings.
          </p>
          <Button
            asChild
            className="h-12 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <Link to="/host/spaces/new">
              <Plus aria-hidden="true" />
              Add your space
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <li key={space.id}>
              <HostSpaceCard space={space} onDeleted={onDeleted} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
