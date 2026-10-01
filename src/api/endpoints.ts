/** Single catalog of API paths. UI never inlines these strings. */
export const API_BASE = '/api/v1'

/** Spectrum backend paths, called through `http` (relative to spectrumOrigin()). */
export const spectrumEndpoints = {
  auth: {
    login: '/api/Auth/login',
  },
  /** Base for Save / Load Data / Search / Delete master routes (see masters.ts). */
  masters: '/api/master',
  users: {
    /** User search for owner / assignee pickers (see users.ts). */
    search: '/api/security/users',
  },
  /** Shared document store used by every form (see attachments.ts). */
  attachments: {
    /** GET ?transactionId=&formNo= (list) · POST [{fileName, companyNo, formNo}] (entry) · PUT multipart (file) */
    root: '/api/document-attachments',
    status: '/api/document-attachments/status',
    rename: '/api/document-attachments/rename',
    delete: '/api/document-attachments/delete',
    /** `${root}/{docNo}/download` */
    download: (docNo: number) => `/api/document-attachments/${docNo}/download`,
  },
  businessEntities: {
    /** Paged search used for the Business Entity field (see businessEntities.ts). */
    search: '/api/master/business-entities/search/business-entity-wise',
    /** Contact persons of one entity (see businessEntities.ts). */
    contactPersons: '/api/master/business-entities/contact-persons',
  },
  leads: {
    /** All lead form dropdowns in one call (see leadFormFillValues.ts). */
    fillValues: '/api/crm/leads/fill-values',
    save: '/api/crm/leads/save',
    convert: '/api/crm/leads/convert-to-opportunity',
    /** `${timeline}/{leadNo}` — paged (see timeline.ts). */
    timeline: '/api/crm/leads/timeline',
    search: '/api/crm/leads/search-data',
    loadData: '/api/crm/leads/load-data',
    delete: '/api/crm/leads/delete',
    saveActivity: '/api/crm/leads/save-activity-detail',
    deleteActivities: '/api/crm/leads/delete-activity-detail',
    saveNote: '/api/crm/leads/save-notes-detail',
    deleteNotes: '/api/crm/leads/delete-notes-detail',
  },
  opportunities: {
    /** All opportunity form dropdowns in one call (see opportunityFormFillValues.ts). */
    fillValues: '/api/crm/opportunities/fill-values',
    save: '/api/crm/opportunities/save',
    search: '/api/crm/opportunities/search-data',
    loadData: '/api/crm/opportunities/load-data',
    delete: '/api/crm/opportunities/delete',
    saveActivity: '/api/crm/opportunities/save-activity-detail',
    deleteActivities: '/api/crm/opportunities/delete-activity-detail',
    /** `${timeline}/{opportunityNo}` — paged (see timeline.ts). */
    timeline: '/api/crm/opportunities/timeline',
  },
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
