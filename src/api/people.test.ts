import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { __resetPeopleCacheForTests, knownPerson, loadPersonProfile, rememberPerson } from './people'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const ok = (data: unknown) => jsonResponse(200, { success: true, message: '', data })

const userRow = { loginNo: 11, loginId: 'priya.mehta', printingName: 'Priya Mehta', email: 'priya@example.com', empNo: 501 }
const userDetail = { loginNo: 11, userName: 'priya.mehta', displayName: 'Priya Mehta', email: 'priya@example.com', phoneNo: '98200 11111' }
const employee = {
  empNo: 501,
  empName: 'Mrs. Priya Mehta',
  jobDescription: 'Sales Manager',
  department: { departmentNo: 3, departmentName: 'Sales' },
  email: 'priya@example.com',
  phone: '022 4000',
}

/** Answers each request by its path, in the order the card asks. */
function serve(routes: Record<string, () => Response>) {
  return (input: unknown) => {
    const url = new URL(String(input))
    const route = Object.keys(routes).find((path) => url.pathname === path)
    if (!route) throw new Error(`unexpected ${url.pathname}`)
    return Promise.resolve(routes[route]!())
  }
}

describe('person profile card data', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    __resetPeopleCacheForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('finds a user by display name, then fills designation and department from their employee record', async () => {
    fetchMock.mockImplementation(
      serve({
        '/api/security/users': () => ok([{ ...userRow, loginNo: 12, printingName: 'Priya Mehta Rao' }, userRow]),
        '/api/security/users/load-data/11': () => ok(userDetail),
        '/api/payroll/employees/load-data/501': () => ok(employee),
      }),
    )
    await expect(loadPersonProfile({ name: 'priya mehta' })).resolves.toEqual({
      name: 'priya mehta',
      designation: 'Sales Manager',
      department: 'Sales',
      phone: '98200 11111',
      email: 'priya@example.com',
      loginNo: 11,
      empNo: 501,
    })
    const search = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(Object.fromEntries(search.searchParams)).toEqual({ keywordSearch: 'priya mehta' })
  })

  it('uses a known login no without searching by name', async () => {
    fetchMock.mockImplementation(
      serve({
        '/api/security/users/load-data/11': () => ok(userDetail),
        '/api/security/users': () => ok([userRow]),
        '/api/payroll/employees/load-data/501': () => ok(employee),
      }),
    )
    const profile = await loadPersonProfile({ name: 'Priya Mehta', loginNo: 11 })
    expect(profile?.loginNo).toBe(11)
    const first = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(first.pathname).toBe('/api/security/users/load-data/11')
  })

  it("leaves out a linked employee who is someone else (no borrowed department or photo)", async () => {
    fetchMock.mockImplementation(
      serve({
        '/api/security/users': () => ok([userRow]),
        '/api/security/users/load-data/11': () => ok(userDetail),
        '/api/payroll/employees/load-data/501': () => ok({ ...employee, empName: 'Rahul Shah', email: 'rahul@example.com' }),
      }),
    )
    const profile = await loadPersonProfile({ name: 'Priya Mehta' })
    expect(profile).toMatchObject({ designation: '', department: '', email: 'priya@example.com' })
    expect(profile?.empNo).toBeUndefined()
  })

  it('returns null when no user has that name', async () => {
    fetchMock.mockImplementation(serve({ '/api/security/users': () => ok([userRow]) }))
    await expect(loadPersonProfile({ name: 'Someone Else' })).resolves.toBeNull()
  })

  it('loads each person once, and tries again after a failure', async () => {
    let fail = true
    fetchMock.mockImplementation(
      serve({
        '/api/security/users': () => (fail ? jsonResponse(500, { message: 'down' }) : ok([])),
      }),
    )
    await expect(loadPersonProfile({ name: 'Priya Mehta' })).rejects.toBeTruthy()
    fail = false
    await expect(loadPersonProfile({ name: 'Priya Mehta' })).resolves.toBeNull()
    await expect(loadPersonProfile({ name: 'Priya Mehta' })).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("shows the row's own mobile no and email when the user record has none (leadOwner.mobileNo)", async () => {
    const leadOwner = { loginNo: 13, loginId: 'ERPadmin', printingName: 'Ramkrishna Kurmi', email: 'erpadmin@acedsindia.com', mobileNo: '9179568325' }
    expect(rememberPerson(leadOwner)).toBe('Ramkrishna Kurmi')
    const known = knownPerson('Ramkrishna Kurmi')
    expect(known).toEqual({ loginNo: 13, contact: { email: 'erpadmin@acedsindia.com', phone: '9179568325' } })
    fetchMock.mockImplementation(
      serve({
        '/api/security/users/load-data/13': () => ok({ loginNo: 13, userName: 'ERPadmin', displayName: 'Ramkrishna Kurmi', email: 'erpadmin@acedsindia.com', phoneNo: '' }),
        '/api/security/users': () => ok([{ loginNo: 13, loginId: 'ERPadmin', printingName: 'Ramkrishna Kurmi' }]),
      }),
    )
    await expect(
      loadPersonProfile({ name: 'Ramkrishna Kurmi', loginNo: known!.loginNo, contact: known!.contact }),
    ).resolves.toMatchObject({ phone: '9179568325', email: 'erpadmin@acedsindia.com', loginNo: 13 })
    // The remembered login no is used: no search by name first.
    expect(new URL(String(fetchMock.mock.calls[0]![0])).pathname).toBe('/api/security/users/load-data/13')
  })

  it("keeps the user record's own phone ahead of the row's", async () => {
    fetchMock.mockImplementation(
      serve({
        '/api/security/users/load-data/11': () => ok(userDetail),
        '/api/security/users': () => ok([]),
      }),
    )
    await expect(
      loadPersonProfile({ name: 'Priya Mehta', loginNo: 11, contact: { phone: '111' } }),
    ).resolves.toMatchObject({ phone: '98200 11111' })
  })

  it('keeps contact values a later row leaves out (an audit user without mobileNo)', () => {
    rememberPerson({ loginNo: 13, printingName: 'Ramkrishna Kurmi', mobileNo: '9179568325' })
    rememberPerson({ loginNo: 13, printingName: 'Ramkrishna Kurmi', email: 'erpadmin@acedsindia.com' })
    expect(knownPerson('ramkrishna kurmi')?.contact).toEqual({ email: 'erpadmin@acedsindia.com', phone: '9179568325' })
  })
})
