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
    /** Thumbnails for image attachments: POST [docNo…] → base64 images. */
    images: '/api/document-attachments/images',
    /** `${root}/{docNo}/download` */
    download: (docNo: number) => `/api/document-attachments/${docNo}/download`,
  },
  /**
   * Open / Save / Update / Delete rights per form for the signed-in user (see formRights.ts). The server
   * has one menu (no CRM-specific one); it covers Business Entity (1550) and its masters.
   */
  formRights: '/api/globaldata/forms/task-management-menu',
  businessEntities: {
    /** Paged search used for the Business Entity field and the list (see businessEntities.ts). */
    search: '/api/master/business-entities/search/business-entity-wise',
    /** List "Contact" views: one row per contact person. */
    searchContactWise: '/api/master/business-entities/search/contact-person-wise',
    /** List "Attachments" view: one row per attachment. */
    searchAttachmentWise: '/api/master/business-entities/search/attachment-wise',
    /** Contact persons of one entity (see businessEntities.ts). */
    contactPersons: '/api/master/business-entities/contact-persons',
    /** All form dropdowns in one call: types, countries, ports, location types, time zones, GSTIN types. */
    fillValues: '/api/master/business-entities/fill-values',
    /** `${loadData}/{businessEntityNo}?companyNo=` */
    loadData: '/api/master/business-entities/load-data',
    /** Insert (no number) or update. */
    save: '/api/master/business-entities/save',
    delete: '/api/master/business-entities/delete',
    deleteContactPerson: '/api/master/business-entities/delete-contact-person',
    /** Add / update one non-primary contact of a saved entity (the entity save carries only the primary). */
    saveContactPerson: '/api/master/business-entities/save-contact-person',
    /** GET ?BusinessEntityName= — existing names, for the "already exists?" hint while typing. */
    names: '/api/master/business-entities',
  },
  /** Geography lookups for location fields (see geo.ts). */
  geo: {
    statesByCountry: (countryNo: number) => `/api/master/states/by-country/${countryNo}`,
    citiesByState: (stateNo: number) => `/api/master/cities/by-state/${stateNo}`,
    /** GET ?KeywordSearch=&StateNo= — city search across states, each row with its state and country. */
    cityCombo: '/api/master/cities/fill-city-combo',
  },
  /** Business card reading (see businessCard.ts). */
  utility: {
    /** Card fields in one call — tried first. */
    businessCardScan: '/api/utility/google-vision/business-card/scan',
    /** Raw Gemini `generateContent` — the fallback. */
    visionAnnotate: '/api/utility/google-vision/images/annotate',
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
    /** Pending backend: POST { leadNo, leadStatusNo, remark? } (see statusChange.ts). */
    changeStatus: '/api/crm/leads/change-status',
    /** Pending backend: `${statusHistory}/{leadNo}` — paged, latest first. */
    statusHistory: '/api/crm/leads/status-history',
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
    saveNote: '/api/crm/opportunities/save-notes-detail',
    deleteNotes: '/api/crm/opportunities/delete-notes-detail',
    /** `${timeline}/{opportunityNo}` — paged (see timeline.ts). */
    timeline: '/api/crm/opportunities/timeline',
    /** Pending backend: POST { opportunityNo, opportunityStatusNo, remark?, orderValue?, orderDate? }. */
    changeStatus: '/api/crm/opportunities/change-status',
    /** Pending backend: `${statusHistory}/{opportunityNo}` — paged, latest first. */
    statusHistory: '/api/crm/opportunities/status-history',
  },
  /** Sales dashboard figures, all GET with `CompanyNo` (see dashboard.ts). */
  dashboard: {
    openActivities: '/api/crm/dashboard/open-activities',
    leadPipeline: '/api/crm/dashboard/lead-pipeline',
    opportunityPipeline: '/api/crm/dashboard/opportunity-pipeline',
    leadsAttention: '/api/crm/dashboard/leads-attention',
    opportunitiesAttention: '/api/crm/dashboard/opportunities-attention',
    expectedClosures: '/api/crm/dashboard/expected-closures',
    monthlySalesSummary: '/api/crm/dashboard/monthly-sales-summary',
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
