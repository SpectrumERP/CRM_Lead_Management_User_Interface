/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SPECTRUM_API_URL?: string
  readonly VITE_COOKIE_SECRET?: string
  /** Spectrum form numbers the document store files lead / opportunity attachments under. */
  readonly VITE_LEAD_FORM_NO?: string
  readonly VITE_OPPORTUNITY_FORM_NO?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
