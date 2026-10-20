import { useEffect, useRef } from 'react'

type PageTitleProps = {
  children: string
}

// The page's single h1 and the browser tab title ("My bookings · Zona"). The h1 takes focus when
// the page opens, so after a navigation (a nav link, the mode switch) keyboard and screen-reader
// users start on the new page instead of at <body>.
export function PageTitle({ children }: PageTitleProps) {
  const ref = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <>
      <title>{`${children} · Zona`}</title>
      <h1 ref={ref} tabIndex={-1} className="text-2xl font-semibold outline-none md:text-3xl">
        {children}
      </h1>
    </>
  )
}
