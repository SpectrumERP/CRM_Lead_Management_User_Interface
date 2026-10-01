import { useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import type { Opportunity } from '../data/opportunities'
import type { Lead, LeadCurrency } from '../data/leads'
import type { BusinessEntity } from '../data/businessEntities'
import type { Contact } from '../data/contacts'
import type { Activity } from '../data/activities'
import type { Meeting } from '../data/meetings'
import type { CRMDocument } from '../data/documents'
import type { AuditEntry } from '../data/auditLog'
import { api } from '../api/crm'
import { patchNote as patchLocalNote, removeActivity as removeLocalActivity, removeNote as removeLocalNote } from '../api/db'
import {
  deleteServerLead,
  deleteServerLeadActivity,
  deleteServerLeadNote,
  isServerLeadId,
  saveServerLeadActivity,
  saveServerLeadNote,
  updateServerLead,
} from '../api/leadSync'
import {
  convertServerLead,
  deleteServerOpportunity,
  deleteServerOpportunityActivity,
  opportunityNoFromId,
  saveServerOpportunityActivity,
  updateServerOpportunity,
} from '../api/opportunitySync'
import type { CrmDb } from '../api/crm'
import type { CrmEmail, CrmNote } from './crmTypes'
import { useErrorHandler } from '../app/ErrorHandler'

export type { CrmEmail, CrmNote }

export interface CrmStore {
  leads: Lead[]
  entities: BusinessEntity[]
  contacts: Contact[]
  activities: Activity[]
  meetings: Meeting[]
  notes: CrmNote[]
  emails: CrmEmail[]
  documents: CRMDocument[]
  audit: AuditEntry[]
  addLead: (lead: Lead) => void
  patchLead: (id: string, patch: Partial<Lead>) => void
  removeLead: (id: string) => void
  addEntity: (entity: BusinessEntity) => void
  addContact: (contact: Contact) => void
  addActivity: (activity: Activity) => void
  addMeeting: (meeting: Meeting) => void
  addNote: (note: CrmNote) => void
  addEmail: (email: CrmEmail) => void
  addDocument: (doc: CRMDocument) => void
  patchActivity: (id: string, patch: Partial<Activity>) => void
  /** Resolves true once deleted (server records: after the API call and reload). */
  removeActivity: (id: string) => Promise<boolean>
  removeNote: (id: string) => Promise<boolean>
  /** Edit a note (server leads → save-notes-detail with its detail number). */
  patchNote: (id: string, patch: Partial<CrmNote>) => void
  patchMeeting: (id: string, patch: Partial<Meeting>) => void
  convertLead: (
    leadId: string,
    input: { dealValue: number; valueCurrency: LeadCurrency; closingDate: string },
  ) => Promise<Opportunity | undefined>
  addOpportunity: (opportunity: Opportunity) => void
  patchOpportunity: (id: string, patch: Partial<Opportunity>) => void
  removeOpportunity: (id: string) => void
}

const RAW_ACTIONS = {
  addLead: api.leads.create,
  patchLead: api.leads.update,
  removeLead: api.leads.remove,
  addEntity: api.entities.create,
  addContact: api.contacts.create,
  addActivity: api.activities.create,
  addMeeting: api.meetings.create,
  addNote: api.notes.create,
  addEmail: api.emails.create,
  addDocument: api.documents.create,
  patchActivity: api.activities.update,
  patchMeeting: api.meetings.update,
  convertLead: (leadId: string, input: { dealValue: number; valueCurrency: LeadCurrency; closingDate: string }) =>
    api.opportunities.convert({ leadId, ...input }),
  addOpportunity: api.opportunities.create,
  patchOpportunity: api.opportunities.update,
  removeOpportunity: api.opportunities.remove,
}

export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every((key) => Object.is(left[key], right[key]))
}

export function sameList<T>(a: T[], b: T[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function useCrmSelector<T>(
  selector: (state: CrmDb) => T,
  isEqual: (left: T, right: T) => boolean = Object.is,
): T {
  const cache = useRef<{ selected: T } | null>(null)

  const getSnapshot = () => {
    const selected = selector(api.crm.getState())
    const cached = cache.current
    if (cached && isEqual(cached.selected, selected)) return cached.selected
    cache.current = { selected }
    return selected
  }

  return useSyncExternalStore(api.crm.subscribe, getSnapshot, getSnapshot)
}

const NOOP_SUBSCRIBE = (_listener: () => void) => () => {}

export function useCrmSelectorWhen<T>(
  enabled: boolean,
  selector: (state: CrmDb) => T,
  fallback: T,
  isEqual: (left: T, right: T) => boolean = Object.is,
): T {
  const cache = useRef<{ selected: T } | null>(null)

  const subscribe = enabled ? api.crm.subscribe : NOOP_SUBSCRIBE

  const getSnapshot = () => {
    if (!enabled) return fallback
    const selected = selector(api.crm.getState())
    const cached = cache.current
    if (cached && isEqual(cached.selected, selected)) return cached.selected
    cache.current = { selected }
    return selected
  }

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useCrmActions() {
  const { run, runAsync } = useErrorHandler()
  return useMemo(
    () => ({
      addLead: (lead: Lead) => {
        run(() => RAW_ACTIONS.addLead(lead))
      },
      patchLead: (id: string, patch: Partial<Lead>) => {
        // Server leads are saved through /api/crm/leads/save, then reloaded into the store.
        const current = api.crm.getState().leads.find((lead) => lead.id === id)
        if (current?.spectrum) {
          void runAsync(() => updateServerLead(current, patch))
          return
        }
        run(() => RAW_ACTIONS.patchLead(id, patch))
      },
      removeLead: (id: string) => {
        const current = api.crm.getState().leads.find((lead) => lead.id === id)
        if (current?.spectrum) {
          void runAsync(() => deleteServerLead(current))
          return
        }
        run(() => RAW_ACTIONS.removeLead(id))
      },
      addEntity: (entity: BusinessEntity) => {
        run(() => RAW_ACTIONS.addEntity(entity))
      },
      addContact: (contact: Contact) => {
        run(() => RAW_ACTIONS.addContact(contact))
      },
      addActivity: (activity: Activity) => {
        // Server opportunity → /api/crm/opportunities/save-activity-detail.
        if (activity.opportunityId && opportunityNoFromId(activity.opportunityId)) {
          void runAsync(() => saveServerOpportunityActivity(activity))
          return
        }
        // Server lead → /api/crm/leads/save-activity-detail.
        if (isServerLeadId(activity.leadId)) {
          void runAsync(() => saveServerLeadActivity(activity))
          return
        }
        run(() => RAW_ACTIONS.addActivity(activity))
      },
      addMeeting: (meeting: Meeting) => {
        run(() => RAW_ACTIONS.addMeeting(meeting))
      },
      addNote: (note: CrmNote) => {
        if (isServerLeadId(note.relatedLeadId)) {
          void runAsync(() => saveServerLeadNote(note))
          return
        }
        run(() => RAW_ACTIONS.addNote(note))
      },
      addEmail: (email: CrmEmail) => {
        run(() => RAW_ACTIONS.addEmail(email))
      },
      addDocument: (doc: CRMDocument) => {
        run(() => RAW_ACTIONS.addDocument(doc))
      },
      patchActivity: (id: string, patch: Partial<Activity>) => {
        const current = api.crm.getState().activities.find((item) => item.id === id)
        if (current?.opportunityId && opportunityNoFromId(current.opportunityId)) {
          void runAsync(() => saveServerOpportunityActivity({ ...current, ...patch, id: current.id }))
          return
        }
        if (current && isServerLeadId(current.leadId)) {
          void runAsync(() => saveServerLeadActivity({ ...current, ...patch, id: current.id }))
          return
        }
        run(() => RAW_ACTIONS.patchActivity(id, patch))
      },
      removeActivity: async (id: string) => {
        const current = api.crm.getState().activities.find((item) => item.id === id)
        if (!current) return false
        // Server opportunity → /api/crm/opportunities/delete-activity-detail.
        if (current.id.startsWith('SOA-')) {
          return (await runAsync(async () => { await deleteServerOpportunityActivity(current); return true })) ?? false
        }
        // Server lead → /api/crm/leads/delete-activity-detail.
        if (current.id.startsWith('SA-') && isServerLeadId(current.leadId)) {
          return (await runAsync(async () => { await deleteServerLeadActivity(current); return true })) ?? false
        }
        run(() => removeLocalActivity(id))
        return true
      },
      patchNote: (id: string, patch: Partial<CrmNote>) => {
        const current = api.crm.getState().notes.find((item) => item.id === id)
        if (!current) return
        // Server note (SN-…) → save-notes-detail with its number (an update), then the lead reloads.
        if (current.id.startsWith('SN-') && isServerLeadId(current.relatedLeadId)) {
          void runAsync(() => saveServerLeadNote({ ...current, ...patch, id: current.id }))
          return
        }
        run(() => patchLocalNote(id, patch))
      },
      removeNote: async (id: string) => {
        const current = api.crm.getState().notes.find((item) => item.id === id)
        if (!current) return false
        // Server lead → /api/crm/leads/delete-notes-detail.
        if (current.id.startsWith('SN-') && isServerLeadId(current.relatedLeadId)) {
          return (await runAsync(async () => { await deleteServerLeadNote(current); return true })) ?? false
        }
        run(() => removeLocalNote(id))
        return true
      },
      patchMeeting: (id: string, patch: Partial<Meeting>) => {
        run(() => RAW_ACTIONS.patchMeeting(id, patch))
      },
      convertLead: async (
        leadId: string,
        input: { dealValue: number; valueCurrency: LeadCurrency; closingDate: string; currencyNo?: number },
      ) => {
        // Server lead → the opportunity is created on the server from the lead's details.
        if (isServerLeadId(leadId)) return runAsync(() => convertServerLead(leadId, input))
        return runAsync(() => RAW_ACTIONS.convertLead(leadId, input))
      },
      addOpportunity: (opportunity: Opportunity) => {
        run(() => RAW_ACTIONS.addOpportunity(opportunity))
      },
      patchOpportunity: (id: string, patch: Partial<Opportunity>) => {
        const current = api.crm.getState().opportunities.find((item) => item.id === id)
        if (current?.spectrum) {
          void runAsync(() => updateServerOpportunity(current, patch))
          return
        }
        run(() => RAW_ACTIONS.patchOpportunity(id, patch))
      },
      removeOpportunity: (id: string) => {
        const current = api.crm.getState().opportunities.find((item) => item.id === id)
        if (current?.spectrum) {
          void runAsync(() => deleteServerOpportunity(current))
          return
        }
        run(() => RAW_ACTIONS.removeOpportunity(id))
      },
    }),
    [run, runAsync],
  )
}

export function CrmStoreProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useCrmStore(): CrmStore {
  const actions = useCrmActions()
  const data = useCrmSelector(
    (state) => ({
      leads: state.leads,
      entities: state.entities,
      contacts: state.contacts,
      activities: state.activities,
      meetings: state.meetings,
      notes: state.notes,
      emails: state.emails,
      documents: state.documents,
      audit: state.audit,
    }),
    shallowEqual,
  )
  return useMemo<CrmStore>(() => ({ ...data, ...actions }), [data, actions])
}
