import { isApiError, type ApiErrorCode, API_ERROR_CODES } from './errors'
import { getErrorMessage, getErrorTitle } from '../constants/messages'

export type ErrorTone = 'error' | 'warning'

export type ErrorAction =
  | { type: 'sign_in'; title: string; message: string; code: ApiErrorCode }
  | { type: 'forbidden'; title: string; message: string; code: ApiErrorCode }
  | { type: 'form'; title: string; message: string; code: ApiErrorCode }
  | { type: 'toast'; tone: ErrorTone; title: string; message: string; code: ApiErrorCode }
  | { type: 'crash'; title: string; message: string; code: 'UNKNOWN' }

type CodePolicy =
  | { type: 'sign_in' }
  | { type: 'forbidden' }
  | { type: 'form' }
  | { type: 'toast'; tone: ErrorTone }

/** One UI action per API error code. Screens must not switch on codes. */
const POLICY: Record<ApiErrorCode, CodePolicy> = {
  UNAUTHENTICATED: { type: 'sign_in' },
  FORBIDDEN: { type: 'forbidden' },
  INVALID_CREDENTIALS: { type: 'form' },
  VALIDATION: { type: 'form' },
  RATE_LIMIT: { type: 'toast', tone: 'warning' },
  CONFLICT: { type: 'toast', tone: 'warning' },
  TIMEOUT: { type: 'toast', tone: 'warning' },
  NOT_FOUND: { type: 'toast', tone: 'error' },
  METHOD_NOT_ALLOWED: { type: 'toast', tone: 'error' },
  PAYLOAD_TOO_LARGE: { type: 'toast', tone: 'error' },
  NETWORK: { type: 'toast', tone: 'error' },
  SERVER: { type: 'toast', tone: 'error' },
  UNKNOWN: { type: 'toast', tone: 'error' },
}

function assertEveryCodeMapped(): void {
  for (const code of API_ERROR_CODES) {
    void POLICY[code]
    void getErrorTitle(code)
    void getErrorMessage(code)
  }
}
assertEveryCodeMapped()

/** Map every known API error type to one UI action. `code` is internal — never show it on screen. */
export function resolveError(error: unknown): ErrorAction {
  if (!isApiError(error)) {
    return {
      type: 'crash',
      title: getErrorTitle('UNKNOWN'),
      message: getErrorMessage('UNKNOWN'),
      code: 'UNKNOWN',
    }
  }

  const title = getErrorTitle(error.code)
  const message = error.message
  const policy = POLICY[error.code]
  switch (policy.type) {
    case 'toast':
      return { type: 'toast', tone: policy.tone, title, message, code: error.code }
    case 'sign_in':
      return { type: 'sign_in', title, message, code: error.code }
    case 'forbidden':
      return { type: 'forbidden', title, message, code: error.code }
    case 'form':
      return { type: 'form', title, message, code: error.code }
    default: {
      const _never: never = policy
      return _never
    }
  }
}

/** True when the error is an API code (all of which have a UI action). */
export function isHandledError(error: unknown): boolean {
  return isApiError(error)
}
