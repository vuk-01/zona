import { Loader2, LogIn, LogOut } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import type { NavAccount } from './nav-items'

type SidebarAccountProps = {
  account: NavAccount
}

// The bottom of the side menu (DESIGN.md "Layout"): the account on its own surface. Signed in: the photo
// or initials, name, email and "Log out"; a visitor: one line and "Log in"; a placeholder while it loads.
export function SidebarAccount({ account }: SidebarAccountProps) {
  return (
    <div className="m-4 mt-0 rounded-xl bg-sidebar-accent p-3">
      {account.status === 'loading' && <Skeleton className="h-24 rounded-lg bg-sidebar" />}

      {account.status === 'visitor' && (
        <div className="flex flex-col gap-3 p-1">
          <div>
            <p className="text-sm font-semibold">Find your zone</p>
            <p className="text-xs text-sidebar-foreground/70">Log in to book a space or list your own.</p>
          </div>
          <Button
            asChild
            className="h-10 w-full rounded-full focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-accent"
          >
            <Link to={account.loginHref}>
              <LogIn aria-hidden="true" />
              Log in
            </Link>
          </Button>
        </div>
      )}

      {account.status === 'signed-in' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 p-1">
            {account.avatar}
            <div className="min-w-0 flex-1">
              <p title={account.name} className="truncate text-sm font-semibold">
                {account.name}
              </p>
              <p title={account.email} className="truncate text-xs text-sidebar-foreground/70">
                {account.email}
              </p>
            </div>
          </div>
          <div className="border-t border-sidebar-foreground/10 pt-2">
            <Button
              variant="ghost"
              aria-label={`Log out ${account.name}`}
              disabled={account.isLoggingOut}
              onClick={account.onLogout}
              className="h-10 w-full justify-start gap-3 rounded-lg px-3 text-sidebar-foreground/80 hover:bg-sidebar hover:text-sidebar-foreground focus-visible:ring-ring"
            >
              {account.isLoggingOut ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="size-5" aria-hidden="true" />
              )}
              Log out
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
