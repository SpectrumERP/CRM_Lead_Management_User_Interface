/** Which Spectrum company the user is working in — usable outside React (sync jobs, API helpers). */
import { loadAuth, type SpectrumCompany } from './authStore'

const STORAGE_KEY = 'fi-crm-company'

export function rememberedCompany(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function rememberCompany(companyNo: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(companyNo))
  } catch {
    // Storage blocked — selection just won't survive a reload.
  }
}

/**
 * Head office number of a company, from the login's company list. A company whose `HeadOfficeNo` is
 * missing or 0 is its own head office, so its own number is returned.
 */
export function headOfficeNoOf(companies: readonly SpectrumCompany[], companyNo: number): number {
  const company = companies.find((c) => c.CompanyNo === companyNo)
  return company?.HeadOfficeNo || companyNo
}

export interface ResolvedCompany {
  companies: SpectrumCompany[]
  companyNo: number
  /** Head office of the selected company — what fill-values APIs take as `companyNo`. */
  headOfficeNo: number
}

/** Remembered choice, else the last company logged into, else the first. Null for demo logins. */
export async function resolveSpectrumCompany(): Promise<ResolvedCompany | null> {
  const auth = await loadAuth()
  const list = auth?.companies ?? []
  const has = (no: number | null | undefined) => !!no && list.some((c) => c.CompanyNo === no)
  const remembered = rememberedCompany()
  const companyNo = has(remembered)
    ? remembered!
    : has(auth?.user.LastLoginCompanyNo)
      ? auth!.user.LastLoginCompanyNo!
      : list[0]?.CompanyNo
  if (!companyNo) return null
  return { companies: list, companyNo, headOfficeNo: headOfficeNoOf(list, companyNo) }
}
