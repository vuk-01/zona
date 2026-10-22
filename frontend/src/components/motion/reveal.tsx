import { useEffect, useRef, useState, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  // Stagger in ms, so cards in one row come in one after another
  delay?: number
  className?: string
}

// Fades its content in, a little upward, the first time it scrolls into view (DESIGN.md "Motion"). The
// motion is in index.css ([data-reveal]) and only runs without prefers-reduced-motion; with reduced
// motion the content is simply there, so nothing can stay hidden.
export function Reveal({ children, delay = 0, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setShown(true)
        observer.disconnect()
      },
      { rootMargin: '0px 0px -32px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-reveal={shown ? 'shown' : 'hidden'}
      style={{ transitionDelay: `${delay}ms` }}
      className={className}
    >
      {children}
    </div>
  )
}
