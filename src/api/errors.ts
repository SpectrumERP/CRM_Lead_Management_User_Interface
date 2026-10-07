import { getErrorMessage, getNotFoundMessage } from '../constants/messages'

export const API_ERROR_CODES = [
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'VALIDATION',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMIT',
  'TIMEOUT',
  'NETWORK',
  'SERVER',
  'UNKNOWN',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  VALIDATION: 400,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMIT: 429,
  TIMEOUT: 408,
  NETWORK: 0,
  SERVER: 500,
  UNKNOWN: 500,
}

/** Message strings, looked up from `src/constants/messages.ts`. */
export const API_ERROR_MESSAGE: Record<ApiErrorCode, string> = Object.fromEntries(
  API_ERROR_CODES.map((code) => [code, getErrorMessage(code)]),
) as Record<ApiErrorCode, string>

const STATUS_TO_CODE: Record<number, ApiErrorCode> = {
  0: 'NETWORK',
  400: 'VALIDATION',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'TIMEOUT',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'VALIDATION',
  422: 'VALIDATION',
  429: 'RATE_LIMIT',
  500: 'SERVER',
  502: 'SERVER',
  503: 'SERVER',
  504: 'TIMEOUT',
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number

  constructor(code: ApiErrorCode, message?: string, status = API_ERROR_STATUS[code]) {
    super(safeUserMessage(code, message))
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isApiErrorCode(value: string): value is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(value)
}

/** Plain-language copy for screens. Never returns an API/HTTP code. */
export function safeUserMessage(code: ApiErrorCode, candidate?: string): string {
  const fallback = getErrorMessage(code)
  if (!candidate) return fallback
  const text = candidate.trim()
  if (!text) return fallback
  if (looksLikeInternalError(text)) return fallback
  return text
}

function looksLikeInternalError(text: string): boolean {
  if (isApiErrorCode(text)) return true
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(text)) return true
  if (
    /\b(UNAUTHENTICATED|INVALID_CREDENTIALS|FORBIDDEN|VALIDATION|NOT_FOUND|METHOD_NOT_ALLOWED|CONFLICT|PAYLOAD_TOO_LARGE|RATE_LIMIT|TIMEOUT|NETWORK|SERVER|UNKNOWN)\b/.test(
      text,
    )
  ) {
    return true
  }
  if (/\/api\//i.test(text)) return true
  if (/\b(GET|POST|PATCH|PUT|DELETE)\s+\//.test(text)) return true
  if (/\b(TypeError|ReferenceError|SyntaxError)\b/.test(text)) return true
  if (/failed to fetch|networkerror|load failed/i.test(text)) return true
  if (/\bat\s+\S+\s+\(/.test(text)) return true
  if (/\bstatus\s*[:=]?\s*\d{3}\b/i.test(text)) return true
  if (/\b(401|403|404|405|408|409|413|422|429|500|502|503|504)\b/.test(text) && text.length < 48) return true
  if (text.length > 180) return true
  return false
}

export function fail(code: ApiErrorCode, message?: string, status?: number): never {
  throw new ApiError(code, message, status ?? API_ERROR_STATUS[code])
}

export function unauthenticated(): never {
  fail('UNAUTHENTICATED')
}

export function forbidden(): never {
  fail('FORBIDDEN')
}

export function invalidCredentials(): never {
  fail('INVALID_CREDENTIALS')
}

export function rateLimited(): never {
  fail('RATE_LIMIT')
}

export function validation(message: string): never {
  fail('VALIDATION', message)
}

export function notFound(resource?: string): never {
  fail('NOT_FOUND', getNotFoundMessage(resource))
}

export function methodNotAllowed(_method?: string): never {
  fail('METHOD_NOT_ALLOWED')
}

export function conflict(message = getErrorMessage('CONFLICT')): never {
  fail('CONFLICT', message)
}

export function payloadTooLarge(): never {
  fail('PAYLOAD_TOO_LARGE')
}

export function timeout(): never {
  fail('TIMEOUT')
}

export function network(message = getErrorMessage('NETWORK')): never {
  fail('NETWORK', message)
}

export function serverError(message = getErrorMessage('SERVER')): never {
  fail('SERVER', message)
}

export function unknownError(message = getErrorMessage('UNKNOWN')): never {
  fail('UNKNOWN', message)
}

/** Map an HTTP status (future fetch) to a known API error code. */
export function codeFromStatus(status: number): ApiErrorCode {
  const mapped = STATUS_TO_CODE[status]
  if (mapped) return mapped
  if (status >= 500) return 'SERVER'
  if (status >= 400) return 'UNKNOWN'
  return 'UNKNOWN'
}

export function fromHttpStatus(status: number, message?: string): ApiError {
  const code = codeFromStatus(status)
  return new ApiError(code, message ?? getErrorMessage(code), status)
}

/**
 * The server's own message from an error / failed-envelope body, most specific first:
 * `errors[].errorMessage` (Spectrum validation), an ASP.NET `errors` map `{ Field: [messages] }`,
 * then `errorMessage`, `error`, `message`, `detail`, `title` (in Spectrum envelopes `message` is the
 * generic "Request failed." and `error` the specific reason). Several messages are joined.
 */
export function serverErrorMessage(body: unknown): string | undefined {
  if (typeof body === 'string') {
    const text = body.trim()
    // An HTML error page is not a message.
    return text && !/^</.test(text) ? text : undefined
  }
  if (!body || typeof body !== 'object') return undefined
  const data = body as Record<string, unknown>
  const pick = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)
  const unique = (items: (string | undefined)[]) => [...new Set(items.filter((m): m is string => Boolean(m)))]

  let detailed: string[] = []
  if (Array.isArray(data.errors)) {
    detailed = unique(data.errors.map((item) =>
      typeof item === 'string' ? pick(item) : pick((item as Record<string, unknown>)?.errorMessage) ?? pick((item as Record<string, unknown>)?.message),
    ))
  } else if (data.errors && typeof data.errors === 'object') {
    detailed = unique(Object.values(data.errors as Record<string, unknown>).flatMap((value) => (Array.isArray(value) ? value.map(pick) : [pick(value)])))
  }
  if (detailed.length) return detailed.join(' ')
  return pick(data.errorMessage) ?? pick(data.error) ?? pick(data.message) ?? pick(data.detail) ?? pick(data.title)
}

/** Parse `{ code, message }` from a JSON error body, else fall back to status. */
export function errorFromResponse(status: number, body?: { code?: string; message?: string }): never {
  // Field-level `errors` (validation) say more than the generic `message`.
  const message = serverErrorMessage(body)
  if (body?.code && isApiErrorCode(body.code)) {
    fail(body.code, message, status)
  }
  throw fromHttpStatus(status, message)
}

/** Fetch / abort / offline failures become NETWORK or TIMEOUT. */
export function asTransportError(error: unknown): never {
  if (isApiError(error)) throw error
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
    timeout()
  }
  if (error instanceof TypeError) network()
  unknownError()
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) return error
  return new ApiError('UNKNOWN')
}
