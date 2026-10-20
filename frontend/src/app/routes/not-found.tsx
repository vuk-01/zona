import { Link } from 'react-router'

import { PageTitle } from '@/components/layout/page-title'

export function NotFound() {
  return (
    <section>
      <PageTitle>Page not found</PageTitle>
      <Link
        to="/"
        className="mt-4 inline-block rounded-full font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        Back to home
      </Link>
    </section>
  )
}
