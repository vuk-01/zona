import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api-client'
import { onSessionChanged, onSessionExpired } from '@/lib/auth-token'
import { currentUserQueryKey } from '@/lib/user'

// A 4xx from the backend (not found, no access, invalid input) gives the same answer every time, so
// it is not retried. Anything else gets TanStack Query's default of 3 tries, as the mock always had.
const retry = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 3

const queryClient = new QueryClient({ defaultOptions: { queries: { retry } } })

// The backend refused the stored token (expired, or the account is gone): the user is signed out and
// every query runs again without it. Subscribed once here, not in an effect, so StrictMode does not
// add it twice; the fixed toast id shows one toast for several refused requests at once.
onSessionExpired(() => {
  queryClient.setQueryData(currentUserQueryKey, null)
  void queryClient.invalidateQueries()
  toast('Your session ended. Log in again.', { id: 'session-expired' })
})

// Another tab logged in, out or as someone else: nothing cached may outlive the old token, so every
// query goes back to its initial state (the signed-in user included) and the active ones load again.
onSessionChanged(() => {
  void queryClient.resetQueries()
})

type ProvidersProps = {
  children: ReactNode
}

// All global providers in one place: the data cache, with its retry rule and the session end above.
export function Providers({ children }: ProvidersProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
