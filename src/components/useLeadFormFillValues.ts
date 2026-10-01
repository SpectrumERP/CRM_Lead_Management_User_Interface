import { useEffect, useState } from 'react'
import { toApiError } from '../api/errors'
import { getLeadFillValues, type LeadFormFillValues } from '../api/leadFormFillValues'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'

/**
 * Lead form dropdown values from `/api/crm/leads/fill-values?companyNo={HeadOfficeNo}`.
 * `values` stays null for demo logins (no Spectrum company) and while loading or after an error,
 * so the form keeps its in-app lists in those cases.
 */
export function useLeadFormFillValues() {
  const company = useSpectrumCompany()
  const headOfficeNo = company.enabled ? company.headOfficeNo : null
  const [values, setValues] = useState<LeadFormFillValues | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!headOfficeNo) {
      setValues(null)
      return
    }
    let cancelled = false
    setError(null)
    getLeadFillValues(headOfficeNo)
      .then((next) => {
        if (!cancelled) setValues(next)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setValues(null)
        setError(toApiError(err).message)
      })
    return () => {
      cancelled = true
    }
  }, [headOfficeNo])

  return { values, error, remote: headOfficeNo !== null }
}
