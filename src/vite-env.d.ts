/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SPECTRUM_API_URL?: string
  /** Spectrum ERP shell, whose login signs in to the CRM when it runs on its own. */
  readonly VITE_SPECTRUM_URL?: string
  readonly VITE_COOKIE_SECRET?: string
  /** Optional parent domain for sharing the CRM session cookie with same-site subdomain remotes. */
  readonly VITE_COOKIE_DOMAIN?: string
  /** Spectrum form numbers the document store files lead / opportunity attachments under. */
  readonly VITE_LEAD_FORM_NO?: string
  readonly VITE_OPPORTUNITY_FORM_NO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
