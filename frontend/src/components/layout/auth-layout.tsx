import { Link, Outlet } from 'react-router'

// Shell for /login and /signup: sky background with the wordmark, the form in a white sheet
// (mobile) or a card pinned near the top (md+), so it does not jump when errors appear.
// See "Auth pages" in DESIGN.md.
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col md:items-center md:px-4 md:py-16">
      <header className="px-4 pt-12 pb-8 text-center md:pt-0">
        <Link
          to="/"
          className="rounded-full font-heading text-2xl font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          Zona
        </Link>
      </header>
      <main className="flex-1 rounded-t-xl bg-card px-4 pt-8 pb-12 shadow-soft md:w-full md:max-w-md md:flex-none md:rounded-lg md:border md:p-8 md:shadow-none">
        <Outlet />
      </main>
    </div>
  )
}
