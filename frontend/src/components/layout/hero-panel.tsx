import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'

const panelVariants = cva(
  'relative -mx-4 -mt-8 overflow-hidden rounded-xl border-b bg-card px-4 pt-8 pb-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 md:mx-0 md:mt-0 md:border md:p-8',
  {
    variants: {
      // Large screens: a second column on the right for the aside, both centered vertically
      withAside: {
        true: 'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center lg:gap-12',
        false: '',
      },
    },
  },
)

type HeroPanelProps = {
  children: ReactNode
  // Large screens: shown to the right of the content (the newest space on Home, the category on Explore)
  aside?: ReactNode
}

// The top of every guest page (DESIGN.md "Hero panel"): the page title and its main controls on one card,
// over flat shapes in the style of the category illustrations (a pale-blue circle, a ring, a patch of
// dots). On phones it is the top of the sheet, edge to edge, so it must be the page's first element.
export function HeroPanel({ children, aside }: HeroPanelProps) {
  return (
    <div className={panelVariants({ withAside: aside !== undefined })}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-secondary md:-top-32 md:-right-16 md:size-96 lg:size-120" />
        {/* The ring only fits the tall panels (Home, Explore); on a short one it runs into the content */}
        {aside !== undefined && (
          <div className="absolute -bottom-20 -left-20 hidden size-40 rounded-full border-16 border-chart-2/70 md:block" />
        )}
        {/* lg+: only there is the space next to the title free */}
        <div className="absolute top-6 right-1/3 hidden h-12 w-24 bg-dots lg:block" />
      </div>
      <div className="relative flex min-w-0 flex-col gap-6">{children}</div>
      {aside}
    </div>
  )
}
