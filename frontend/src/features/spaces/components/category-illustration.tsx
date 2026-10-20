import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import type { SpaceCategory } from '../types'

// Flat illustrations for the category row, drawn with theme tokens so they follow light and dark mode:
// `primary` blue, `chart-2` pale blue fills, `foreground` navy (light text in dark mode) outlines.
const outline = 'stroke-foreground'

const drawings: Record<SpaceCategory | 'all', ReactNode> = {
  all: (
    <>
      <rect x="6" y="6" width="36" height="36" rx="10" className="fill-chart-2" />
      <rect x="13" y="13" width="10" height="10" rx="3" className="fill-primary" />
      <rect x="25" y="13" width="10" height="10" rx="3" className="fill-primary" />
      <rect x="13" y="25" width="10" height="10" rx="3" className="fill-primary" />
      <rect x="25" y="25" width="10" height="10" rx="3" className="fill-primary" />
    </>
  ),
  desk: (
    <>
      <rect x="16" y="7" width="16" height="11" rx="2" className="fill-primary" />
      <rect x="23" y="18" width="2" height="4" className="fill-foreground" />
      <rect x="4" y="22" width="40" height="4" rx="1" className="fill-foreground" />
      <rect x="7" y="26" width="3" height="16" className="fill-foreground" />
      <rect
        x="29"
        y="27"
        width="12"
        height="15"
        rx="1.5"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <path
        d="M29 34.5h12M33.5 31h3M33.5 38.5h3"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={outline}
      />
    </>
  ),
  'meeting-room': (
    <>
      <rect x="12" y="5" width="24" height="9" rx="1.5" className="fill-chart-2" />
      <path
        d="M17 11l4-3 3 2 6-4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="stroke-primary"
      />
      <rect
        x="13"
        y="17"
        width="7"
        height="6"
        rx="2"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <rect
        x="28"
        y="17"
        width="7"
        height="6"
        rx="2"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <rect x="7" y="24" width="34" height="8" rx="4" className="fill-primary" />
      <rect
        x="13"
        y="35"
        width="7"
        height="6"
        rx="2"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <rect
        x="28"
        y="35"
        width="7"
        height="6"
        rx="2"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
    </>
  ),
  office: (
    <>
      <path
        d="M9 42V12l15-6 15 6v30z"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className={cn('fill-chart-2', outline)}
      />
      <rect x="14" y="15" width="6" height="5" rx="1" className="fill-primary" />
      <rect x="28" y="15" width="6" height="5" rx="1" className="fill-primary" />
      <rect x="14" y="24" width="6" height="5" rx="1" className="fill-primary" />
      <rect x="28" y="24" width="6" height="5" rx="1" className="fill-primary" />
      <rect x="21" y="32" width="6" height="10" rx="1" className="fill-foreground" />
      <path d="M5 42h38" strokeWidth="2" strokeLinecap="round" className={outline} />
    </>
  ),
  'event-hall': (
    <>
      <path d="M6 16L24 6l18 10z" className="fill-primary" />
      <rect x="7" y="16" width="34" height="3" rx="1" className="fill-foreground" />
      <rect
        x="10"
        y="20"
        width="5"
        height="16"
        rx="1"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <rect
        x="18"
        y="20"
        width="5"
        height="16"
        rx="1"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <rect
        x="26"
        y="20"
        width="5"
        height="16"
        rx="1"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <rect
        x="34"
        y="20"
        width="5"
        height="16"
        rx="1"
        strokeWidth="1.5"
        className={cn('fill-chart-2', outline)}
      />
      <rect x="5" y="37" width="38" height="5" rx="1.5" className="fill-foreground" />
    </>
  ),
}

type CategoryIllustrationProps = {
  category: SpaceCategory | 'all'
  className?: string
}

// Decorative: the category label always sits next to it.
export function CategoryIllustration({ category, className }: CategoryIllustrationProps) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={cn('size-12', className)}>
      {drawings[category]}
    </svg>
  )
}
