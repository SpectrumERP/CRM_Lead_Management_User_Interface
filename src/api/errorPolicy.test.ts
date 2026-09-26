import { describe, expect, it } from 'vitest'
import {
  API_ERROR_CODES,
  ApiError,
  asTransportError,
  codeFromStatus,
  errorFromResponse,
  fromHttpStatus,
  isApiErrorCode,
} from './errors'
import { isHandledError, resolveError } from './errorPolicy'
import { getErrorMessage } from '../constants/messages'

describe('resolveError', () => {
  it('maps every API error code to a non-crash UI action', () => {
    const expected: Record<(typeof API_ERROR_CODES)[number], string> = {
      UNAUTHENTICATED: 'sign_in',
      FORBIDDEN: 'forbidden',
      INVALID_CREDENTIALS: 'form',
      VALIDATION: 'form',
      RATE_LIMIT: 'toast',
      CONFLICT: 'toast',
      TIMEOUT: 'toast',
      NOT_FOUND: 'toast',
      METHOD_NOT_ALLOWED: 'toast',
      PAYLOAD_TOO_LARGE: 'toast',
      NETWORK: 'toast',
      SERVER: 'toast',
      UNKNOWN: 'toast',
    }

    for (const code of API_ERROR_CODES) {
      const action = resolveError(new ApiError(code))
      expect(action.type, code).toBe(expected[code])
      expect(action.code).toBe(code)
      expect(isHandledError(new ApiError(code))).toBe(true)
    }
  })

  it('keeps rate-limit, conflict, and timeout as warning toasts', () => {
    expect(resolveError(new ApiError('RATE_LIMIT'))).toMatchObject({ type: 'toast', tone: 'warning' })
    expect(resolveError(new ApiError('CONFLICT'))).toMatchObject({ type: 'toast', tone: 'warning' })
    expect(resolveError(new ApiError('TIMEOUT'))).toMatchObject({ type: 'toast', tone: 'warning' })
  })

  it('treats unexpected programming errors as a crash screen', () => {
    expect(resolveError(new Error('boom')).type).toBe('crash')
    expect(resolveError('string-throw').type).toBe('crash')
    expect(isHandledError(new Error('boom'))).toBe(false)
  })

  it('never puts API codes or technical text in user-facing copy', () => {
    for (const code of API_ERROR_CODES) {
      const action = resolveError(new ApiError(code, code))
      expect(action.message).not.toBe(code)
      expect(action.message).not.toMatch(
        /UNAUTHENTICATED|INVALID_CREDENTIALS|FORBIDDEN|NOT_FOUND|RATE_LIMIT|METHOD_NOT_ALLOWED|\b401\b|\b403\b|\b404\b|\b500\b/,
      )
      expect(action.title).not.toMatch(/UNAUTHENTICATED|INVALID_CREDENTIALS|\b401\b|\b403\b/)
    }
    expect(resolveError(new Error('TypeError: x is undefined at foo.ts:12')).message).toBe(
      getErrorMessage('UNKNOWN'),
    )
    expect(new ApiError('NOT_FOUND', 'GET /api/v1/leads').message).toBe(getErrorMessage('NOT_FOUND'))
    expect(new ApiError('UNKNOWN', 'Failed to fetch').message).toBe(getErrorMessage('UNKNOWN'))
  })
})

describe('HTTP status mapping', () => {
  it('maps standard HTTP statuses onto API error codes', () => {
    expect(codeFromStatus(0)).toBe('NETWORK')
    expect(codeFromStatus(400)).toBe('VALIDATION')
    expect(codeFromStatus(401)).toBe('UNAUTHENTICATED')
    expect(codeFromStatus(403)).toBe('FORBIDDEN')
    expect(codeFromStatus(404)).toBe('NOT_FOUND')
    expect(codeFromStatus(405)).toBe('METHOD_NOT_ALLOWED')
    expect(codeFromStatus(408)).toBe('TIMEOUT')
    expect(codeFromStatus(409)).toBe('CONFLICT')
    expect(codeFromStatus(413)).toBe('PAYLOAD_TOO_LARGE')
    expect(codeFromStatus(415)).toBe('VALIDATION')
    expect(codeFromStatus(422)).toBe('VALIDATION')
    expect(codeFromStatus(429)).toBe('RATE_LIMIT')
    expect(codeFromStatus(500)).toBe('SERVER')
    expect(codeFromStatus(502)).toBe('SERVER')
    expect(codeFromStatus(503)).toBe('SERVER')
    expect(codeFromStatus(504)).toBe('TIMEOUT')
    expect(codeFromStatus(418)).toBe('UNKNOWN')
    expect(codeFromStatus(599)).toBe('SERVER')
  })

  it('prefers an explicit body code when the server sends one', () => {
    expect(() => errorFromResponse(409, { code: 'CONFLICT', message: 'Lead exists' })).toThrow(
      expect.objectContaining({ code: 'CONFLICT', message: 'Lead exists', status: 409 }),
    )
    expect(() => errorFromResponse(500)).toThrow(expect.objectContaining({ code: 'SERVER' }))
  })

  it('builds ApiError from status with a default message', () => {
    const error = fromHttpStatus(404)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.status).toBe(404)
  })

  it('recognizes only catalog codes', () => {
    expect(isApiErrorCode('FORBIDDEN')).toBe(true)
    expect(isApiErrorCode('NOT_A_CODE')).toBe(false)
  })

  it('maps transport failures', () => {
    expect(() => asTransportError(new TypeError('Failed to fetch'))).toThrow(
      expect.objectContaining({ code: 'NETWORK' }),
    )
    expect(() => asTransportError(new ApiError('SERVER'))).toThrow(
      expect.objectContaining({ code: 'SERVER' }),
    )
  })
})
