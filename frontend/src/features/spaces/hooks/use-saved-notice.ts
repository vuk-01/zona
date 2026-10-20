import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import type { Space } from '../types'

type NoticeState = { notice: string }

const hasNotice = (state: unknown): state is NoticeState =>
  typeof state === 'object' && state !== null && 'notice' in state && typeof state.notice === 'string'

// What "My spaces" says after the form saved a space.
export function savedNotice(space: Pick<Space, 'name' | 'status'>, isNew: boolean): NoticeState {
  if (!isNew) return { notice: `Changes to ${space.name} were saved` }
  return {
    notice: space.status === 'listed' ? `${space.name} is published` : `${space.name} was saved as a draft`,
  }
}

// Reads the notice the form sent along (navigate(…, { state })) once. It is set after the first render,
// so the role="status" region already exists and screen readers announce it, and it is cleared from
// the history entry, so a reload does not show it again.
export function useSavedNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!hasNotice(location.state)) return
    setNotice(location.state.notice)
    void navigate(location.pathname, { replace: true, state: null })
  }, [location, navigate])

  return notice
}
