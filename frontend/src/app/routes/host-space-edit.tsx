import { useNavigate, useParams } from 'react-router'

import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { useSpace, useUpdateSpace } from '@/features/spaces/api/use-spaces'
import { BackToSpacesLink } from '@/features/spaces/components/back-to-spaces-link'
import { SpaceForm } from '@/features/spaces/components/space-form'
import { SpaceFormSkeleton } from '@/features/spaces/components/space-form-skeleton'
import { savedNotice } from '@/features/spaces/hooks/use-saved-notice'
import { NotFoundError } from '@/lib/mock-db'

// Wrapped in RequireAuth mode="host", so the user is signed in once the page renders.
export function HostSpaceEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  // "/host/spaces/abc/edit" gives NaN, which the API answers with 404 like any unknown id
  const { data: space, isLoading, error, refetch, isRefetching } = useSpace(Number(id))
  const { data: user } = useCurrentUser()
  const updateSpace = useUpdateSpace()

  if (isLoading) {
    return (
      <section>
        <BackToSpacesLink />
        <PageTitle>Edit space</PageTitle>
        <SpaceFormSkeleton />
      </section>
    )
  }

  // Someone else's space is "not found" too: a host only ever edits their own
  if (error instanceof NotFoundError || (space && space.host.id !== user?.id)) {
    return (
      <section className="flex flex-col items-start gap-4">
        <BackToSpacesLink />
        <PageTitle>Space not found</PageTitle>
        <p className="text-muted-foreground">This space does not exist or is not one of yours.</p>
      </section>
    )
  }

  if (error || !space) {
    return (
      <section role="alert" className="flex flex-col items-start gap-4">
        <BackToSpacesLink />
        <PageTitle>Edit space</PageTitle>
        <p className="text-destructive">This space failed to load.</p>
        <Button
          variant="outline"
          className="h-11 rounded-full bg-transparent hover:bg-accent focus-visible:ring-ring md:h-9"
          disabled={isRefetching}
          onClick={() => refetch()}
        >
          Try again
        </Button>
      </section>
    )
  }

  return (
    <section>
      <BackToSpacesLink />
      <PageTitle>{`Edit ${space.name}`}</PageTitle>
      <SpaceForm
        space={space}
        isPending={updateSpace.isPending}
        error={updateSpace.error}
        onSubmit={(changes) =>
          updateSpace.mutate(
            { id: space.id, changes },
            { onSuccess: (saved) => navigate('/host/spaces', { state: savedNotice(saved, false) }) },
          )
        }
      />
    </section>
  )
}
