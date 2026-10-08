import type { Activity } from '../../data/activities'
import type { Contact } from '../../data/contacts'
import type { CRMDocument } from '../../data/documents'
import type { Lead } from '../../data/leads'
import type { Meeting } from '../../data/meetings'
import type { CrmEmail, CrmNote } from '../../contexts/crmTypes'
import type { Opportunity } from '../../data/opportunities'
import type { ConvertOpportunityBody } from '../contracts'
import { bindSubscribe, register } from '../client'
import {
  addActivity,
  addContact,
  addDocument,
  addLead,
  addMeeting,
  addEmail,
  addNote,
  addOpportunity,
  convertLeadToOpportunity,
  getContact,
  getEntity,
  getLead,
  getOpportunity,
  getOpportunityMeta,
  getState,
  listActivities,
  listContacts,
  listDocuments,
  listEntities,
  listLeads,
  listMeetings,
  listEmails,
  listNotes,
  listOpportunities,
  patchActivity,
  patchLead,
  patchOpportunity,
  removeLead,
  removeOpportunity,
  patchMeeting,
  subscribe,
} from '../db'
import { endpoints } from '../endpoints'

register('GET', endpoints.crm.snapshot, () => getState())

register('GET', endpoints.leads.list, () => listLeads())
register('POST', endpoints.leads.create, ({ body }) => addLead(body as Lead))
register('GET', endpoints.leads.item, ({ params }) => getLead(params.id ?? ''))
register('PATCH', endpoints.leads.item, ({ params, body }) => {
  patchLead(params.id ?? '', body as Partial<Lead>)
})
register('DELETE', endpoints.leads.item, ({ params }) => {
  removeLead(params.id ?? '')
})

register('GET', endpoints.entities.list, () => listEntities())
register('GET', endpoints.entities.item, ({ params }) => getEntity(params.id ?? ''))

register('GET', endpoints.contacts.list, () => listContacts())
register('POST', endpoints.contacts.create, ({ body }) => addContact(body as Contact))
register('GET', endpoints.contacts.item, ({ params }) => getContact(params.id ?? ''))

register('GET', endpoints.activities.list, () => listActivities())
register('POST', endpoints.activities.create, ({ body }) => addActivity(body as Activity))
register('PATCH', endpoints.activities.item, ({ params, body }) => {
  patchActivity(params.id ?? '', body as Partial<Activity>)
})

register('GET', endpoints.meetings.list, () => listMeetings())
register('POST', endpoints.meetings.create, ({ body }) => addMeeting(body as Meeting))
register('PATCH', endpoints.meetings.item, ({ params, body }) => {
  patchMeeting(params.id ?? '', body as Partial<Meeting>)
})

register('GET', endpoints.notes.list, () => listNotes())
register('POST', endpoints.notes.create, ({ body }) => addNote(body as CrmNote))

register('GET', endpoints.emails.list, () => listEmails())
register('POST', endpoints.emails.create, ({ body }) => addEmail(body as CrmEmail))

register('GET', endpoints.documents.list, () => listDocuments())
register('POST', endpoints.documents.create, ({ body }) => addDocument(body as CRMDocument))

register('GET', endpoints.opportunities.meta, () => getOpportunityMeta())
register('POST', endpoints.opportunities.convert, ({ body }) => {
  const payload = body as ConvertOpportunityBody
  return convertLeadToOpportunity(payload.leadId, {
    dealValue: payload.dealValue,
    valueCurrency: payload.valueCurrency ?? 'INR',
    closingDate: payload.closingDate,
  })
})
register('GET', endpoints.opportunities.list, ({ query }) => listOpportunities(query))
register('POST', endpoints.opportunities.list, ({ body }) => addOpportunity(body as Opportunity))
register('GET', endpoints.opportunities.item, ({ params }) => getOpportunity(params.id ?? ''))
register('PATCH', endpoints.opportunities.item, ({ params, body }) => {
  return patchOpportunity(params.id ?? '', body as Partial<Opportunity>)
})
register('DELETE', endpoints.opportunities.item, ({ params }) => {
  removeOpportunity(params.id ?? '')
})

bindSubscribe(subscribe)
