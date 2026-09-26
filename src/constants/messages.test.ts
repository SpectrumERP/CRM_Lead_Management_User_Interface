import { describe, expect, it } from 'vitest'
import { API_ERROR_CODES } from '../api/errors'
import { ERROR_COPY, PAGE_COPY, getErrorMessage, getErrorTitle, getNotFoundMessage, interpolate } from './messages'

describe('error message catalog', () => {
  it('exports title and message for every API error code', () => {
    for (const code of API_ERROR_CODES) {
      expect(getErrorTitle(code).length).toBeGreaterThan(0)
      expect(getErrorMessage(code).length).toBeGreaterThan(0)
      expect(ERROR_COPY[code].message).toBe(getErrorMessage(code))
    }
  })

  it('fills templates dynamically from the constant file', () => {
    expect(interpolate('{resource} was not found.', { resource: 'Activity' })).toBe('Activity was not found.')
    expect(getNotFoundMessage('Lead')).toBe('Lead was not found.')
    expect(getNotFoundMessage()).toBe(getErrorMessage('NOT_FOUND'))
  })

  it('exposes login page copy from the catalog', () => {
    expect(PAGE_COPY.login.headline).toBe('Welcome back')
    expect(PAGE_COPY.login.submit).toBe('Sign in')
    expect(PAGE_COPY.login.highlights.length).toBeGreaterThan(0)
    expect(PAGE_COPY.login.emailRequired.length).toBeGreaterThan(0)
    expect(PAGE_COPY.login.passwordRequired.length).toBeGreaterThan(0)
  })
})
