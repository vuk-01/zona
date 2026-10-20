import { useSearchParams } from 'react-router'

// The `?redirect=` page to return to after login or sign-up, or null when there is none.
// Only same-site paths are accepted ("/spaces/4"), never "//evil.com" or "https://…".
export function useRedirectTarget() {
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const isSafe = redirect !== null && redirect.startsWith('/') && !redirect.startsWith('//')

  return {
    redirect: isSafe ? redirect : null,
    // Keeps ?redirect= when switching between /login and /signup
    search: isSafe ? `?redirect=${encodeURIComponent(redirect)}` : '',
  }
}
