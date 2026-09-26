import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { normalizeOrgName } from '../data/leads'
import { shallowEqual, useCrmSelector } from './CrmStoreContext'
import type { Lead } from '../data/leads'
import type { BusinessEntity } from '../data/businessEntities'
import type { Contact } from '../data/contacts'
import { matchAppPage, recordIdFromPath, type AppPage } from '../app/paths'

export type { AppPage }
export type QuickCreateKind = 'lead' | 'opportunity' | 'entity' | 'contact' | 'activity' | 'meeting' | 'note' | 'document'

export interface QuickCreatePrefill {
  leadId?: string
  leadName?: string
  contactId?: string
  contactName?: string
  entityId?: string
  entityName?: string
}

interface QuickCreateApi {
  open: (kind: QuickCreateKind) => void
  close: () => void
  activeKind: QuickCreateKind | null
  prefill: QuickCreatePrefill
  page: AppPage
}

const QuickCreateContext = createContext<QuickCreateApi | null>(null)

export function derivePrefill(
  page: AppPage,
  selectedLeadId: string,
  selectedEntityId: string,
  selectedContactId: string,
  store: { leads: Lead[]; entities: BusinessEntity[]; contacts: Contact[] },
): QuickCreatePrefill {
  if (page === 'lead-detail') {
    const lead = store.leads.find((l) => l.id === selectedLeadId)
    if (!lead) return {}
    const key = normalizeOrgName(lead.companyName)
    const entity = store.entities.find((e) => {
      const name = normalizeOrgName(e.name)
      return name === key || name.startsWith(key) || key.startsWith(name)
    })
    const contact = store.contacts.find((c) => c.name === lead.contactPerson && (!entity || c.businessEntityId === entity.id))
      ?? store.contacts.find((c) => c.name === lead.contactPerson)
    return {
      leadId: lead.id,
      leadName: lead.companyName,
      contactId: contact?.id,
      contactName: lead.contactPerson,
      entityId: entity?.id,
      entityName: entity?.name ?? lead.companyName,
    }
  }

  if (page === 'business-entity-detail') {
    const entity = store.entities.find((e) => e.id === selectedEntityId)
    if (!entity) return {}
    const primary = entity.contacts.find((c) => c.isPrimary) ?? entity.contacts[0]
    const contact = store.contacts.find((c) => c.businessEntityId === entity.id && c.isPrimary)
      ?? store.contacts.find((c) => c.businessEntityId === entity.id)
    const entityLeads = store.leads.filter((l) => normalizeOrgName(l.companyName) === normalizeOrgName(entity.name)
      || normalizeOrgName(entity.name).startsWith(normalizeOrgName(l.companyName))
      || normalizeOrgName(l.companyName).startsWith(normalizeOrgName(entity.name)))
    const singleLead = entityLeads.length === 1 ? entityLeads[0] : undefined
    return {
      entityId: entity.id,
      entityName: entity.name,
      contactId: contact?.id,
      contactName: contact?.name ?? primary?.name,
      leadId: singleLead?.id,
      leadName: singleLead?.companyName,
    }
  }

  if (page === 'contact-detail') {
    const contact = store.contacts.find((c) => c.id === selectedContactId)
    if (!contact) return {}
    const entityLeads = store.leads.filter((l) =>
      l.contactPerson === contact.name
      || normalizeOrgName(l.companyName) === normalizeOrgName(contact.businessEntityName),
    )
    const singleLead = entityLeads.length === 1 ? entityLeads[0] : undefined
    return {
      contactId: contact.id,
      contactName: contact.name,
      entityId: contact.businessEntityId,
      entityName: contact.businessEntityName,
      leadId: singleLead?.id,
      leadName: singleLead?.companyName,
    }
  }

  return {}
}

export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const params = useParams()
  const slices = useCrmSelector(
    (state) => ({
      leads: state.leads,
      entities: state.entities,
      contacts: state.contacts,
    }),
    shallowEqual,
  )
  const [activeKind, setActiveKind] = useState<QuickCreateKind | null>(null)
  const page = matchAppPage(pathname)
  const selectedId = params.id ?? recordIdFromPath(pathname) ?? ''
  const selectedLeadId = page === 'lead-detail' ? selectedId : ''
  const selectedEntityId = page === 'business-entity-detail' || page === 'edit-business-entity' ? selectedId : ''
  const selectedContactId = page === 'contact-detail' || page === 'edit-contact' ? selectedId : ''

  const prefill = useMemo(
    () => derivePrefill(page, selectedLeadId, selectedEntityId, selectedContactId, slices),
    [page, selectedLeadId, selectedEntityId, selectedContactId, slices],
  )

  const api = useMemo<QuickCreateApi>(() => ({
    open: (kind) => setActiveKind(kind),
    close: () => setActiveKind(null),
    activeKind,
    prefill,
    page,
  }), [activeKind, prefill, page])

  return (
    <QuickCreateContext.Provider value={api}>
      {children}
    </QuickCreateContext.Provider>
  )
}

export function useQuickCreate() {
  const ctx = useContext(QuickCreateContext)
  if (!ctx) throw new Error('useQuickCreate must be used within QuickCreateProvider')
  return ctx
}
