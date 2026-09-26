import { useEffect, useState } from 'react'
import { api } from './access'

/**
 * Load a resource from `api.*`. Refetches when deps change or the dummy store mutates.
 * Tomorrow the same hook hits the real HTTP API — no page changes needed.
 */
export function useApiQuery<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loader()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // Caller owns the dependency list for this query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    return api.crm.subscribe(() => {
      loader()
        .then(setData)
        .catch(setError)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
