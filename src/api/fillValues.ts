/** Shared pieces for the per-form fill-values APIs (lead, opportunity, …). */
import { fail, serverErrorMessage } from './errors'
import { CURRENCIES } from '../data/currencies'

/** Standard Spectrum response wrapper (same shape as the meeting fill-values API). */
export interface SpectrumResponse<T> {
  success: boolean
  message: string
  data: T
  error?: string | null
  errors?: { propertyName: string; errorMessage: string; errorCode: string }[] | null
  traceId?: string | null
}

/** Sales organization (lead and opportunity fill values). */
export interface SalesOrganizationOption {
  salesOrganizationNo: number
  salesOrganizationName: string
  code?: string
}

export interface CurrencyOption {
  currencyNo: number
  currencyCode: string
  currencyName: string
  symbol: string
  isDefault: boolean
}

/** CRM product master row (fill values). No unit is sent. */
export interface CrmProductOption {
  crmProductNo: number
  productName: string
  code: string
}

/** Owner / "Assigned To" / "Created By" pickers all use this list. */
export interface UserOption {
  loginNo: number
  loginId: string
  printingName: string
  email: string | null
}

/** Server message for a failed response: first field error, then `error`, then `message`. */
export function failureMessage(response: SpectrumResponse<unknown>) {
  return serverErrorMessage(response)
}

/** Throws the server's message unless the response succeeded. */
export function assertSuccess<T>(response: SpectrumResponse<T> | null | undefined): asserts response is SpectrumResponse<T> {
  if (!response?.success) fail('VALIDATION', response ? failureMessage(response) : undefined)
}

export function assertCompanyNo(companyNo: number) {
  if (!Number.isInteger(companyNo) || companyNo < 1) fail('VALIDATION', 'Company must be a positive number.')
}

/** The option marked `isDefault`, else the first one. */
export function defaultOption<T extends { isDefault?: boolean }>(items: readonly T[]): T | undefined {
  return items.find((item) => item.isDefault) ?? items[0]
}

/** Items with a `sequence` in display order. */
export function bySequence<T extends { sequence: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sequence - b.sequence)
}

/**
 * Best-effort ISO code for a server currency (their codes are `CM0001`-style), used only where the app
 * still stores ISO codes locally for display. Anything not on the app's currency list → INR.
 */
export function guessIsoCurrency(currency: Pick<CurrencyOption, 'currencyName' | 'symbol'>): string {
  // Exact ISO name or code first ("Singapore Dollar" → SGD, "Nepalese Rupee" → NPR), so amounts get
  // their own symbol; then loose matches for the free-text names the server also has.
  const name = (currency.currencyName ?? '').trim().toLowerCase()
  const exact = CURRENCIES.find((c) => c.name.toLowerCase() === name || c.code.toLowerCase() === name)
  if (exact) return exact.code
  const text = `${currency.currencyName} ${currency.symbol}`.toLowerCase()
  if (/₹|inr|rupee/.test(text)) return 'INR'
  if (/£|pound|gbp/.test(text)) return 'GBP'
  if (/€|euro/.test(text)) return 'EUR'
  if (/dirham|aed|د\.إ/.test(text)) return 'AED'
  if (/\$|dollar|usd/.test(text)) return 'USD'
  return 'INR'
}
