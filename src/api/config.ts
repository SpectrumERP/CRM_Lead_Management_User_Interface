/** Empty = in-app dummy API. Set VITE_API_URL to point at a real backend with the same paths. */
export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL
  return typeof raw === 'string' ? raw.replace(/\/+$/, '') : ''
}

export function usesRemoteApi() {
  return apiOrigin().length > 0
}

/** Same-origin Spectrum API path; the current environment's server routes it to its backend. */
export function spectrumOrigin(): string {
  const raw = import.meta.env.VITE_SPECTRUM_API_URL
  const value = typeof raw === 'string' ? raw : ''
  return value === 'off' ? '' : value.replace(/\/+$/, '')
}

export function usesSpectrumApi() {
  return import.meta.env.MODE === 'spectrum' && import.meta.env.VITE_SPECTRUM_API_URL !== 'off'
}
