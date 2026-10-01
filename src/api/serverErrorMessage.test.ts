import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { serverErrorMessage } from './errors'
import { masterApis } from './masters'

describe('serverErrorMessage', () => {
  it('prefers the per-field messages over the generic error', () => {
    expect(serverErrorMessage({
      error: 'Validation failed.',
      errors: [{ propertyName: 'ProductName', errorCode: 'MaximumLengthValidator', errorMessage: "The length of 'Product Name' must be 50 characters or fewer. You entered 72 characters." }],
      traceId: 'x',
    })).toBe("The length of 'Product Name' must be 50 characters or fewer. You entered 72 characters.")
  })

  it('joins several messages and reads the ASP.NET errors map', () => {
    expect(serverErrorMessage({ errors: [{ errorMessage: 'Name is required.' }, { errorMessage: 'Sequence is required.' }, { errorMessage: 'Name is required.' }] }))
      .toBe('Name is required. Sequence is required.')
    expect(serverErrorMessage({ title: 'One or more validation errors occurred.', errors: { LeadName: ['Lead name is too long.'] } }))
      .toBe('Lead name is too long.')
  })

  it('prefers the specific error over the generic message in a failed envelope', () => {
    expect(serverErrorMessage({ success: false, message: 'Request failed.', error: 'Company not found.', errors: [] })).toBe('Company not found.')
  })

  it('falls back to message / error / title, and ignores HTML pages', () => {
    expect(serverErrorMessage({ success: false, message: 'Lead not found.' })).toBe('Lead not found.')
    expect(serverErrorMessage({ error: 'Validation failed.' })).toBe('Validation failed.')
    expect(serverErrorMessage({ title: 'Bad Request' })).toBe('Bad Request')
    expect(serverErrorMessage('<html>Bad gateway</html>')).toBeUndefined()
    expect(serverErrorMessage(null)).toBeUndefined()
  })
})

describe('an HTTP 400 from the server reaches the screen with its own text', () => {
  const fetchMock = vi.fn()
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => { vi.unstubAllGlobals(); __resetAuthStoreForTests() })

  it('master save', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: 'Validation failed.',
      errors: [{ propertyName: 'ProductName', errorCode: 'MaximumLengthValidator', errorMessage: "The length of 'Product Name' must be 50 characters or fewer." }],
    }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
    await expect(masterApis.leadSources.save({ name: 'Website' })).rejects.toMatchObject({
      message: "The length of 'Product Name' must be 50 characters or fewer.",
    })
  })

  it('product names over 50 characters are stopped before the request', async () => {
    await expect(masterApis.crmProducts.save({ name: 'x'.repeat(51) })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
