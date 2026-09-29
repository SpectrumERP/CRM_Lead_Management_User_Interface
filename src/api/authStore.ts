import { cookieVault } from './cookieVault'

const COOKIE_NAME = 'fi-crm-auth'
const FALLBACK_TTL_SECONDS = 8 * 60 * 60

export interface SpectrumCompany {
  CompanyNo: number
  CompanyCode: string
  CompanyName: string
  HeadOfficeNo: number
  BaseCurrencyNo: number
  BaseCurrencyName: string
  GSTINNo: string | null
}

export interface SpectrumUser {
  LoginNo: number
  LoginID: string
  EmpNo: number | null
  UserType: string
  Email: string | null
  PhoneNo: string | null
  PrintingName: string | null
  LastLoginCompanyNo: number | null
  LastLoginModule: number | null
}

export interface AuthData {
  token: string
  /** Epoch ms, taken from the JWT `exp` claim. */
  expiresAt: number
  companies: SpectrumCompany[]
  user: SpectrumUser
}

let cached: AuthData | null = null
let loaded = false

/** Reads `exp` from a JWT without verifying it — the server verifies. */
export function jwtExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

function isExpired(data: AuthData) {
  return Date.now() >= data.expiresAt
}

export async function saveAuth(data: AuthData): Promise<void> {
  cached = data
  loaded = true
  const seconds = Math.min(FALLBACK_TTL_SECONDS, (data.expiresAt - Date.now()) / 1000)
  await cookieVault.set(COOKIE_NAME, data, seconds)
}

/** Decrypts the auth cookie once, then serves from memory. */
export async function loadAuth(): Promise<AuthData | null> {
  if (!loaded) {
    cached = await cookieVault.get<AuthData>(COOKIE_NAME)
    loaded = true
  }
  if (cached && isExpired(cached)) clearAuth()
  return cached
}

export async function getAuthToken(): Promise<string | null> {
  return (await loadAuth())?.token ?? null
}

export function clearAuth() {
  cached = null
  loaded = true
  cookieVault.remove(COOKIE_NAME)
}

/** Test-only: forget the in-memory copy so the next read goes back to the cookie. */
export function __resetAuthStoreForTests() {
  cached = null
  loaded = false
}
