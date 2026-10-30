import { useSearchParams } from 'react-router'

// A page to go to after login or sign-up, or null. Only same-site paths are accepted ("/spaces/4"), never
// "//evil.com" or "https://…". Shared by /login (?redirect=) and the login dialog (a nav item's page).
export function safeRedirect(path: string | null | undefined): string | null {
  return path != null && path.startsWith('/') && !path.startsWith('//') ? path : null
}

// The `?redirect=` page to return to after login or sign-up, or null when there is none.
export function useRedirectTarget() {
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))

  return {
    redirect,
    // Keeps ?redirect= when switching between /login and /signup
    search: redirect ? `?redirect=${encodeURIComponent(redirect)}` : '',
  }
}
