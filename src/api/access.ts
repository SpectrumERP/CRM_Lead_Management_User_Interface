import type { Activity } from '../data/activities'
import type { BusinessEntity } from '../data/businessEntities'
import type { Contact } from '../data/contacts'
import type { CRMDocument } from '../data/documents'
import type { Lead, LeadCurrency } from '../data/leads'
import type { Meeting } from '../data/meetings'
import type { Opportunity } from '../data/opportunities'
import type { AuthUser } from '../auth/types'
import type { CrmEmail, CrmNote } from '../contexts/crmTypes'
import type {
  ConvertOpportunityBody,
  ListResponse,
  OpportunityListQuery,
  OpportunityListResponse,
  OpportunityMeta,
} from './contracts'
import type { CrmDb } from './db'
import { client } from './client'
import { endpoints } from './endpoints'
import { withQuery } from './query'

/**
 * Screens call this object — never raw paths or db.
 * Dummy handlers today; set VITE_API_URL and the same methods hit the real API.
 */
export const api = {
  auth: {
    login: (email: string, password: string) =>
      client.post<AuthUser>(endpoints.auth.login, { email, password }),
    logout: () => client.postSync<void>(endpoints.auth.logout),
    me: () => client.get<AuthUser | null>(endpoints.auth.me),
  },
  crm: {
    getState: () => client.getSync<CrmDb>(endpoints.crm.snapshot),
    snapshot: () => client.get<CrmDb>(endpoints.crm.snapshot),
    subscribe: (listener: () => void) => client.subscribe(listener),
  },
  leads: {
    list: () => client.get<ListResponse<Lead>>(endpoints.leads.list),
    get: (id: string) => client.get<Lead>(endpoints.leads.byId(id)),
    create: (lead: Lead) => client.postSync<void>(endpoints.leads.create, lead),
    update: (id: string, patch: Partial<Lead>) =>
      client.patchSync<void>(endpoints.leads.byId(id), patch),
    remove: (id: string) => client.deleteSync<void>(endpoints.leads.byId(id)),
  },
  entities: {
    list: () => client.get<ListResponse<BusinessEntity>>(endpoints.entities.list),
    get: (id: string) => client.get<BusinessEntity>(endpoints.entities.byId(id)),
    create: (entity: BusinessEntity) => client.postSync<void>(endpoints.entities.create, entity),
  },
  contacts: {
    list: () => client.get<ListResponse<Contact>>(endpoints.contacts.list),
    get: (id: string) => client.get<Contact>(endpoints.contacts.byId(id)),
    create: (contact: Contact) => client.postSync<void>(endpoints.contacts.create, contact),
  },
  activities: {
    list: () => client.get<ListResponse<Activity>>(endpoints.activities.list),
    create: (activity: Activity) => client.postSync<void>(endpoints.activities.create, activity),
    update: (id: string, patch: Partial<Activity>) =>
      client.patchSync<void>(endpoints.activities.byId(id), patch),
  },
  meetings: {
    list: () => client.get<ListResponse<Meeting>>(endpoints.meetings.list),
    create: (meeting: Meeting) => client.postSync<void>(endpoints.meetings.create, meeting),
    update: (id: string, patch: Partial<Meeting>) =>
      client.patchSync<void>(endpoints.meetings.byId(id), patch),
  },
  notes: {
    list: () => client.get<ListResponse<CrmNote>>(endpoints.notes.list),
    create: (note: CrmNote) => client.postSync<void>(endpoints.notes.create, note),
  },
  emails: {
    list: () => client.get<ListResponse<CrmEmail>>(endpoints.emails.list),
    create: (email: CrmEmail) => client.postSync<void>(endpoints.emails.create, email),
  },
  documents: {
    list: () => client.get<ListResponse<CRMDocument>>(endpoints.documents.list),
    create: (doc: CRMDocument) => client.postSync<void>(endpoints.documents.create, doc),
  },
  opportunities: {
    list: (query: OpportunityListQuery = {}) =>
      client.get<OpportunityListResponse>(
        withQuery(endpoints.opportunities.list, {
          q: query.q,
          stages: query.stages,
          leadId: query.leadId,
          source: query.source,
          page: query.page,
          pageSize: query.pageSize,
        }),
      ),
    get: (id: string) => client.get<Opportunity>(endpoints.opportunities.byId(id)),
    meta: () => client.get<OpportunityMeta>(endpoints.opportunities.meta),
    convert: (input: ConvertOpportunityBody) =>
      client.post<Opportunity>(endpoints.opportunities.convert, input),
    create: (opportunity: Opportunity) =>
      client.postSync<Opportunity>(endpoints.opportunities.list, opportunity),
    update: (id: string, patch: Partial<Opportunity>) =>
      client.patchSync<void>(endpoints.opportunities.byId(id), patch),
    remove: (id: string) => client.deleteSync<void>(endpoints.opportunities.byId(id)),
  },
}

export type { ConvertOpportunityBody, LeadCurrency }
