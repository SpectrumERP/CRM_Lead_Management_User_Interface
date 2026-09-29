import type { AuthUser } from '../auth/types'
import { jwtExpiry, saveAuth, type SpectrumCompany, type SpectrumUser } from './authStore'
import { spectrumEndpoints } from './endpoints'
import { http } from './http'

interface LoginResponse {
  token: string
  company: SpectrumCompany[]
  user: SpectrumUser
}

/** Keep only what the CRM uses — the full response is too large for cookies. */
function pickCompany(company: SpectrumCompany): SpectrumCompany {
  const { CompanyNo, CompanyCode, CompanyName, HeadOfficeNo, BaseCurrencyNo, BaseCurrencyName, GSTINNo } = company
  return { CompanyNo, CompanyCode, CompanyName, HeadOfficeNo, BaseCurrencyNo, BaseCurrencyName, GSTINNo }
}

function pickUser(user: SpectrumUser): SpectrumUser {
  const { LoginNo, LoginID, EmpNo, UserType, Email, PhoneNo, PrintingName, LastLoginCompanyNo, LastLoginModule } = user
  return { LoginNo, LoginID, EmpNo, UserType, Email, PhoneNo, PrintingName, LastLoginCompanyNo, LastLoginModule }
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : name.slice(0, 2)
  return letters.toUpperCase()
}

export function toAuthUser(user: SpectrumUser): AuthUser {
  const name = user.PrintingName?.trim() || user.LoginID
  return {
    id: `SPX-${user.LoginNo}`,
    name,
    email: user.Email ?? '',
    // Spectrum UserType "1" is the administrator account type.
    role: user.UserType === '1' ? 'Admin' : 'Sales Manager',
    jobTitle: user.UserType === '1' ? 'Administrator' : 'User',
    initials: initialsOf(name),
  }
}

/** Calls the Spectrum login API and stores the JWT, companies and user in the encrypted auth cookie. */
export async function spectrumLogin(loginId: string, password: string): Promise<AuthUser> {
  const response = await http.post<LoginResponse>(
    spectrumEndpoints.auth.login,
    { loginId, password },
    { skipAuth: true },
  )
  const expiresAt = jwtExpiry(response.token) ?? Date.now() + 8 * 60 * 60 * 1000
  const user = pickUser(response.user)
  await saveAuth({
    token: response.token,
    expiresAt,
    companies: (response.company ?? []).map(pickCompany),
    user,
  })
  return toAuthUser(user)
}
