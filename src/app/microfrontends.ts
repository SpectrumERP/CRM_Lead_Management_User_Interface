/**
 * The micro-frontend contract (microfrontends.json) for the CRM app: the shared-session names every
 * remote app reads, and where each remote opens. Remotes are separate repositories served under their
 * basePath on this origin; see docs/microfrontends.md.
 */
import manifest from '../../microfrontends.json'

export const sessionContract = manifest.session

export type RemoteName = (typeof manifest.remotes)[number]['name']

const env = import.meta.env as Record<string, string | undefined>

/**
 * URL a remote opens at, with a trailing slash: its basePath under this app's base, or — when its
 * `urlEnv` is set to an http(s) URL — that separate origin (which then cannot share the CRM sign-in).
 */
export function remoteAppUrl(name: RemoteName): string {
  const remote = manifest.remotes.find((r) => r.name === name)
  if (!remote) throw new Error(`Unknown micro-frontend "${name}"`)
  const configured = env[remote.urlEnv]?.trim()
  if (configured && /^https?:\/\//i.test(configured)) return configured.endsWith('/') ? configured : `${configured}/`
  // Inside the Spectrum ERP shell, the shell hosts every module at its own path on the shell's root.
  if (import.meta.env.VITE_CRM_ROUTE_BASE) return remote.basePath
  return `${import.meta.env.BASE_URL.replace(/\/+$/, '')}${remote.basePath}`
}
