import { createBrowserRouter } from 'react-router'

import { AppShell } from '@/app/app-shell'
import { AuthShell } from '@/app/auth-shell'
import { Bookings } from '@/app/routes/bookings'
import { Favorites } from '@/app/routes/favorites'
import { Home } from '@/app/routes/home'
import { HostSpaceEdit } from '@/app/routes/host-space-edit'
import { HostSpaceNew } from '@/app/routes/host-space-new'
import { HostSpaces } from '@/app/routes/host-spaces'
import { Login } from '@/app/routes/login'
import { NotFound } from '@/app/routes/not-found'
import { Profile } from '@/app/routes/profile'
import { Signup } from '@/app/routes/signup'
import { SpaceDetail } from '@/app/routes/space-detail'
import { Spaces } from '@/app/routes/spaces'
import { RequireAuth } from '@/features/auth/components/require-auth'

export const router = createBrowserRouter([
  {
    element: <AuthShell />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
    ],
  },
  {
    element: <AppShell />,
    children: [
      // Guest mode: browsing is open to everyone, favorites and bookings need a signed-in user
      { path: '/', element: <Home /> },
      { path: '/spaces', element: <Spaces /> },
      { path: '/spaces/:id', element: <SpaceDetail /> },
      {
        path: '/favorites',
        element: (
          <RequireAuth>
            <Favorites />
          </RequireAuth>
        ),
      },
      {
        path: '/bookings',
        element: (
          <RequireAuth>
            <Bookings />
          </RequireAuth>
        ),
      },
      // Both modes; the guest/host switch lives here
      {
        path: '/profile',
        element: (
          <RequireAuth>
            <Profile />
          </RequireAuth>
        ),
      },
      // Host mode: signed in and in host mode
      {
        path: '/host/spaces',
        element: (
          <RequireAuth mode="host">
            <HostSpaces />
          </RequireAuth>
        ),
      },
      {
        path: '/host/spaces/new',
        element: (
          <RequireAuth mode="host">
            <HostSpaceNew />
          </RequireAuth>
        ),
      },
      {
        path: '/host/spaces/:id/edit',
        element: (
          <RequireAuth mode="host">
            <HostSpaceEdit />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
