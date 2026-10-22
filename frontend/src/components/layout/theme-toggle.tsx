import { type LucideIcon, Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { type Theme, setTheme, useTheme } from '@/lib/theme'

// A click moves on in this order: light → dark → system → light
const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' }
const LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' }
const ICONS: Record<Theme, LucideIcon> = { light: Sun, dark: Moon, system: Monitor }

// Round icon button in the top bar and on the auth pages (DESIGN.md "Dark mode"). The icon shows the
// current theme; the label names it and the next one: "Theme: Dark. Switch to system theme".
export function ThemeToggle() {
  const theme = useTheme()
  const next = NEXT[theme]
  const Icon = ICONS[theme]
  const label = `Theme: ${LABELS[theme]}. Switch to ${LABELS[next].toLowerCase()} theme`

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-11 shrink-0 rounded-full text-foreground focus-visible:ring-ring md:size-9"
      aria-label={label}
      title={label}
      onClick={() => setTheme(next)}
    >
      <Icon className="size-5" aria-hidden="true" />
    </Button>
  )
}
