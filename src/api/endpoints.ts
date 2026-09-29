/** Single catalog of API paths. UI never inlines these strings. */
export const API_BASE = '/api/v1'

/** Spectrum backend paths, called through `http` (relative to spectrumOrigin()). */
export const spectrumEndpoints = {
  auth: {
    login: '/api/Auth/login',
  },
  /** Base for Save / Load Data / Search / Delete master routes (see masters.ts). */
  masters: '/api/master',
}

export const endpoints = {
  auth: {
    login: `${API_BASE}/auth/login`,
    logout: `${API_BASE}/auth/logout`,
    me: `${API_BASE}/auth/me`,
  },
  crm: {
    snapshot: `${API_BASE}/crm`,
  },
  leads: {
    list: `${API_BASE}/leads`,
    create: `${API_BASE}/leads`,
    item: `${API_BASE}/leads/:id`,
    byId: (id: string) => `${API_BASE}/leads/${encodeURIComponent(id)}`,
  },
  entities: {
    list: `${API_BASE}/entities`,
    create: `${API_BASE}/entities`,
    item: `${API_BASE}/entities/:id`,
    byId: (id: string) => `${API_BASE}/entities/${encodeURIComponent(id)}`,
  },
  contacts: {
    list: `${API_BASE}/contacts`,
    create: `${API_BASE}/contacts`,
    item: `${API_BASE}/contacts/:id`,
    byId: (id: string) => `${API_BASE}/contacts/${encodeURIComponent(id)}`,
  },
  activities: {
    list: `${API_BASE}/activities`,
    create: `${API_BASE}/activities`,
    item: `${API_BASE}/activities/:id`,
    byId: (id: string) => `${API_BASE}/activities/${encodeURIComponent(id)}`,
  },
  meetings: {
    list: `${API_BASE}/meetings`,
    create: `${API_BASE}/meetings`,
    item: `${API_BASE}/meetings/:id`,
    byId: (id: string) => `${API_BASE}/meetings/${encodeURIComponent(id)}`,
  },
  notes: {
    list: `${API_BASE}/notes`,
    create: `${API_BASE}/notes`,
  },
  emails: {
    list: `${API_BASE}/emails`,
    create: `${API_BASE}/emails`,
  },
  documents: {
    list: `${API_BASE}/documents`,
    create: `${API_BASE}/documents`,
  },
  opportunities: {
    list: `${API_BASE}/opportunities`,
    meta: `${API_BASE}/opportunities/meta`,
    convert: `${API_BASE}/opportunities/convert`,
    item: `${API_BASE}/opportunities/:id`,
    byId: (id: string) => `${API_BASE}/opportunities/${encodeURIComponent(id)}`,
  },
}

export type EndpointPath = string
