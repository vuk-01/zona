import type { MouseEvent } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { setTheme, useIsDark } from '@/lib/theme'

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

// Round icon button in the top bar and on the auth pages (DESIGN.md "Dark mode"). It flips between
// light and dark, and the icon shows the theme a click switches to: a sun on dark, a moon on light.
// The new theme spreads in a circle from the button (View Transitions, see index.css); browsers
// without them, and reduced motion, switch at once.
export function ThemeToggle() {
  const isDark = useIsDark()
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const next = isDark ? 'light' : 'dark'
    if (!('startViewTransition' in document) || reducedMotion.matches) {
      setTheme(next)
      return
    }

    const { left, top, width, height } = event.currentTarget.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    // Far enough to cover the farthest corner of the window
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))

    const transition = document.startViewTransition(() => setTheme(next))
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 500, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' },
        )
      })
      .catch(() => {
        // Skipped (e.g. a second click mid-animation): the theme has still changed
      })
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="relative size-11 shrink-0 overflow-hidden rounded-full text-foreground focus-visible:ring-ring md:size-9"
      aria-label={label}
      title={label}
      onClick={toggle}
    >
      {/* Both icons stay in place; the dark class swaps them with a turn and a fade */}
      <Moon
        className="size-5 transition-all duration-500 motion-reduce:transition-none dark:scale-0 dark:rotate-90 dark:opacity-0"
        aria-hidden="true"
      />
      <Sun
        className="absolute size-5 scale-0 -rotate-90 opacity-0 transition-all duration-500 motion-reduce:transition-none dark:scale-100 dark:rotate-0 dark:opacity-100"
        aria-hidden="true"
      />
    </Button>
  )
}
