'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

const URL_EVENT = 'almanaque:urlchange'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(URL_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(URL_EVENT, onChange)
  }
}

/**
 * Query-string state that keeps the prerendered HTML intact: the server snapshot is the
 * empty query (default filters), so the static table renders without a Suspense fallback.
 */
export function useQueryState() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => '',
  )
  const params = useMemo(() => new URLSearchParams(search), [search])

  const setParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') next.delete(key)
      else next.set(key, value)
    }
    const query = next.toString()
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    window.dispatchEvent(new Event(URL_EVENT))
  }, [])

  return [params, setParams] as const
}
