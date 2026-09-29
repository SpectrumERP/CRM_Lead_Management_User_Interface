/**
 * Shared HTTP client for the Spectrum backend, with axios-style interceptors.
 * Every real API call should go through `http` so auth headers and error mapping stay in one place.
 *
 *   http.interceptors.request.use((config) => ({ ...config, headers: { ...config.headers, 'X-Foo': '1' } }))
 *   http.interceptors.response.use((response) => response, (error) => { throw error })
 */
import { getAuthToken, clearAuth } from './authStore'
import { spectrumOrigin } from './config'
import { asTransportError, errorFromResponse, isApiError, type ApiError } from './errors'

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

type RequestOptions = Partial<Pick<HttpRequestConfig, 'headers' | 'skipAuth' | 'signal'>>

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
        body: config.body === undefined ? undefined : JSON.stringify(config.body),
        signal: config.signal,
      })
      const data = await parseBody(raw)
      if (!raw.ok) {
        const message = typeof data === 'object' && data ? (data as { message?: string }).message : undefined
        errorFromResponse(raw.status, { message })
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

function build(method: HttpVerb, url: string, body: unknown, options: RequestOptions = {}): HttpRequestConfig {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return { method, url, headers, body, skipAuth: options.skipAuth, signal: options.signal }
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
    return (await send<T>(build('GET', url, undefined, options))).data
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
}

/** Default: attach the JWT from the encrypted auth cookie. */
http.interceptors.request.use(async (config) => {
  if (config.skipAuth) return config
  const token = await getAuthToken()
  if (!token) return config
  return { ...config, headers: { ...config.headers, Authorization: `Bearer ${token}` } }
})

/** Default: a rejected token is dead — drop it so the next login starts clean. */
http.interceptors.response.use(undefined, (error, config) => {
  if (error.status === 401 && !config.skipAuth) clearAuth()
  throw error
})
