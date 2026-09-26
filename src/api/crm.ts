import './routes/crm'

export { api } from './access'
export { endpoints } from './endpoints'
export { client } from './client'
export { useApiQuery } from './useApiQuery'
export type { CrmDb } from './db'
export type {
  ListResponse,
  OpportunityListQuery,
  OpportunityListResponse,
  OpportunityMeta,
  ConvertOpportunityBody,
} from './contracts'
