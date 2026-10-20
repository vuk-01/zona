import { useSearchParams } from 'react-router'

// Where to go after login or sign-up: the `?redirect=` page, or home.
// Only same-site paths are accepted ("/spaces/4"), never "//evil.com" or "https://…".
export function useRedirectTarget() {
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect')
  const isSafe = redirect !== null && redirect.startsWith('/') && !redirect.startsWith('//')

  return {
    redirectTo: isSafe ? redirect : '/',
    // Keeps ?redirect= when switching between /login and /signup
    search: isSafe ? `?redirect=${encodeURIComponent(redirect)}` : '',
  }
}
