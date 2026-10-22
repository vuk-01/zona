import { useLayoutEffect, useState } from 'react'

export type IndicatorBox = { x: number; y: number; width: number; height: number }

const sameBox = (a: IndicatorBox | null, b: IndicatorBox | null) =>
  a === b ||
  (a !== null && b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height)

// Where the selected item (the first match of `selector`) sits inside a list, for an indicator that slides
// to it: the category selection box, the bookings tab underline. Pass the list element from a callback
// ref (`ref={setList}`), so a list that appears later (after loading) is measured too. The list must be
// the items' offset parent (`relative`, with no positioned element in between). Measured before paint,
// so the indicator starts in place, and again when the list resizes (fonts loading, wrapping, a wider
// window, a count that changes).
export function useActiveIndicator(list: HTMLElement | null, selector: string, selected: unknown) {
  const [box, setBox] = useState<IndicatorBox | null>(null)

  useLayoutEffect(() => {
    if (!list) return
    const measure = () => {
      const active = list.querySelector<HTMLElement>(selector)
      const next = active
        ? {
            x: active.offsetLeft,
            y: active.offsetTop,
            width: active.offsetWidth,
            height: active.offsetHeight,
          }
        : null
      setBox((prev) => (sameBox(prev, next) ? prev : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [list, selector, selected])

  return box
}
