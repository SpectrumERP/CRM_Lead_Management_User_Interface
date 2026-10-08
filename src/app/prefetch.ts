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
  'business-entity-detail': () => import('../pages/BusinessEntityDetail'),
  contacts: () => import('../pages/ContactsList'),
  'create-contact': () => import('../pages/CreateContact'),
  'contact-detail': () => import('../pages/ContactDetail'),
  activities: () => import('../pages/Activities'),
  meetings: () => import('../pages/Meetings'),
  'search-results': () => import('../pages/SearchResults'),
  settings: () => import('../pages/Settings'),
  notifications: () => import('../pages/Notifications'),
  'audit-log': () => import('../pages/AuditLog'),
  'my-profile': () => import('../pages/UserProfile'),
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

const prerendered = new Set<string>()

/**
 * Warm another same-origin app (e.g. Task Management) before the user clicks into it: Chromium
 * prerenders it in the background (Speculation Rules), other browsers just prefetch the document.
 * The switch then opens already painted — no blank page or loader jump.
 */
export function prerenderApp(url: string) {
  if (prerendered.has(url) || typeof document === 'undefined') return
  prerendered.add(url)
  if (HTMLScriptElement.supports?.('speculationrules')) {
    const rules = document.createElement('script')
    rules.type = 'speculationrules'
    rules.textContent = JSON.stringify({ prerender: [{ urls: [url], eagerness: 'immediate' }] })
    document.head.appendChild(rules)
    return
  }
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  document.head.appendChild(link)
}
