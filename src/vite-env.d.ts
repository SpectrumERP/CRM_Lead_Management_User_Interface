/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SPECTRUM_API_URL?: string
  /** Spectrum ERP shell, whose login signs in to the CRM when it runs on its own. */
  readonly VITE_SPECTRUM_URL?: string
  readonly VITE_COOKIE_SECRET?: string
  /** Spectrum form numbers the document store files lead / opportunity attachments under. */
  readonly VITE_LEAD_FORM_NO?: string
  readonly VITE_OPPORTUNITY_FORM_NO?: string
  /** Task Management URL when it runs on its own origin (e.g. `http://localhost:5174/` locally); default: `/task/` here. */
  readonly VITE_TASK_APP_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
