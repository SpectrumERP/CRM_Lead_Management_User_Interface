import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (!headOfficeNo) {
      setValues(null)
      return
    }
    let cancelled = false
    getOpportunityFillValues(headOfficeNo)
      .then((next) => { if (!cancelled) setValues(next) })
      .catch(() => { if (!cancelled) setValues(null) })
    return () => { cancelled = true }
  }, [headOfficeNo])

  return { values, remote: headOfficeNo !== null }
}
