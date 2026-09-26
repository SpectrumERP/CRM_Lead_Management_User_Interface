import { apiOrigin } from './config'
import { asTransportError, errorFromResponse, isApiError, methodNotAllowed, notFound, payloadTooLarge, validation } from './errors'
import { splitUrl } from './query'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface ApiRequest {
  path: string
  params: Record<string, string>
  query: Record<string, string>
  body?: unknown
}

type ApiHandler = (request: ApiRequest) => unknown
type Unsubscribe = () => void

interface Route {
  method: HttpMethod
  pattern: string
  handler: ApiHandler
}

const routes: Route[] = []
let subscribeImpl: ((listener: () => void) => Unsubscribe) | null = null
const MAX_BODY_CHARS = 512_000

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/')
  const pathParts = path.split('/')
  if (patternParts.length !== pathParts.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i] ?? ''
    const value = pathParts[i] ?? ''
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(value)
      continue
    }
    if (part !== value) return null
  }
  return params
}

function assertBodySize(body: unknown) {
  if (body === undefined) return
  let encoded = ''
  try {
    encoded = JSON.stringify(body) ?? ''
  } catch {
    validation('Request body is invalid.')
  }
  if (encoded.length > MAX_BODY_CHARS) payloadTooLarge()
}

export function register(method: HttpMethod, pattern: string, handler: ApiHandler) {
  routes.push({ method, pattern, handler })
}

export function bindSubscribe(impl: (listener: () => void) => Unsubscribe) {
  subscribeImpl = impl
}

export function subscribe(listener: () => void): Unsubscribe {
  if (!subscribeImpl) return () => {}
  return subscribeImpl(listener)
}

export function dispatch<T>(method: HttpMethod, path: string, body?: unknown): T {
  assertBodySize(body)
  const { pathname, query } = splitUrl(path)
  let pathExists = false
  for (const route of routes) {
    const params = matchPath(route.pattern, pathname)
    if (!params) continue
    pathExists = true
    if (route.method !== method) continue
    return route.handler({ path: pathname, params, query, body }) as T
  }
  if (pathExists) methodNotAllowed()
  notFound()
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const origin = apiOrigin()
  if (!origin) return dispatch<T>(method, path, body)
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const response = await fetch(`${origin}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    const parsed = text ? (JSON.parse(text) as { code?: string; message?: string }) : undefined
    if (!response.ok) errorFromResponse(response.status, parsed)
    return parsed as T
  } catch (error) {
    if (isApiError(error)) throw error
    asTransportError(error)
  }
}

/** Dummy dispatch today. Set VITE_API_URL and these methods become fetch() to the same paths. */
export const client = {
  get<T>(path: string): Promise<T> {
    return request<T>('GET', path)
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('POST', path, body)
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>('PATCH', path, body)
  },
  getSync<T>(path: string): T {
    return dispatch<T>('GET', path)
  },
  postSync<T>(path: string, body?: unknown): T {
    return dispatch<T>('POST', path, body)
  },
  patchSync<T>(path: string, body?: unknown): T {
    return dispatch<T>('PATCH', path, body)
  },
  deleteSync<T>(path: string): T {
    return dispatch<T>('DELETE', path)
  },
  subscribe,
}
