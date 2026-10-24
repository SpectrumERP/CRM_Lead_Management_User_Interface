import { useCallback, useEffect, useState } from 'react'

/**
 * A short busy window after a client-side page/filter change (same timing as Leads): `run(fn)` applies the change
 * and marks the pager busy for `ms`, so a burst of clicks lands once. The new rows show at once (no cover over them).
 */
export function usePageChangeLoader(ms = 380) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!busy) return
    const timer = window.setTimeout(() => setBusy(false), ms)
    return () => window.clearTimeout(timer)
  }, [busy, ms])

  const run = useCallback((apply: () => void) => {
    setBusy(true)
    apply()
  }, [])

  return { busy, run }
}
