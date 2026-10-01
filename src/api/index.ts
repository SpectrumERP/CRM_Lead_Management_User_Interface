/**
 * Public API access.
 * Import from `src/api` (auth) or `src/api/crm` (authenticated CRM).
 * Paths live in endpoints.ts; I/O goes through client.ts.
 */
import './routes/auth'

export { endpoints } from './endpoints'
export { client, dispatch } from './client'
export { http } from './http'
export type { HttpRequestConfig, HttpResponse } from './http'
export { loadAuth, getAuthToken } from './authStore'
export { masterApis, createMasterApi } from './masters'
export { defaultOption, bySequence } from './fillValues'
export { searchBusinessEntities, businessEntityLocation } from './businessEntities'
export type { BusinessEntityRow, BusinessEntityPage } from './businessEntities'
export type { SpectrumResponse, CurrencyOption, UserOption } from './fillValues'
export { fetchLeadFormFillValues } from './leadFormFillValues'
export type { LeadFormFillValues } from './leadFormFillValues'
export { fetchOpportunityFormFillValues } from './opportunityFormFillValues'
export type { OpportunityFormFillValues } from './opportunityFormFillValues'
export type { MasterApi, MasterKey, MasterRow, MasterDetail, MasterSaveInput } from './masters'
export type { AuthData, SpectrumCompany, SpectrumUser } from './authStore'
export { api } from './access'
export { useApiQuery } from './useApiQuery'
export type {
  ListResponse,
  OpportunityListQuery,
  OpportunityListResponse,
  OpportunityMeta,
  ConvertOpportunityBody,
} from './contracts'
export { ApiError, isApiError, isApiErrorCode, toApiError, fromHttpStatus, errorFromResponse, safeUserMessage } from './errors'
export type { ApiErrorCode } from './errors'
export { resolveError, isHandledError } from './errorPolicy'
export type { CrmDb } from './db'
