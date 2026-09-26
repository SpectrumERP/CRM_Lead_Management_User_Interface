/**
 * Public API access.
 * Import from `src/api` (auth) or `src/api/crm` (authenticated CRM).
 * Paths live in endpoints.ts; I/O goes through client.ts.
 */
import './routes/auth'

export { endpoints } from './endpoints'
export { client, dispatch } from './client'
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
