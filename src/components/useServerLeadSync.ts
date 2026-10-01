import { useCallback, useEffect, useState } from 'react'
import { toApiError } from '../api/errors'
import { syncServerLeads } from '../api/leadSync'
import { syncServerOpportunities } from '../api/opportunitySync'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'

/**
 * Spectrum login → run `syncFn` (server list → store) on mount and when the company changes.
 * `remote` tells the page to show server records only.
 */
export function useServerSync(syncFn: () => Promise<unknown>) {
  const company = useSpectrumCompany()
  const remote = company.enabled
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      await syncFn()
      setError(null)
      setSynced(true)
    } catch (err) {
      setError(toApiError(err).message)
    } finally {
      setSyncing(false)
    }
  }, [syncFn])

  useEffect(() => {
    if (remote) void sync()
  }, [remote, company.companyNo, sync])

  return {
    remote,
    /** True until the first sync finishes (show the loading state instead of "nothing here"). */
    loading: remote && !synced && !error,
    syncing,
    error,
    retry: sync,
  }
}

/** Leads from `/api/crm/leads/search-data`. */
export function useServerLeadSync() {
  return useServerSync(syncServerLeads)
}

/** Opportunities from `/api/crm/opportunities/search-data`. */
export function useServerOpportunitySync() {
  return useServerSync(syncServerOpportunities)
}
