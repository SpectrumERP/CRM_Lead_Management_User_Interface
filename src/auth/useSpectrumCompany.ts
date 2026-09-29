import { useEffect, useState } from 'react'
import { loadAuth, type SpectrumCompany } from '../api/authStore'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'fi-crm-company'

function rememberedCompany(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function remember(companyNo: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(companyNo))
  } catch {
    // Storage blocked — selection just won't survive a reload.
  }
}

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
    loadAuth().then((auth) => {
      if (cancelled) return
      const list = auth?.companies ?? []
      const has = (no: number | null | undefined) => !!no && list.some((c) => c.CompanyNo === no)
      const remembered = rememberedCompany()
      const initial = has(remembered)
        ? remembered
        : has(auth?.user.LastLoginCompanyNo)
          ? auth!.user.LastLoginCompanyNo
          : (list[0]?.CompanyNo ?? null)
      setCompanies(list)
      setCompanyNoState(initial)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  function setCompanyNo(next: number) {
    setCompanyNoState(next)
    remember(next)
  }

  return { enabled: ready && companyNo !== null, ready, companies, companyNo, setCompanyNo }
}
