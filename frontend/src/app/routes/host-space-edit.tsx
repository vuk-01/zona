import { CircleAlert, MapPinOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { EmptyState, emptyStateAction } from '@/components/feedback/empty-state'
import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { useSpace, useUpdateSpace } from '@/features/spaces/api/use-spaces'
import { BackToSpacesLink } from '@/features/spaces/components/back-to-spaces-link'
import { SpaceForm } from '@/features/spaces/components/space-form'
import { SpaceFormSkeleton } from '@/features/spaces/components/space-form-skeleton'
import { savedNotice } from '@/features/spaces/hooks/use-saved-notice'
import { isNotFound } from '@/lib/api-client'

// Wrapped in RequireAuth mode="host", so the user is signed in once the page renders. The back link and
// the title share the hero panel in every state, so the title stays mounted (and keeps focus) when the
// space arrives; below it the form skeleton, the error or the form.
export function HostSpaceEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  // "/host/spaces/abc/edit" gives NaN, which the API answers with 422; isNotFound treats it like an unknown id (404)
  const { data: space, isLoading, error, refetch, isRefetching } = useSpace(Number(id))
  const { data: user } = useCurrentUser()
  const updateSpace = useUpdateSpace()

  // Someone else's space is "not found" too: a host only ever edits their own
  if (isNotFound(error) || (space && space.host.id !== user?.id)) {
    return (
      <EmptyState
        icon={MapPinOff}
        title={<PageTitle>Space not found</PageTitle>}
        text="This space does not exist or is not one of yours."
        action={
          <Button asChild className={emptyStateAction}>
            <Link to="/host/spaces">Back to My spaces</Link>
          </Button>
        }
      />
    )
  }

  let body: ReactNode
  if (isLoading) {
    body = <SpaceFormSkeleton />
  } else if (error || !space) {
    body = (
      <div
        role="alert"
        className="flex flex-col items-start gap-4 rounded-lg border bg-card p-6 text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
      >
        <p className="flex items-center gap-2">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          This space failed to load.
        </p>
        <Button
          variant="outline"
          className="h-11 rounded-full bg-transparent text-foreground hover:bg-accent focus-visible:ring-ring md:h-9"
          disabled={isRefetching}
          onClick={() => refetch()}
        >
          Try again
        </Button>
      </div>
    )
  } else {
    body = (
      <SpaceForm
        space={space}
        isPending={updateSpace.isPending}
        // mutateAsync: the form shows a failure itself
        onSubmit={(changes) =>
          updateSpace
            .mutateAsync({ id: space.id, changes })
            .then((saved) => navigate('/host/spaces', { state: savedNotice(saved, false) }))
        }
      />
    )
  }

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <HeroPanel>
        <div className="flex flex-col gap-2">
          <BackToSpacesLink />
          <PageTitle>{space ? `Edit ${space.name}` : 'Edit space'}</PageTitle>
        </div>
      </HeroPanel>
      {body}
    </section>
  )
}
