/** Empty = in-app dummy API. Set VITE_API_URL to point at a real backend with the same paths. */
export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL
  return typeof raw === 'string' ? raw.replace(/\/+$/, '') : ''
}

export function usesRemoteApi() {
  return apiOrigin().length > 0
}
