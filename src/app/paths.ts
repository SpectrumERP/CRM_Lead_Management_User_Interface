import { remoteAppUrl } from './microfrontends'

export type AppPage =
  | 'dashboard'
  | 'business-entities'
  | 'contacts'
  | 'leads'
  | 'opportunities'
  | 'create-lead'
  | 'edit-lead'
  | 'lead-detail'
  | 'opportunity-detail'
  | 'edit-opportunity'
  | 'create-opportunity'
  | 'activities'
  | 'meetings'
  | 'create-business-entity'
  | 'edit-business-entity'
  | 'business-entity-detail'
  | 'create-contact'
  | 'edit-contact'
  | 'contact-detail'
  | 'search-results'
  | 'settings'
  | 'notifications'
  | 'audit-log'
  | 'my-profile'
  | 'login'
  | 'forbidden'

/** When embedded in Spectrum ERP, set VITE_CRM_ROUTE_BASE=/crm (standalone stays empty). */
const ROUTE_BASE = String(import.meta.env.VITE_CRM_ROUTE_BASE ?? '')
  .trim()
  .replace(/\/+$/, '')

function withBase(path: string) {
  if (!ROUTE_BASE) return path
  if (path === '/') return `${ROUTE_BASE}/`
  return `${ROUTE_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

function stripBase(pathname: string) {
  if (!ROUTE_BASE) return pathname
  if (pathname === ROUTE_BASE || pathname === `${ROUTE_BASE}/`) return '/'
  if (pathname.startsWith(`${ROUTE_BASE}/`)) {
    const rest = pathname.slice(ROUTE_BASE.length)
    return rest || '/'
  }
  return pathname
}

/**
 * Task Management is a separate app (a micro-frontend, see microfrontends.json), opened with a full page
 * load: on the same origin under its basePath (not a CRM route), or at `VITE_TASK_APP_URL` when it runs on
 * its own. It shares the CRM sign-in: its login sends users here with `?next=<task URL>` to come back.
 */
export const taskAppUrl = remoteAppUrl('task')

/** A `next` value inside the Task app (never another site), else null. */
export function taskAppReturnPath(next: string | null | undefined): string | null {
  if (!next) return null
  const root = taskAppUrl.replace(/\/$/, '')
  // Task app on its own origin: only URLs under that exact address.
  if (/^https?:\/\//i.test(taskAppUrl)) return next === root || next.startsWith(taskAppUrl) ? next : null
  if (/[\\]|\/\/|^[a-z][a-z0-9+.-]*:/i.test(next)) return null
  return next === root || next.startsWith(taskAppUrl) ? next : null
}

export const paths = {
  dashboard: withBase('/'),
  entities: withBase('/entities'),
  entityNew: withBase('/entities/new'),
  entity: (id: string) => withBase(`/entities/${id}`),
  entityEdit: (id: string) => withBase(`/entities/${id}/edit`),
  contacts: withBase('/contacts'),
  contactNew: withBase('/contacts/new'),
  contact: (id: string) => withBase(`/contacts/${id}`),
  contactEdit: (id: string) => withBase(`/contacts/${id}/edit`),
  leads: withBase('/leads'),
  opportunities: withBase('/opportunities'),
  opportunityNew: withBase('/opportunities/new'),
  opportunity: (id: string) => withBase(`/opportunities/${id}`),
  opportunityEdit: (id: string) => withBase(`/opportunities/${id}/edit`),
  leadNew: withBase('/leads/new'),
  lead: (id: string) => withBase(`/leads/${id}`),
  leadEdit: (id: string) => withBase(`/leads/${id}/edit`),
  activities: withBase('/activities'),
  meetings: withBase('/meetings'),
  search: (q = '') =>
    q
      ? `${withBase('/search')}?q=${encodeURIComponent(q)}`
      : withBase('/search'),
  settings: withBase('/settings'),
  notifications: withBase('/notifications'),
  auditLog: withBase('/audit-log'),
  profile: withBase('/profile'),
  forbidden: withBase('/forbidden'),
} as const

export const navPaths: Record<
  | 'dashboard'
  | 'business-entities'
  | 'contacts'
  | 'leads'
  | 'opportunities'
  | 'activities'
  | 'meetings'
  | 'settings'
  | 'audit-log'
  | 'notifications'
  | 'my-profile',
  string
> = {
  dashboard: paths.dashboard,
  'business-entities': paths.entities,
  contacts: paths.contacts,
  leads: paths.leads,
  opportunities: paths.opportunities,
  activities: paths.activities,
  meetings: paths.meetings,
  settings: paths.settings,
  'audit-log': paths.auditLog,
  notifications: paths.notifications,
  'my-profile': paths.profile,
}

function normalizePath(pathname: string) {
  const trimmed = stripBase(pathname).replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function matchAppPage(pathname: string): AppPage {
  const path = normalizePath(pathname)
  if (path === '/') return 'dashboard'
  if (path === '/entities') return 'business-entities'
  if (path === '/entities/new') return 'create-business-entity'
  if (/^\/entities\/[^/]+\/edit$/.test(path)) return 'edit-business-entity'
  if (/^\/entities\/[^/]+$/.test(path)) return 'business-entity-detail'
  if (path === '/contacts') return 'contacts'
  if (path === '/contacts/new') return 'create-contact'
  if (/^\/contacts\/[^/]+\/edit$/.test(path)) return 'edit-contact'
  if (/^\/contacts\/[^/]+$/.test(path)) return 'contact-detail'
  if (path === '/leads') return 'leads'
  if (path === '/opportunities') return 'opportunities'
  if (path === '/opportunities/new') return 'create-opportunity'
  if (/^\/opportunities\/[^/]+\/edit$/.test(path)) return 'edit-opportunity'
  if (/^\/opportunities\/[^/]+$/.test(path)) return 'opportunity-detail'
  if (path === '/leads/new') return 'create-lead'
  if (/^\/leads\/[^/]+\/edit$/.test(path)) return 'edit-lead'
  if (/^\/leads\/[^/]+$/.test(path)) return 'lead-detail'
  if (path === '/activities') return 'activities'
  if (path === '/meetings') return 'meetings'
  if (path === '/search') return 'search-results'
  if (path === '/settings') return 'settings'
  if (path === '/notifications') return 'notifications'
  if (path === '/audit-log') return 'audit-log'
  if (path === '/profile') return 'my-profile'
  if (path === '/login') return 'login'
  if (path === '/forbidden') return 'forbidden'
  return 'dashboard'
}

export function recordIdFromPath(pathname: string): string | undefined {
  const path = normalizePath(pathname)
  const match = path.match(/^\/(leads|entities|contacts|opportunities)\/([^/]+)(?:\/edit)?$/)
  if (!match) return undefined
  if (match[2] === 'new') return undefined
  return match[2]
}
