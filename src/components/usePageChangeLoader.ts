import { useCallback, useEffect, useState } from 'react'

/**
 * Brief branded loader when a client-side page/filter change swaps the rows (same timing as Leads).
 * `run(fn)` shows the loader, applies the change, and hides it after `ms`.
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
