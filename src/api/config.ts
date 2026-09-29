/** Empty = in-app dummy API. Set VITE_API_URL to point at a real backend with the same paths. */
export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL
  return typeof raw === 'string' ? raw.replace(/\/+$/, '') : ''
}

export function usesRemoteApi() {
  return apiOrigin().length > 0
}

const DEFAULT_SPECTRUM_URL = 'https://spectrumtasknplanner.steelmont.co.in:8085'

/** Spectrum backend used by `http` (real login + future APIs). Set VITE_SPECTRUM_API_URL to override; "off" disables it. */
export function spectrumOrigin(): string {
  const raw = import.meta.env.VITE_SPECTRUM_API_URL
  const value = typeof raw === 'string' && raw.length > 0 ? raw : DEFAULT_SPECTRUM_URL
  return value === 'off' ? '' : value.replace(/\/+$/, '')
}

export function usesSpectrumApi() {
  return spectrumOrigin().length > 0
}
