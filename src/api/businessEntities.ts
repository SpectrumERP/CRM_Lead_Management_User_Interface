/**
 * Spectrum business entities: searches (Business Entity field on lead / opportunity forms, and the
 * Business Entities list), plus load / save / delete for the entity form.
 *
 *   GET    /api/master/business-entities/search/business-entity-wise?KeywordSearch=tata&PageSize=50
 *   GET    /api/master/business-entities/search/contact-person-wise   (list "Contact" views)
 *   GET    /api/master/business-entities/search/attachment-wise       (list "Attachments" view)
 *   GET    /api/master/business-entities/load-data/{businessEntityNo}?companyNo=
 *   POST   /api/master/business-entities/save   (insert: every contact person; update: the primary only)
 *   DELETE /api/master/business-entities/delete?businessEntityNo=
 *   POST   /api/master/business-entities/save-contact-person   (one other contact of a saved entity)
 *   DELETE /api/master/business-entities/delete-contact-person?businessEntityContactPersonDetailNo=
 *   GET    /api/master/business-entities?BusinessEntityName=           (names, for the duplicate hint)
 *
 * Search paging is cursor-based (`Direction` + `CursorRowNo` + `PageSize`), and page info sits at the
 * top level next to `data`, not inside it. The company comes from the token, so none is sent.
 */
import type { Attachment } from './attachments'
import { attachmentLinks } from './attachments'
import type { BusinessEntityFillValues } from './businessEntityFillValues'
import { spectrumEndpoints } from './endpoints'
import { fail } from './errors'
import { assertCompanyNo, assertSuccess, type SpectrumResponse } from './fillValues'
import { toNo } from './geo'
import { http } from './http'
import { withQuery } from './query'
import { isEmail } from './sanitize'

export interface BusinessEntityRow {
  businessEntityNo: number
  code: string
  businessEntityName: string
  businessEntityTypeName: string | null
  crmTimeZoneNo: number | null
  crmTimeZoneName: string | null
  vatgstNo: string | null
  creditInsuranceLimit: number | null
  locationNo: number | null
  locationTypeNo: number | null
  address: string | null
  countryNo: number | null
  countryName: string | null
  stateNo: number | null
  stateName: string | null
  cityNo: number | null
  cityName: string | null
  pinCode: string | null
  createdBy: number | null
  userName: string | null
  displayName: string | null
  createdDate: string | null
}

/** Paging fields returned alongside `data`. */
export interface PagedFields {
  /** First letters present in the result set (for A–Z filters). */
  alphabets: string[]
  pageSize: number
  totalRecords: number
  totalPages: number
  firstRowNo: number
  lastRowNo: number
}

export type BusinessEntitySearchResponse = Partial<SpectrumResponse<BusinessEntityRow[] | null>> &
  Pick<SpectrumResponse<unknown>, 'success' | 'message'> &
  Partial<PagedFields>

export interface BusinessEntityPage extends PagedFields {
  items: BusinessEntityRow[]
}

export interface BusinessEntitySearch {
  /** Free text across the entity's fields — what the form dropdown sends as the user types. */
  keywordSearch?: string
  /** First-letter filter, one of the returned `alphabets`. */
  startsWith?: string
  code?: string
  businessEntityName?: string
  timeZone?: string
  address?: string
  countryName?: string
  stateName?: string
  cityName?: string
  /** Cursor paging: direction from `cursorRowNo` (e.g. the previous page's `lastRowNo` / `firstRowNo`). */
  direction?: string
  cursorRowNo?: number
  pageSize?: number
}

export const BUSINESS_ENTITY_PAGE_SIZE = 50

/** API query parameter name for each search field. */
const PARAMS: Record<keyof BusinessEntitySearch, string> = {
  keywordSearch: 'KeywordSearch',
  startsWith: 'StartsWith',
  code: 'Code',
  businessEntityName: 'BusinessEntityName',
  timeZone: 'TimeZone',
  address: 'Address',
  countryName: 'CountryName',
  stateName: 'StateName',
  cityName: 'CityName',
  direction: 'Direction',
  cursorRowNo: 'CursorRowNo',
  pageSize: 'PageSize',
}

/** One page of any business entity search (entity-, contact- or attachment-wise). */
export interface SearchPage<T> extends PagedFields {
  items: T[]
}

async function pagedSearch<T>(path: string, input: BusinessEntitySearch): Promise<SearchPage<T>> {
  const pageSize = input.pageSize ?? BUSINESS_ENTITY_PAGE_SIZE
  const query: Record<string, string | number | undefined> = {}
  for (const key of Object.keys(PARAMS) as (keyof BusinessEntitySearch)[]) {
    const value = key === 'pageSize' ? pageSize : input[key]
    query[PARAMS[key]] = typeof value === 'string' ? value.trim() || undefined : value
  }
  const response = await http.get<Partial<SpectrumResponse<T[] | null>> & Pick<SpectrumResponse<unknown>, 'success' | 'message'> & Partial<PagedFields>>(
    withQuery(path, query),
  )
  assertSuccess(response as SpectrumResponse<unknown>)
  const items = response.data ?? []
  return {
    items,
    alphabets: response.alphabets ?? [],
    pageSize: response.pageSize ?? pageSize,
    totalRecords: response.totalRecords ?? items.length,
    totalPages: response.totalPages ?? 1,
    firstRowNo: response.firstRowNo ?? (items.length ? 1 : 0),
    lastRowNo: response.lastRowNo ?? items.length,
  }
}

export function searchBusinessEntities(input: BusinessEntitySearch = {}): Promise<BusinessEntityPage> {
  return pagedSearch<BusinessEntityRow>(spectrumEndpoints.businessEntities.search, input)
}

/** Row of the contact-person-wise search: one per contact, with its entity. */
export interface BusinessEntityContactRow {
  businessEntityContactPersonDetailNo: number
  businessEntityNo: number
  businessEntityName: string | null
  code: string | null
  businessEntityTypeName?: string | null
  contactPersonName: string | null
  designation: string | null
  department: string | null
  email: string | null
  phoneNo?: string | null
  status?: string | null
  cityName?: string | null
  stateName?: string | null
  countryName?: string | null
}

/** Row of the attachment-wise search: one per file, with its entity. */
export interface BusinessEntityAttachmentRow {
  attachmentNo: number
  businessEntityNo: number
  businessEntityName: string | null
  code: string | null
  businessEntityTypeName?: string | null
  fileName: string | null
  fileSize: number | null
  fileType: string | null
  status?: string | null
}

export function searchBusinessEntityContacts(input: BusinessEntitySearch = {}): Promise<SearchPage<BusinessEntityContactRow>> {
  return pagedSearch<BusinessEntityContactRow>(spectrumEndpoints.businessEntities.searchContactWise, input)
}

export function searchBusinessEntityAttachments(input: BusinessEntitySearch = {}): Promise<SearchPage<BusinessEntityAttachmentRow>> {
  return pagedSearch<BusinessEntityAttachmentRow>(spectrumEndpoints.businessEntities.searchAttachmentWise, input)
}

/** "Mumbai, Maharashtra" style location line for option rows. */
export function businessEntityLocation(row: Pick<BusinessEntityRow, 'cityName' | 'stateName' | 'countryName'>) {
  return [row.cityName, row.stateName].filter(Boolean).join(', ') || row.countryName || ''
}

// ─── Contact persons ──────────────────────────────────────────────────────────

/**
 * Contact persons of one business entity.
 *
 *   GET /api/master/business-entities/contact-persons?BusinessEntityNo=3&KeywordSearch=roberto
 */
export interface ContactPersonRow {
  businessEntityContactPersonDetailNo: number
  businessEntityNo: number
  contactPersonName: string
  email: string | null
  designation: string | null
  businessEntityName: string | null
  code: string | null
  businessEntityTypeName: string | null
}

export interface ContactPersonSearch {
  businessEntityNo: number
  /** Free text, sent as the user types in the Contact Person dropdown. */
  keywordSearch?: string
  /** Load one specific contact. */
  contactPersonDetailNo?: number
}

export async function searchContactPersons(input: ContactPersonSearch): Promise<ContactPersonRow[]> {
  if (!Number.isInteger(input.businessEntityNo) || input.businessEntityNo < 1) {
    fail('VALIDATION', 'Business entity must be a positive number.')
  }
  const url = withQuery(spectrumEndpoints.businessEntities.contactPersons, {
    KeywordSearch: input.keywordSearch?.trim() || undefined,
    BusinessEntityNo: input.businessEntityNo,
    BusinessEntityContactPersonDetailNo: input.contactPersonDetailNo,
  })
  const response = await http.get<SpectrumResponse<ContactPersonRow[] | null>>(url)
  assertSuccess(response)
  return response.data ?? []
}

// ─── Entity record (form) ─────────────────────────────────────────────────────

/** Field limits the save API enforces. */
export const BUSINESS_ENTITY_LIMITS = {
  name: 100,
  website: 2000,
  vatgstNo: 30,
  creditInsuranceCompanyName: 100,
  contactName: 100,
  designation: 100,
  phone: 20,
  email: 100,
  pinCode: 10,
  mapUrl: 2000,
  coordinate: 15,
  followUpNote: 1000,
} as const

export type ContactStatus = 'Active' | 'Inactive'

/** A location as the form keeps it. Select values are strings ('' = none). */
export interface LocationDraft {
  locationTypeNo: string
  address: string
  countryNo: string
  countryName: string
  stateNo: string
  stateName: string
  cityNo: string
  cityName: string
  pinCode: string
  mapUrl: string
  latitude: string
  longitude: string
  timeZoneNo: string
  timeZoneName: string
}

/** A contact person as the form keeps it. `contactPersonNo` is set once saved on the server. */
export interface ContactDraft {
  contactPersonNo: number | null
  name: string
  designation: string
  department: string
  phone: string
  email: string
  /** Read from the server; the save API has no status field, so it is not sent. */
  status: ContactStatus
}

export interface FollowUpNoteDraft {
  /** `YYYY-MM-DD` or ''. */
  date: string
  note: string
}

export interface BusinessEntityPort {
  portNo: number
  portName: string
}

export interface BusinessEntityDraft {
  businessEntityNo: number | null
  name: string
  typeNo: string
  /** "Contact Source": a lead source number, or '' (optional). */
  leadSourceNo: string
  website: string
  gstinTypeNo: string
  vatgstNo: string
  creditInsuranceLimit: string
  creditInsuranceCompanyName: string
  primaryContact: ContactDraft
  contacts: ContactDraft[]
  primaryLocation: LocationDraft
  locations: LocationDraft[]
  ports: BusinessEntityPort[]
  attachments: Attachment[]
  followUps: FollowUpNoteDraft[]
}

/** A loaded record: the draft plus read-only fields. */
export interface BusinessEntityDetail extends BusinessEntityDraft {
  businessEntityNo: number
  code: string
  createdBy: string | null
  createdDate: string | null
}

export function emptyLocation(locationTypeNo: number | null = null): LocationDraft {
  return {
    locationTypeNo: locationTypeNo ? String(locationTypeNo) : '',
    address: '',
    countryNo: '',
    countryName: '',
    stateNo: '',
    stateName: '',
    cityNo: '',
    cityName: '',
    pinCode: '',
    mapUrl: '',
    latitude: '',
    longitude: '',
    timeZoneNo: '',
    timeZoneName: '',
  }
}

export function emptyContact(): ContactDraft {
  return { contactPersonNo: null, name: '', designation: '', department: '', phone: '', email: '', status: 'Active' }
}

export function emptyBusinessEntityDraft(defaultLocationTypeNo: number | null = null): BusinessEntityDraft {
  return {
    businessEntityNo: null,
    name: '',
    typeNo: '',
    leadSourceNo: '',
    website: '',
    gstinTypeNo: '',
    vatgstNo: '',
    creditInsuranceLimit: '',
    creditInsuranceCompanyName: '',
    primaryContact: emptyContact(),
    contacts: [],
    primaryLocation: emptyLocation(defaultLocationTypeNo),
    locations: [],
    ports: [],
    attachments: [],
    followUps: [],
  }
}

/** Code shown for an entity: the server code, else `BE-{no}`. */
export function businessEntityCode(no: number, code?: string | null) {
  return code?.trim() || `BE-${no}`
}

type Raw = Record<string, unknown>

function obj(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : {}
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function noText(value: unknown): string {
  const no = toNo(value)
  return no ? String(no) : ''
}

function isPrimaryFlag(value: unknown) {
  return value === true || value === 'Y' || value === 'y'
}

function personName(value: unknown): string | null {
  if (typeof value === 'string') return value || null
  const user = obj(value)
  return text(user.displayName) || text(user.printingName) || text(user.userName) || text(user.loginId) || text(user.name) || null
}

/** `2026-09-29T00:00:00` → `2026-09-29`; anything unparseable → ''. */
function dateOnly(value: unknown): string {
  const raw = text(value)
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
  return match ? match[1] : ''
}

function locationFromRaw(raw: Raw): LocationDraft & { isPrimary: boolean } {
  const type = obj(raw.locationType)
  const country = obj(raw.country)
  const state = obj(raw.state)
  const city = obj(raw.city)
  const zone = obj(raw.timeZone)
  return {
    locationTypeNo: noText(type.addressTypeNo ?? type.locationTypeNo ?? raw.locationTypeNo),
    address: text(raw.address),
    countryNo: noText(country.countryNo ?? country.id ?? raw.countryNo),
    countryName: text(country.countryName ?? raw.countryName),
    stateNo: noText(state.stateNo ?? state.id ?? raw.stateNo),
    stateName: text(state.stateName ?? raw.stateName),
    cityNo: noText(city.cityNo ?? city.id ?? raw.cityNo),
    cityName: text(city.cityName ?? raw.cityName),
    pinCode: text(raw.pinCode),
    mapUrl: text(raw.mapUrl ?? raw.MapUrl),
    latitude: text(raw.latitude ?? raw.Latitude),
    longitude: text(raw.longitude ?? raw.Longitude),
    timeZoneNo: noText(zone.timeZoneNo ?? zone.crmTimeZoneNo ?? raw.crmTimeZoneNo),
    timeZoneName: text(zone.timeZoneName ?? zone.crmTimeZoneName),
    isPrimary: isPrimaryFlag(raw.isPrimary),
  }
}

function contactFromRaw(raw: Raw): ContactDraft & { isPrimary: boolean } {
  return {
    contactPersonNo: toNo(raw.businessEntityContactPersonDetailNo ?? raw.contactPersonNo),
    name: text(raw.contactPersonName),
    designation: text(raw.designation),
    department: text(raw.department),
    phone: text(raw.phoneNo ?? raw.phone),
    email: text(raw.email),
    status: /^inactive$/i.test(text(raw.status)) ? 'Inactive' : 'Active',
    isPrimary: isPrimaryFlag(raw.isPrimary),
  }
}

/** Primary first: the one flagged, else the first. */
function splitPrimary<T extends { isPrimary: boolean }>(items: T[]): { primary: T | undefined; others: T[] } {
  const primary = items.find((x) => x.isPrimary) ?? items[0]
  return { primary, others: items.filter((x) => x !== primary) }
}

function strip<T extends { isPrimary: boolean }>(item: T): Omit<T, 'isPrimary'> {
  const { isPrimary: _ignored, ...rest } = item
  return rest
}

/** Map a load-data record into the form's shape. */
export function businessEntityFromDetail(raw: Raw, attachments: Attachment[] = []): BusinessEntityDetail {
  const businessEntityNo = toNo(raw.businessEntityNo) ?? 0
  const locations = (Array.isArray(raw.locations) ? raw.locations : []).map((l) => locationFromRaw(obj(l)))
  const contacts = (Array.isArray(raw.contactPersons) ? raw.contactPersons : []).map((c) => contactFromRaw(obj(c)))
  const loc = splitPrimary(locations)
  const person = splitPrimary(contacts)
  const entityZone = obj(raw.timeZone)
  const gstinType = obj(raw.gstinType)

  const primaryLocation: LocationDraft = loc.primary ? strip(loc.primary) : emptyLocation()
  // Records saved before locations existed carry the address on the entity itself.
  if (!primaryLocation.address) primaryLocation.address = text(raw.address)
  if (!primaryLocation.pinCode) primaryLocation.pinCode = text(raw.pinCode)
  // …and before zones moved to locations, only the entity-level zone.
  if (!primaryLocation.timeZoneNo) {
    primaryLocation.timeZoneNo = noText(entityZone.timeZoneNo ?? entityZone.crmTimeZoneNo ?? raw.crmTimeZoneNo)
    primaryLocation.timeZoneName = text(entityZone.timeZoneName ?? entityZone.crmTimeZoneName)
  }

  const followUps: FollowUpNoteDraft[] = Array.isArray(raw.followUpDetails)
    ? raw.followUpDetails.map((n) => ({ date: dateOnly(obj(n).followUpDate), note: text(obj(n).followUpNotes) }))
    : text(raw.notes)
      ? [{ date: '', note: text(raw.notes) }]
      : []

  const ports: BusinessEntityPort[] = (Array.isArray(raw.ports) ? raw.ports : [])
    .map((p) => {
      const row = obj(p)
      const port = obj(row.port)
      return { portNo: toNo(port.portNo ?? port.portId ?? row.portNo) ?? 0, portName: text(port.portName ?? row.portName) }
    })
    .filter((p) => p.portNo > 0)

  return {
    businessEntityNo,
    code: businessEntityCode(businessEntityNo, text(raw.code)),
    name: text(raw.businessEntityName),
    typeNo: noText(obj(raw.businessEntityType).id ?? obj(raw.businessEntityType).operCRMBusinessEntityTypeNo ?? raw.crmBusinessEntityTypeNo),
    leadSourceNo: noText(obj(raw.leadSource).leadSourceNo ?? raw.leadSourceNo),
    website: text(raw.website),
    gstinTypeNo: noText(raw.gstinTypeNo ?? gstinType.id ?? gstinType.gstinTypeNo),
    vatgstNo: text(raw.vatgstNo),
    creditInsuranceLimit: typeof raw.creditInsuranceLimit === 'number' ? String(raw.creditInsuranceLimit) : '',
    creditInsuranceCompanyName: text(raw.creditInsuranceCompanyName),
    primaryContact: person.primary ? strip(person.primary) : emptyContact(),
    contacts: person.others.map(strip),
    primaryLocation,
    locations: loc.others.map(strip),
    ports,
    attachments,
    followUps,
    createdBy: personName(raw.createdBy),
    createdDate: text(raw.createdDate ?? raw.createdOn) || null,
  }
}

export async function loadBusinessEntity(businessEntityNo: number, companyNo: number): Promise<Raw> {
  if (!toNo(businessEntityNo)) fail('VALIDATION', 'Business entity must be a positive number.')
  assertCompanyNo(companyNo)
  const url = withQuery(`${spectrumEndpoints.businessEntities.loadData}/${businessEntityNo}`, { companyNo })
  const response = await http.get<SpectrumResponse<Raw | null>>(url)
  assertSuccess(response)
  if (!response.data) fail('NOT_FOUND', 'This business entity no longer exists.')
  return response.data
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export interface BusinessEntitySaveContact {
  businessEntityContactPersonDetailNo: number | null
  contactPersonName: string
  address: string
  countryNo: number | null
  stateNo: number | null
  cityNo: number | null
  pinCode: string
  phoneNo: string
  email: string
  designation: string
  department: string
  isPrimary: boolean
}

export interface BusinessEntitySaveLocation {
  locationTypeNo: number | null
  address: string
  countryNo: number | null
  stateNo: number | null
  cityNo: number | null
  pinCode: string
  mapUrl: string
  latitude: number | null
  longitude: number | null
  crmTimeZoneNo: number | null
  isPrimary: boolean
}

export interface BusinessEntitySaveBody {
  businessEntityNo: number | null
  businessEntityName: string
  crmBusinessEntityTypeNo: number
  /** "Contact Source" (a lead source); null when not chosen. */
  leadSourceNo: number | null
  /** Kept equal to the primary location's zone; the list still reads it from the entity. */
  crmTimeZoneNo: number | null
  gstinTypeNo: number | null
  vatgstNo: string | null
  creditInsuranceLimit: number | null
  creditInsuranceCompanyName: string | null
  website: string | null
  contactPersons: BusinessEntitySaveContact[]
  locations: BusinessEntitySaveLocation[]
  ports: { portNo: number }[]
  attachment: { docNo: number }[]
  followUpDetails: { followUpNotes: string; followUpDate: string | null }[]
}

/**
 * Field errors, keyed by form field: `name`, `typeNo`, `vatgstNo`, `website`, `creditInsuranceLimit`,
 * `primaryContact.name|phone|email`, `primaryLocation.address|pinCode|latitude|longitude`,
 * `contacts.{i}`, `locations.{i}`.
 */
export type BusinessEntityDraftErrors = Record<string, string>

function decimal(value: string): number | null | 'invalid' {
  const raw = value.trim()
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : 'invalid'
}

/** Contact checks shared by the primary contact and the contact pop-up. */
export function contactErrors(contact: ContactDraft, { emailRequired }: { emailRequired: boolean }): Record<string, string> {
  const errors: Record<string, string> = {}
  const L = BUSINESS_ENTITY_LIMITS
  if (!contact.name.trim()) errors.name = 'Contact person name is required'
  else if (contact.name.trim().length > L.contactName) errors.name = `Maximum ${L.contactName} characters`
  if (!contact.phone.trim()) errors.phone = 'Phone number is required'
  else if (contact.phone.trim().length > L.phone) errors.phone = `Maximum ${L.phone} characters`
  const email = contact.email.trim()
  if (!email) {
    if (emailRequired) errors.email = 'Email address is required'
  } else if (email.length > L.email || !isEmail(email)) {
    errors.email = 'Please enter a valid email address'
  }
  if (contact.designation.trim().length > L.designation) errors.designation = `Maximum ${L.designation} characters`
  return errors
}

/** Location checks shared by the primary location and the location pop-up. */
export function locationErrors(location: LocationDraft, { typeRequired }: { typeRequired: boolean }): Record<string, string> {
  const errors: Record<string, string> = {}
  const L = BUSINESS_ENTITY_LIMITS
  if (typeRequired && !toNo(location.locationTypeNo)) errors.locationTypeNo = 'Location type is required'
  if (!location.address.trim()) errors.address = 'Address is required'
  if (location.pinCode.trim().length > L.pinCode) errors.pinCode = `Maximum ${L.pinCode} characters`
  if (location.mapUrl.trim().length > L.mapUrl) errors.mapUrl = `Maximum ${L.mapUrl} characters`
  const lat = decimal(location.latitude)
  if (lat === 'invalid' || (typeof lat === 'number' && Math.abs(lat) > 90)) errors.latitude = 'Latitude must be a number from -90 to 90'
  const lng = decimal(location.longitude)
  if (lng === 'invalid' || (typeof lng === 'number' && Math.abs(lng) > 180)) errors.longitude = 'Longitude must be a number from -180 to 180'
  return errors
}

function saveLocation(location: LocationDraft, isPrimary: boolean, fallbackTypeNo: number | null): BusinessEntitySaveLocation {
  const lat = decimal(location.latitude)
  const lng = decimal(location.longitude)
  return {
    locationTypeNo: toNo(location.locationTypeNo) ?? fallbackTypeNo,
    address: location.address.trim(),
    countryNo: toNo(location.countryNo),
    stateNo: toNo(location.stateNo),
    cityNo: toNo(location.cityNo),
    pinCode: location.pinCode.trim(),
    mapUrl: location.mapUrl.trim(),
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lng === 'number' ? lng : null,
    crmTimeZoneNo: toNo(location.timeZoneNo),
    isPrimary,
  }
}

function saveContact(contact: ContactDraft, isPrimary: boolean): BusinessEntitySaveContact {
  return {
    businessEntityContactPersonDetailNo: contact.contactPersonNo,
    contactPersonName: contact.name.trim(),
    address: '',
    countryNo: null,
    stateNo: null,
    cityNo: null,
    pinCode: '',
    phoneNo: contact.phone.trim(),
    email: contact.email.trim(),
    designation: contact.designation.trim(),
    department: contact.department.trim(),
    isPrimary,
  }
}

/**
 * Validate the draft and build the save body. Returns the body, or the fields to fix.
 * `fill` resolves the default location type for the primary location (its type field is hidden).
 */
export function buildBusinessEntitySaveBody(
  draft: BusinessEntityDraft,
  fill: Pick<BusinessEntityFillValues, 'locationTypes'>,
): { body: BusinessEntitySaveBody; errors?: undefined } | { body?: undefined; errors: BusinessEntityDraftErrors } {
  const errors: BusinessEntityDraftErrors = {}
  const L = BUSINESS_ENTITY_LIMITS
  const name = draft.name.trim()
  if (!name) errors.name = 'Business entity name is required'
  else if (name.length > L.name) errors.name = `Maximum ${L.name} characters`
  const typeNo = toNo(draft.typeNo)
  if (!typeNo) errors.typeNo = 'Business entity type is required'
  if (draft.website.trim().length > L.website) errors.website = `Maximum ${L.website} characters`
  if (toNo(draft.gstinTypeNo) && !draft.vatgstNo.trim()) errors.vatgstNo = 'Tax Document No. is required for the selected tax document type'
  else if (draft.vatgstNo.trim().length > L.vatgstNo) errors.vatgstNo = `Maximum ${L.vatgstNo} characters`
  const limit = decimal(draft.creditInsuranceLimit)
  if (limit === 'invalid' || (typeof limit === 'number' && limit < 0)) errors.creditInsuranceLimit = 'Enter an amount of 0 or more'
  if (draft.creditInsuranceCompanyName.trim().length > L.creditInsuranceCompanyName) {
    errors.creditInsuranceCompanyName = `Maximum ${L.creditInsuranceCompanyName} characters`
  }

  for (const [key, message] of Object.entries(contactErrors(draft.primaryContact, { emailRequired: false }))) {
    errors[`primaryContact.${key}`] = message
  }
  for (const [key, message] of Object.entries(locationErrors(draft.primaryLocation, { typeRequired: false }))) {
    errors[`primaryLocation.${key}`] = message
  }
  draft.contacts.forEach((contact, i) => {
    const first = Object.values(contactErrors(contact, { emailRequired: true }))[0]
    if (first) errors[`contacts.${i}`] = `Contact "${contact.name.trim() || i + 1}": ${first}`
  })
  draft.locations.forEach((location, i) => {
    const first = Object.values(locationErrors(location, { typeRequired: true }))[0]
    if (first) errors[`locations.${i}`] = `Location ${i + 1}: ${first}`
  })
  draft.followUps.forEach((note, i) => {
    if (!note.note.trim()) errors[`followUps.${i}`] = `Follow-up note ${i + 1} is empty`
  })

  if (Object.keys(errors).length) return { errors }

  const defaultTypeNo = (fill.locationTypes.find((t) => t.isDefault) ?? fill.locationTypes[0])?.locationTypeNo ?? null
  const primaryLocation = saveLocation(draft.primaryLocation, true, defaultTypeNo)
  const businessEntityNo = draft.businessEntityNo && draft.businessEntityNo > 0 ? draft.businessEntityNo : null
  // A new entity is saved with all its contacts. An update carries the primary contact only: other contacts
  // are saved / removed straight away (save-contact-person / delete-contact-person).
  const primaryContact = saveContact(draft.primaryContact, true)
  const body: BusinessEntitySaveBody = {
    businessEntityNo,
    businessEntityName: name,
    crmBusinessEntityTypeNo: typeNo!,
    leadSourceNo: toNo(draft.leadSourceNo),
    crmTimeZoneNo: primaryLocation.crmTimeZoneNo,
    gstinTypeNo: toNo(draft.gstinTypeNo),
    vatgstNo: draft.vatgstNo.trim() || null,
    creditInsuranceLimit: typeof limit === 'number' ? limit : null,
    creditInsuranceCompanyName: draft.creditInsuranceCompanyName.trim() || null,
    website: draft.website.trim() || null,
    contactPersons: businessEntityNo ? [primaryContact] : [primaryContact, ...draft.contacts.map((c) => saveContact(c, false))],
    locations: [primaryLocation, ...draft.locations.map((l) => saveLocation(l, false, null))],
    ports: draft.ports.filter((p, i, all) => p.portNo > 0 && all.findIndex((x) => x.portNo === p.portNo) === i).map((p) => ({ portNo: p.portNo })),
    attachment: attachmentLinks(draft.attachments),
    followUpDetails: draft.followUps.map((n) => ({ followUpNotes: n.note.trim(), followUpDate: n.date || null })),
  }
  return { body }
}

/** Insert (no `businessEntityNo`) or update. Returns the entity number. */
export async function saveBusinessEntity(body: BusinessEntitySaveBody): Promise<number> {
  const response = await http.post<SpectrumResponse<Raw | number | null>>(spectrumEndpoints.businessEntities.save, body)
  assertSuccess(response)
  const data = response.data
  return toNo(typeof data === 'number' ? data : obj(data).businessEntityNo) ?? body.businessEntityNo ?? 0
}

export async function deleteBusinessEntity(businessEntityNo: number): Promise<void> {
  if (!toNo(businessEntityNo)) fail('VALIDATION', 'Business entity must be a positive number.')
  const url = withQuery(spectrumEndpoints.businessEntities.delete, { businessEntityNo })
  assertSuccess(await http.delete<SpectrumResponse<unknown>>(url))
}

/** Adds (no `contactPersonNo`) or updates a non-primary contact of a saved entity straight away. */
export async function saveBusinessEntityContact(businessEntityNo: number, contact: ContactDraft): Promise<void> {
  if (!toNo(businessEntityNo)) fail('VALIDATION', 'Business entity must be a positive number.')
  const response = await http.post<SpectrumResponse<boolean>>(spectrumEndpoints.businessEntities.saveContactPerson, {
    ...saveContact(contact, false),
    businessEntityNo,
  })
  assertSuccess(response)
  if (response.data === false) fail('VALIDATION', 'The server did not save the contact person.')
}

/** Removes a saved contact person straight away (unsaved ones only live in the form). */
export async function deleteBusinessEntityContact(contactPersonDetailNo: number): Promise<void> {
  if (!toNo(contactPersonDetailNo)) fail('VALIDATION', 'Contact person must be a positive number.')
  const url = withQuery(spectrumEndpoints.businessEntities.deleteContactPerson, {
    businessEntityContactPersonDetailNo: contactPersonDetailNo,
  })
  assertSuccess(await http.delete<SpectrumResponse<unknown>>(url))
}

/** Existing entity names containing `name` — shown while typing so users spot duplicates. */
export async function findBusinessEntityNames(name: string, signal?: AbortSignal): Promise<string[]> {
  const query = name.trim()
  if (query.length < 2) return []
  const url = withQuery(spectrumEndpoints.businessEntities.names, { BusinessEntityName: query.slice(0, BUSINESS_ENTITY_LIMITS.name) })
  const response = await http.get<SpectrumResponse<Raw[] | null> | Raw[]>(url, { signal })
  const rows = Array.isArray(response) ? response : response?.success === false ? [] : (response?.data ?? [])
  const names = rows.map((row) => text(row.businessEntityName ?? row.BusinessEntityName ?? row.name).trim()).filter(Boolean)
  return names.filter((n, i) => names.indexOf(n) === i)
}

/** An entity name for comparing: case, accents, punctuation and spacing ignored ("Verdés S.A." = "verdes sa"). */
export function entityNameKey(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * The name in `names` that is the same as `name` (see entityNameKey), or null. `exclude`: the entity
 * being edited, which is not a duplicate of itself.
 */
export function duplicateEntityName(names: readonly string[], name: string, exclude?: string): string | null {
  const key = entityNameKey(name)
  if (!key || (exclude && entityNameKey(exclude) === key)) return null
  return names.find((existing) => entityNameKey(existing) === key) ?? null
}

/** The existing entity with the same name as `name`, or null (see duplicateEntityName). */
export async function findDuplicateEntityName(name: string, { exclude, signal }: { exclude?: string; signal?: AbortSignal } = {}): Promise<string | null> {
  if (!duplicateEntityName([name], name, exclude)) return null
  return duplicateEntityName(await findBusinessEntityNames(name, signal), name, exclude)
}
