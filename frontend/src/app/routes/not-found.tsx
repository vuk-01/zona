import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState, emptyStateAction } from '@/components/feedback/empty-state'
import { PageTitle } from '@/components/layout/page-title'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <EmptyState
      icon={MapPinOff}
      title={<PageTitle>Page not found</PageTitle>}
      text="This page does not exist or has moved."
      action={
        <Button asChild className={emptyStateAction}>
          <Link to="/">Back to home</Link>
        </Button>
      }
    />
  )
}
