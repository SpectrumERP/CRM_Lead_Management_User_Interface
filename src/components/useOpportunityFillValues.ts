import { useCallback, useEffect, useState } from 'react'
import { toApiError } from '../api/errors'
import { getOpportunityFillValues, type OpportunityFormFillValues } from '../api/opportunityFormFillValues'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'

/**
 * Opportunity form dropdown values from `/api/crm/opportunities/fill-values?companyNo={HeadOfficeNo}`.
 * Null for demo logins, while loading, or after an error — callers then keep their in-app lists.
 */
export function useOpportunityFillValues() {
  const company = useSpectrumCompany()
  const headOfficeNo = company.enabled ? company.headOfficeNo : null
  const [values, setValues] = useState<OpportunityFormFillValues | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!headOfficeNo) {
      setValues(null)
      return
    }
    let cancelled = false
    setError(null)
    getOpportunityFillValues(headOfficeNo)
      .then((next) => { if (!cancelled) setValues(next) })
      .catch((err: unknown) => {
        if (cancelled) return
        setValues(null)
        setError(toApiError(err).message)
      })
    return () => { cancelled = true }
  }, [headOfficeNo, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  return { values, error, retry, remote: headOfficeNo !== null }
}
