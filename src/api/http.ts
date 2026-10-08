/**
 * Shared HTTP client for the Spectrum backend, with axios-style interceptors.
 * Every real API call should go through `http` so auth headers and error mapping stay in one place.
 *
 *   http.interceptors.request.use((config) => ({ ...config, headers: { ...config.headers, 'X-Foo': '1' } }))
 *   http.interceptors.response.use((response) => response, (error) => { throw error })
 */
import { getAuthToken } from './authStore'
import { getSessionSync } from './session'
import { isSessionEnded, notifySessionExpired } from './sessionExpiry'
import { spectrumOrigin } from './config'
import { asTransportError, errorFromResponse, isApiError, serverErrorMessage, unauthenticated, type ApiError } from './errors'

export type HttpVerb = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HttpRequestConfig {
  method: HttpVerb
  /** Path relative to the Spectrum origin, e.g. `/api/Auth/login`. */
  url: string
  headers: Record<string, string>
  body?: unknown
  /** Skip the Authorization header (login, public endpoints). */
  skipAuth?: boolean
  signal?: AbortSignal
  /** `blob` for file downloads; default parses JSON (falling back to text). */
  responseType?: 'json' | 'blob'
}

export interface HttpResponse<T> {
  data: T
  status: number
  headers: Headers
  config: HttpRequestConfig
}

type RequestInterceptor = (config: HttpRequestConfig) => HttpRequestConfig | Promise<HttpRequestConfig>
type ResponseInterceptor = (response: HttpResponse<unknown>) => HttpResponse<unknown> | Promise<HttpResponse<unknown>>
type ErrorInterceptor = (error: ApiError, config: HttpRequestConfig) => unknown

type RequestOptions = Partial<Pick<HttpRequestConfig, 'headers' | 'skipAuth' | 'signal' | 'responseType'>>

const requestInterceptors: RequestInterceptor[] = []
const responseInterceptors: { onFulfilled?: ResponseInterceptor; onRejected?: ErrorInterceptor }[] = []

function eject<T>(list: T[], item: T) {
  return () => {
    const index = list.indexOf(item)
    if (index >= 0) list.splice(index, 1)
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function send<T>(initial: HttpRequestConfig): Promise<HttpResponse<T>> {
  let config = initial
  for (const interceptor of requestInterceptors) config = await interceptor(config)

  try {
    let response: HttpResponse<unknown>
    try {
      const raw = await fetch(`${spectrumOrigin()}${config.url}`, {
        method: config.method,
        headers: config.headers,
        // FormData goes as-is so the browser sets the multipart boundary.
        body: config.body === undefined ? undefined : config.body instanceof FormData ? config.body : JSON.stringify(config.body),
        signal: config.signal,
      })
      const data = config.responseType === 'blob' && raw.ok ? await raw.blob() : await parseBody(raw)
      if (!raw.ok) {
        // The server's own text (e.g. "The length of 'Product Name' must be 50 characters or fewer…").
        errorFromResponse(raw.status, { message: serverErrorMessage(data) })
      }
      response = { data, status: raw.status, headers: raw.headers, config }
    } catch (error) {
      if (isApiError(error)) throw error
      asTransportError(error)
    }
    for (const { onFulfilled } of responseInterceptors) {
      if (onFulfilled) response = await onFulfilled(response)
    }
    return response as HttpResponse<T>
  } catch (error) {
    let current: unknown = error
    for (const { onRejected } of responseInterceptors) {
      if (!onRejected || !isApiError(current)) continue
      try {
        return (await onRejected(current, config)) as HttpResponse<T>
      } catch (next) {
        current = next
      }
    }
    throw current
  }
}

/**
 * One request per GET at a time: a GET for the same URL while one is already on its way joins it
 * instead of calling the API again (React StrictMode effects, two panels loading the same list, a
 * page and its hook asking at once). Followers get their own copy of the data. A request with its own
 * abort signal is never shared; once a request settles the next GET calls the server again (refresh).
 */
const inFlightGets = new Map<string, Promise<HttpResponse<unknown>>>()

function copyOf<T>(data: T): T {
  if (data === null || typeof data !== 'object' || data instanceof Blob) return data
  try {
    return structuredClone(data)
  } catch {
    return data
  }
}

/** Dev only: flag a GET that reaches the network again within a few seconds (a likely double load). */
const lastGetAt = new Map<string, number>()
function warnIfRepeated(url: string) {
  if (!import.meta.env.DEV) return
  const now = Date.now()
  const before = lastGetAt.get(url)
  lastGetAt.set(url, now)
  if (before !== undefined && now - before < 3000) {
    console.warn(`[duplicate API] GET ${url} again after ${now - before} ms`, new Error('called from').stack)
  }
}

async function sharedGet<T>(config: HttpRequestConfig): Promise<T> {
  if (config.signal) return (await send<T>(config)).data
  const key = `${config.responseType ?? 'json'} ${config.skipAuth ? 'anon' : 'auth'} ${config.url}`
  const pending = inFlightGets.get(key)
  if (pending) return copyOf((await pending).data as T)
  warnIfRepeated(config.url)
  const request = send<unknown>(config).finally(() => inFlightGets.delete(key))
  inFlightGets.set(key, request)
  return (await request).data as T
}

function build(method: HttpVerb, url: string, body: unknown, options: RequestOptions = {}): HttpRequestConfig {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'
  return { method, url, headers, body, skipAuth: options.skipAuth, signal: options.signal, responseType: options.responseType }
}

export const http = {
  interceptors: {
    request: {
      use(interceptor: RequestInterceptor) {
        requestInterceptors.push(interceptor)
        return eject(requestInterceptors, interceptor)
      },
    },
    response: {
      use(onFulfilled?: ResponseInterceptor, onRejected?: ErrorInterceptor) {
        const entry = { onFulfilled, onRejected }
        responseInterceptors.push(entry)
        return eject(responseInterceptors, entry)
      },
    },
  },
  request<T>(config: HttpRequestConfig) {
    return send<T>(config)
  },
  async get<T>(url: string, options?: RequestOptions): Promise<T> {
    return sharedGet<T>(build('GET', url, undefined, options))
  },
  async post<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return (await send<T>(build('POST', url, body, options))).data
  },
  async put<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return (await send<T>(build('PUT', url, body, options))).data
  },
  async patch<T>(url: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return (await send<T>(build('PATCH', url, body, options))).data
  },
  async delete<T>(url: string, options?: RequestOptions): Promise<T> {
    return (await send<T>(build('DELETE', url, undefined, options))).data
  },
  /** GET a file (with the auth header) as a Blob. */
  async getBlob(url: string, options?: RequestOptions): Promise<Blob> {
    return (await send<Blob>(build('GET', url, undefined, { ...options, responseType: 'blob', headers: { Accept: '*/*', ...options?.headers } }))).data
  },
}

/** A Spectrum login is active (its token may have just been dropped as expired). */
function hasSpectrumSession() {
  return getSessionSync()?.id.startsWith('SPX-') === true
}

/**
 * Default: attach the JWT from the encrypted auth cookie. An expired token is never sent: the
 * session ends (alert + sign-out) and the request fails as UNAUTHENTICATED.
 */
http.interceptors.request.use(async (config) => {
  if (config.skipAuth) return config
  const token = await getAuthToken()
  if (!token) {
    // A signed-in Spectrum user without a live token: it expired (the cookie lives exactly as long).
    if (hasSpectrumSession() && !isSessionEnded()) {
      notifySessionExpired('expired')
      unauthenticated()
    }
    return config
  }
  return { ...config, headers: { ...config.headers, Authorization: `Bearer ${token}` } }
})

/** Default: a 401 means the server no longer accepts the token — end the session (alert + sign-out). */
http.interceptors.response.use(undefined, (error, config) => {
  if (error.status === 401 && !config.skipAuth) notifySessionExpired('rejected')
  throw error
})
