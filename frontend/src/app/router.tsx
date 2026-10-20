import { createBrowserRouter } from 'react-router'

import { Home } from '@/app/routes/home'
import { Listings } from '@/app/routes/listings'
import { Login } from '@/app/routes/login'
import { NotFound } from '@/app/routes/not-found'
import { Signup } from '@/app/routes/signup'
import { AppLayout } from '@/components/layout/app-layout'
import { AuthLayout } from '@/components/layout/auth-layout'
import { AccountMenu } from '@/features/auth/components/account-menu'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
    ],
  },
  {
    element: <AppLayout account={<AccountMenu />} />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/listings', element: <Listings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
