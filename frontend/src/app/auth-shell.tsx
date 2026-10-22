import { AuthLayout } from '@/components/layout/auth-layout'
import { SpacesShowcase } from '@/features/spaces/components/spaces-showcase'
import { useCategoryStats } from '@/features/spaces/hooks/use-category-stats'

// Wires what Zona is (the category illustrations and the live line, from the spaces feature) into the
// auth layout, which imports no features. Shared by /login and /signup.
export function AuthShell() {
  const stats = useCategoryStats()

  return <AuthLayout showcase={<SpacesShowcase stats={stats} />} />
}
