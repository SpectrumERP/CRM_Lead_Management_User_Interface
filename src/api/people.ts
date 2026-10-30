/**
 * Profile card data for a person shown by name (owner, created / modified by, assignee, note author):
 * the login user and the payroll employee linked to them — the same card Task Management shows.
 *
 *   GET /api/security/users?keywordSearch=        (login no from a name; linked employee no when sent)
 *   GET /api/security/users/load-data/{loginNo}
 *   GET /api/payroll/employees/load-data/{empNo}
 *   GET /api/payroll/employees/photo/{empNo}
 *
 * One request per person per session; a failed one is dropped so the next open tries again.
 */
import { spectrumEndpoints } from './endpoints'
import type { SpectrumResponse } from './fillValues'
import { http } from './http'
import { withQuery } from './query'
import { userDisplayName } from './users'

/** Values the screen's own API row carries for the person (`leadOwner.email`, `leadOwner.mobileNo`). */
export interface PersonContact {
  email?: string
  phone?: string
}

/** Who a card is about. Screens that only kept the name pass just that; the login no is looked up. */
export interface PersonRef {
  name: string
  loginNo?: number
  empNo?: number
  contact?: PersonContact
}

/** What was loaded for a card: the user record and the employee linked to them (checked in resolveProfile). */
export interface PersonDetails {
  user: Raw | null
  employee: Employee | null
  loginNo: number
}

export interface PersonProfile {
  name: string
  designation: string
  department: string
  phone: string
  email: string
  loginNo?: number
  /** Only when the linked employee record really is this person (it decides the photo). */
  empNo?: number
}

type Raw = Record<string, unknown>

export interface Employee {
  empNo: number
  empName: string
  designation: string
  department: string
  email: string
  phone: string
}

const asRecord = (value: unknown): Raw | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : null

const positiveNo = (value: unknown) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** First non-empty text among `keys`; nested objects give their name (`{ departmentName }`). */
function pick(data: Raw | null, keys: string[]): string {
  for (const key of keys) {
    const value = data?.[key]
    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim()
      if (text) return text
    }
    const nested = asRecord(value)
    if (nested) {
      const text = pick(nested, ['departmentName', 'designationName', 'companyName', 'name'])
      if (text) return text
    }
  }
  return ''
}

/** "Mr. Rahul Sharma" → "Rahul Sharma" (payroll puts titles in names). */
const SALUTATION = /^(?:(?:mr|mrs|ms|miss|mx|dr|prof|shri|sri|smt|kum|kumari|km)(?:\.\s*|\s+))+/i
export function stripSalutation(name: string) {
  const trimmed = name.trim()
  return trimmed.replace(SALUTATION, '').trim() || trimmed
}

function toEmployee(row: Raw): Employee | null {
  const empNo = positiveNo(row.empNo)
  if (!empNo) return null
  const phone = pick(row, ['phone'])
  const extension = pick(row, ['extension'])
  return {
    empNo,
    empName: stripSalutation(pick(row, ['empName'])),
    designation: pick(row, ['jobDescription', 'designation']),
    department: pick(row, ['department', 'departmentName']),
    email: pick(row, ['email']),
    phone: [phone, extension ? `Ext ${extension}` : ''].filter(Boolean).join(' · '),
  }
}

async function getData(url: string): Promise<unknown> {
  const response = await http.get<SpectrumResponse<unknown> | null>(url)
  return response?.success === false ? null : response?.data
}

async function searchUserRows(keyword: string): Promise<Raw[]> {
  const data = await getData(withQuery(spectrumEndpoints.users.search, { keywordSearch: keyword.trim() }))
  return Array.isArray(data) ? data.map(asRecord).filter((row): row is Raw => row !== null) : []
}

const rowName = (row: Raw) =>
  userDisplayName({ printingName: pick(row, ['printingName']), loginId: pick(row, ['loginId']) })

/** The user row for a display name (exact printing name / login id, ignoring case); null when none. */
async function userRowForName(name: string): Promise<Raw | null> {
  const wanted = name.trim().toLowerCase()
  if (!wanted) return null
  const rows = await searchUserRows(name)
  return rows.find((row) => rowName(row).toLowerCase() === wanted || pick(row, ['loginId']).toLowerCase() === wanted) ?? null
}

/** The employee no the user search links to a login (sent only by some servers); 0 when none. */
async function linkedEmpNo(loginNo: number, keywords: string[]): Promise<number> {
  for (const keyword of new Set(keywords.map((k) => k.trim()).filter(Boolean))) {
    const row = (await searchUserRows(keyword)).find((r) => positiveNo(r.loginNo) === loginNo)
    if (row) return positiveNo(row.empNo)
  }
  return 0
}

const employeeCache = new Map<number, Promise<Employee | null>>()
function loadEmployee(empNo: number): Promise<Employee | null> {
  let pending = employeeCache.get(empNo)
  if (!pending) {
    pending = getData(spectrumEndpoints.employees.loadData(empNo)).then((data) => {
      const row = asRecord(data)
      return row ? toEmployee(row) : null
    })
    employeeCache.set(empNo, pending)
    pending.catch(() => employeeCache.delete(empNo))
  }
  return pending
}

const nameTokens = (value: string) =>
  stripSalutation(value).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** "Abhinav" and "Abhinav Kumar" are the same name: every word of the shorter one is in the longer one. */
function sameName(a: string, b: string) {
  const [short, long] = [nameTokens(a), nameTokens(b)].sort((x, y) => x.length - y.length)
  return short.length > 0 && short.every((t) => long.includes(t))
}

/**
 * Whether a linked payroll record is this person: same email or same name. The linked employee no is not
 * always right, and another person's department or photo is worse than none.
 */
function employeeMatches(employee: Employee, names: string[], emails: string[]) {
  const email = employee.email.toLowerCase()
  if (email && emails.some((e) => e.toLowerCase() === email)) return true
  return names.some((n) => sameName(n, employee.empName))
}

/**
 * What the card shows: the user record first, then the values the screen's own API row carries
 * (`contact`), then the matching employee. A value none of them has stays '' (and is left out), never
 * borrowed from someone else's record.
 */
export function resolveProfile(name: string, details: PersonDetails | null, contact?: PersonContact): PersonProfile {
  const user = details?.user ?? null
  const employee = details?.employee ?? null
  const loginNo = details?.loginNo ?? 0
  const userName = pick(user, ['displayName', 'printingName', 'userName', 'loginId'])
  const userEmail = pick(user, ['email'])
  const rowEmail = contact?.email?.trim() ?? ''
  const names = [name, userName].filter((n) => n.trim())
  const emails = [userEmail, rowEmail].filter(Boolean)
  const matched =
    employee && (names.length === 0 && emails.length === 0 ? true : employeeMatches(employee, names, emails)) ? employee : null
  return {
    name: name.trim() || userName || matched?.empName || '',
    designation:
      pick(user, ['designation', 'designationName', 'responsibility', 'jobDescription', 'jobTitle']) || matched?.designation || '',
    department: pick(user, ['departmentName', 'department']) || matched?.department || '',
    phone: pick(user, ['phoneNo', 'phone', 'mobileNo']) || contact?.phone?.trim() || matched?.phone || '',
    email: userEmail || rowEmail || matched?.email || '',
    ...(loginNo ? { loginNo } : {}),
    ...(matched ? { empNo: matched.empNo } : {}),
  }
}

async function fetchDetails(person: PersonRef): Promise<PersonDetails | null> {
  let loginNo = positiveNo(person.loginNo)
  let empNo = positiveNo(person.empNo)
  if (!loginNo && !empNo) {
    const row = await userRowForName(person.name)
    loginNo = positiveNo(row?.loginNo)
    empNo = positiveNo(row?.empNo)
  }
  if (!loginNo) {
    const employee = empNo ? await loadEmployee(empNo) : null
    return employee ? { user: null, employee, loginNo: 0 } : null
  }
  const user = asRecord(await getData(spectrumEndpoints.users.loadData(loginNo)))
  if (!empNo) {
    const keywords = [pick(user, ['userName', 'loginId']), pick(user, ['displayName']), person.name]
    empNo = await linkedEmpNo(loginNo, keywords).catch(() => 0)
  }
  const employee = empNo ? await loadEmployee(empNo).catch(() => null) : null
  return { user, employee, loginNo }
}

const detailsCache = new Map<string, Promise<PersonDetails | null>>()

export function personKey(person: PersonRef) {
  if (positiveNo(person.loginNo)) return `l${person.loginNo}`
  if (positiveNo(person.empNo)) return `e${person.empNo}`
  return `n${person.name.trim().toLowerCase()}`
}

/** The person's records; null when no user or employee record was found for them. */
export function loadPersonDetails(person: PersonRef): Promise<PersonDetails | null> {
  const key = personKey(person)
  let pending = detailsCache.get(key)
  if (!pending) {
    pending = fetchDetails(person)
    detailsCache.set(key, pending)
    pending.catch(() => detailsCache.delete(key))
  }
  return pending
}

/** What the card shows for a person (see resolveProfile). */
export async function loadPersonProfile(person: PersonRef): Promise<PersonProfile | null> {
  const details = await loadPersonDetails(person)
  return details || person.contact?.email || person.contact?.phone ? resolveProfile(person.name, details, person.contact) : null
}

// ─── People the API has sent ──────────────────────────────────────────────────
// Lists and records carry each user as an object (`leadOwner`, `createdBy`, `assignTo`: loginNo, email,
// mobileNo) but the app keeps only the name. Remembering them here lets the card find the login no
// (no search by name) and show the row's own email / phone when the user record has none.

const knownPeople = new Map<string, { loginNo: number; contact: PersonContact }>()
const nameKey = (name: string) => `n${name.trim().toLowerCase()}`

/** Records a user object from an API row; returns its display name ('' when it has none). */
export function rememberPerson(value: unknown): string {
  const user = asRecord(value)
  if (!user) return typeof value === 'string' ? value.trim() : ''
  const name = pick(user, ['printingName', 'displayName', 'userName', 'loginId', 'name'])
  const loginNo = positiveNo(user.loginNo)
  const email = pick(user, ['email'])
  const phone = pick(user, ['mobileNo', 'phoneNo', 'phone'])
  if (!name && !loginNo) return name
  const keys = [loginNo ? `l${loginNo}` : '', name ? nameKey(name) : ''].filter(Boolean)
  const before = keys.map((k) => knownPeople.get(k)).find((p) => p && (!loginNo || !p.loginNo || p.loginNo === loginNo))
  const entry = {
    loginNo: loginNo || before?.loginNo || 0,
    // A later row without the value (an audit user without mobileNo) keeps what an earlier one sent.
    contact: {
      ...(email || before?.contact.email ? { email: email || before?.contact.email } : {}),
      ...(phone || before?.contact.phone ? { phone: phone || before?.contact.phone } : {}),
    },
  }
  for (const key of keys) knownPeople.set(key, entry)
  return name
}

/** What the API has sent for this person (by login no, else by display name); null when nothing. */
export function knownPerson(name: string, loginNo?: number) {
  return (loginNo ? knownPeople.get(`l${loginNo}`) : undefined) ?? knownPeople.get(nameKey(name)) ?? null
}

const photoCache = new Map<number, Promise<string | null>>()

/** Displayable photo src (data URL); null when the employee has none. A missing photo shows initials. */
export function loadEmployeePhoto(empNo: number): Promise<string | null> {
  let pending = photoCache.get(empNo)
  if (!pending) {
    pending = getData(spectrumEndpoints.employees.photo(empNo))
      .then((data) => {
        const photo = asRecord(data)
        const dataUrl = pick(photo, ['dataUrl'])
        if (dataUrl) return dataUrl
        const base64 = pick(photo, ['base64'])
        return base64 ? `data:${pick(photo, ['contentType']) || 'image/jpeg'};base64,${base64}` : null
      })
      .catch(() => null)
    photoCache.set(empNo, pending)
  }
  return pending
}

export function __resetPeopleCacheForTests() {
  detailsCache.clear()
  knownPeople.clear()
  employeeCache.clear()
  photoCache.clear()
}
