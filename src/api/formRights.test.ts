import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { ALL_RIGHTS, FORM_NO, NO_RIGHTS, fallbackRights, fetchFormRights, rightsFor } from './formRights'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('form rights', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('reads the menu into rights by form number', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        success: true,
        message: '',
        data: [
          { formNo: 1550, formName: 'Business Entity', isOpen: true, isSave: true, isUpdate: false, isDelete: false, isReport: false },
          { formNo: 'x', isOpen: true },
        ],
      }),
    )
    const map = await fetchFormRights()
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/globaldata/forms/task-management-menu')
    expect(map).toEqual({ 1550: { isOpen: true, isSave: true, isUpdate: false, isDelete: false, isReport: false } })
  })

  it('gives no rights for forms the loaded menu does not list', () => {
    const state = { source: 'server' as const, map: { 1550: ALL_RIGHTS } }
    expect(rightsFor(FORM_NO.businessEntity, state, 'Sales Manager')).toBe(ALL_RIGHTS)
    expect(rightsFor(FORM_NO.port, state, 'Admin')).toBe(NO_RIGHTS)
  })

  it('falls back to the CRM role when the menu is unavailable', () => {
    expect(fallbackRights(FORM_NO.port, 'Admin')).toBe(ALL_RIGHTS)
    expect(fallbackRights(FORM_NO.port, 'Sales Manager')).toBe(NO_RIGHTS)
    expect(fallbackRights(FORM_NO.businessEntity, 'Sales Manager')).toEqual({ ...ALL_RIGHTS, isDelete: false })
    expect(rightsFor(FORM_NO.city, { source: 'fallback', map: {} }, 'Admin')).toBe(ALL_RIGHTS)
  })
})
