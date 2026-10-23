import type { AppPage } from './paths'

const PAGE_LOADERS: Partial<Record<AppPage, () => Promise<unknown>>> = {
  dashboard: () => import('../pages/Dashboard'),
  leads: () => import('../pages/LeadsList'),
  opportunities: () => import('../pages/OpportunitiesList'),
  'opportunity-detail': () => import('../pages/OpportunityDetail'),
  'edit-opportunity': () => import('../pages/EditOpportunity'),
  'create-lead': () => import('../pages/CreateLead'),
  'edit-lead': () => import('../pages/CreateLead'),
  'lead-detail': () => import('../pages/LeadDetail'),
  'business-entities': () => import('../pages/BusinessEntitiesList'),
  'create-business-entity': () => import('../pages/CreateBusinessEntity'),
  'edit-business-entity': () => import('../pages/CreateBusinessEntity'),
  contacts: () => import('../pages/ContactsList'),
  'create-contact': () => import('../pages/CreateContact'),
  'contact-detail': () => import('../pages/ContactDetail'),
  activities: () => import('../pages/Activities'),
  meetings: () => import('../pages/Meetings'),
  'search-results': () => import('../pages/SearchResults'),
  settings: () => import('../pages/Settings'),
  notifications: () => import('../pages/Notifications'),
  'audit-log': () => import('../pages/AuditLog'),
}

const queued = new Set<AppPage>()

export function prefetchPage(page: AppPage) {
  const load = PAGE_LOADERS[page]
  if (!load || queued.has(page)) return
  queued.add(page)
  void load()
}

export function prefetchShellRoutes() {
  prefetchPage('leads')
  prefetchPage('opportunities')
  prefetchPage('business-entities')
  prefetchPage('contacts')
  prefetchPage('activities')
  prefetchPage('meetings')
}

export function onIdle(run: () => void) {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(run, { timeout: 1800 })
    return () => cancelIdleCallback(id)
  }
  const id = window.setTimeout(run, 280)
  return () => window.clearTimeout(id)
}
