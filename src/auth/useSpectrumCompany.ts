import { useEffect, useState } from 'react'
import type { SpectrumCompany } from '../api/authStore'
import { headOfficeNoOf, rememberCompany, resolveSpectrumCompany } from '../api/spectrumCompany'
import { useAuth } from './AuthContext'

/**
 * Companies from the Spectrum login, plus the one currently selected.
 * `enabled` is false for demo-account logins, which have no Spectrum token.
 */
export function useSpectrumCompany() {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<SpectrumCompany[]>([])
  const [companyNo, setCompanyNoState] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    resolveSpectrumCompany().then((resolved) => {
      if (cancelled) return
      setCompanies(resolved?.companies ?? [])
      setCompanyNoState(resolved?.companyNo ?? null)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  function setCompanyNo(next: number) {
    setCompanyNoState(next)
    rememberCompany(next)
  }

  // Head office of the selected company (fill values and the document store are per head office).
  const headOfficeNo = companyNo === null ? null : headOfficeNoOf(companies, companyNo)

  return { enabled: ready && companyNo !== null, ready, companies, companyNo, headOfficeNo, setCompanyNo }
}
