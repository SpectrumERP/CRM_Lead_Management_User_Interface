import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import {
  buildBusinessEntitySaveBody,
  businessEntityFromDetail,
  deleteBusinessEntity,
  deleteBusinessEntityContact,
  emptyBusinessEntityDraft,
  entityNameKey,
  findBusinessEntityNames,
  findDuplicateEntityName,
  loadBusinessEntity,
  saveBusinessEntity,
  saveBusinessEntityContact,
  searchBusinessEntityAttachments,
  searchBusinessEntityContacts,
  type BusinessEntityDraft,
} from './businessEntities'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1)!
  return { url: new URL(String(url)), init: init as RequestInit }
}

const FILL = { locationTypes: [{ locationTypeNo: 4, locationTypeName: 'Registered Office', isDefault: true }] }

function draft(overrides: Partial<BusinessEntityDraft> = {}): BusinessEntityDraft {
  const base = emptyBusinessEntityDraft()
  return {
    ...base,
    name: ' Tata Steel ',
    typeNo: '2',
    primaryContact: { ...base.primaryContact, name: 'Ravi', phone: '+91 98200 00000', email: 'ravi@tata.com' },
    primaryLocation: { ...base.primaryLocation, address: 'Bombay House', countryNo: '1', stateNo: '27', cityNo: '400', timeZoneNo: '5' },
    ...overrides,
  }
}

const DETAIL = {
  businessEntityNo: 12,
  code: 'BE0012',
  businessEntityName: 'Tata Steel',
  businessEntityType: { id: 2, name: 'Customer' },
  website: 'https://tata.com',
  gstinTypeNo: 3,
  vatgstNo: '27AAACT2727Q1ZW',
  creditInsuranceLimit: 50000,
  creditInsuranceCompanyName: 'ECGC',
  createdBy: { displayName: 'EDP' },
  createdDate: '2026-09-29T07:29:42.839Z',
  followUpDetails: [{ followUpDate: '2026-10-01T00:00:00', followUpNotes: 'Call back' }],
  locations: [
    { locationType: { addressTypeNo: 1 }, address: 'Plant 2', country: { countryNo: 1, countryName: 'India' }, isPrimary: false },
    {
      locationType: { addressTypeNo: 4 },
      address: 'Bombay House',
      country: { countryNo: 1, countryName: 'India' },
      state: { stateNo: 27, stateName: 'Maharashtra' },
      city: { cityNo: 400, cityName: 'Mumbai' },
      pinCode: '400001',
      latitude: 18.93,
      longitude: 72.83,
      timeZone: { timeZoneNo: 5, timeZoneName: 'India Standard Time' },
      isPrimary: 'Y',
    },
  ],
  contactPersons: [
    { contactPersonNo: 31, contactPersonName: 'Asha', phoneNo: '111', email: 'asha@tata.com', status: 'Inactive', isPrimary: false },
    { businessEntityContactPersonDetailNo: 30, contactPersonName: 'Ravi', phoneNo: '222', designation: 'CFO', isPrimary: true },
  ],
  ports: [{ port: { portName: 'Nhava Sheva', portId: 9 } }],
}

describe('business entity record', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('maps load-data into the form, splitting out the primary location and contact', () => {
    const detail = businessEntityFromDetail(DETAIL, [{ id: 77, name: 'card.jpg' }])
    expect(detail).toMatchObject({
      businessEntityNo: 12,
      code: 'BE0012',
      name: 'Tata Steel',
      typeNo: '2',
      gstinTypeNo: '3',
      creditInsuranceLimit: '50000',
      createdBy: 'EDP',
      followUps: [{ date: '2026-10-01', note: 'Call back' }],
      ports: [{ portNo: 9, portName: 'Nhava Sheva' }],
      attachments: [{ id: 77, name: 'card.jpg' }],
    })
    expect(detail.primaryLocation).toMatchObject({
      locationTypeNo: '4', address: 'Bombay House', countryNo: '1', stateName: 'Maharashtra', cityNo: '400',
      latitude: '18.93', timeZoneNo: '5', timeZoneName: 'India Standard Time',
    })
    expect(detail.locations).toHaveLength(1)
    expect(detail.locations[0].address).toBe('Plant 2')
    expect(detail.primaryContact).toMatchObject({ contactPersonNo: 30, name: 'Ravi', designation: 'CFO' })
    expect(detail.contacts).toEqual([
      { contactPersonNo: 31, name: 'Asha', designation: '', department: '', phone: '111', email: 'asha@tata.com', status: 'Inactive' },
    ])
  })

  it('falls back to the entity-level address and zone for old records without locations', () => {
    const detail = businessEntityFromDetail({ businessEntityNo: 5, businessEntityName: 'Old Co', address: 'Lane 1', pinCode: '1100', crmTimeZoneNo: 5 })
    expect(detail.code).toBe('BE-5')
    expect(detail.primaryLocation).toMatchObject({ address: 'Lane 1', pinCode: '1100', timeZoneNo: '5' })
  })

  it('saves a new entity with every contact person, primary first', () => {
    const body = buildBusinessEntitySaveBody(
      draft({
        contacts: [{ contactPersonNo: null, name: 'Asha', designation: '', department: '', phone: '111', email: 'asha@tata.com', status: 'Active' }],
      }),
      FILL,
    ).body!
    expect(body.businessEntityNo).toBeNull()
    expect(body.contactPersons.map((c) => [c.businessEntityContactPersonDetailNo, c.contactPersonName, c.isPrimary])).toEqual([
      [null, 'Ravi', true],
      [null, 'Asha', false],
    ])
  })

  it('builds the update body with the primary contact only and the primary location first', () => {
    const result = buildBusinessEntitySaveBody(
      draft({
        businessEntityNo: 12,
        website: ' tata.com ',
        creditInsuranceLimit: '2500.50',
        contacts: [{ contactPersonNo: 31, name: 'Asha', designation: '', department: '', phone: '111', email: 'asha@tata.com', status: 'Active' }],
        locations: [{ ...emptyBusinessEntityDraft().primaryLocation, locationTypeNo: '1', address: 'Plant 2', latitude: '18.9' }],
        ports: [{ portNo: 9, portName: 'Nhava Sheva' }, { portNo: 9, portName: 'Nhava Sheva' }],
        attachments: [{ id: 77, name: 'card.jpg' }],
        followUps: [{ date: '2026-10-01', note: ' Call back ' }, { date: '', note: 'Undated' }],
      }),
      FILL,
    )
    expect(result.errors).toBeUndefined()
    const body = result.body!
    expect(body).toMatchObject({
      businessEntityNo: 12,
      businessEntityName: 'Tata Steel',
      crmBusinessEntityTypeNo: 2,
      crmTimeZoneNo: 5,
      gstinTypeNo: null,
      vatgstNo: null,
      creditInsuranceLimit: 2500.5,
      website: 'tata.com',
      ports: [{ portNo: 9 }],
      attachment: [{ docNo: 77 }],
      followUpDetails: [
        { followUpNotes: 'Call back', followUpDate: '2026-10-01' },
        { followUpNotes: 'Undated', followUpDate: null },
      ],
    })
    // Other contacts are not resent on update (deleted / saved through their own APIs).
    expect(body.contactPersons.map((c) => [c.businessEntityContactPersonDetailNo, c.contactPersonName, c.isPrimary])).toEqual([
      [null, 'Ravi', true],
    ])
    // The primary location's type is hidden on the form: the default type is sent.
    expect(body.locations[0]).toMatchObject({ locationTypeNo: 4, countryNo: 1, stateNo: 27, cityNo: 400, crmTimeZoneNo: 5, latitude: null, isPrimary: true })
    expect(body.locations[1]).toMatchObject({ locationTypeNo: 1, address: 'Plant 2', latitude: 18.9, isPrimary: false })
  })

  it('returns the fields to fix instead of a body', () => {
    const result = buildBusinessEntitySaveBody(
      draft({
        name: '',
        typeNo: '',
        gstinTypeNo: '3',
        creditInsuranceLimit: '-1',
        primaryContact: { ...emptyBusinessEntityDraft().primaryContact, email: 'not-an-email' },
        primaryLocation: { ...emptyBusinessEntityDraft().primaryLocation, latitude: '91' },
        contacts: [{ contactPersonNo: null, name: 'Asha', designation: '', department: '', phone: '1', email: '', status: 'Active' }],
        locations: [{ ...emptyBusinessEntityDraft().primaryLocation, address: 'x' }],
      }),
      FILL,
    )
    expect(result.body).toBeUndefined()
    expect(result.errors).toMatchObject({
      name: 'Business entity name is required',
      typeNo: 'Business entity type is required',
      vatgstNo: 'VAT / GST No is required for the selected document type',
      creditInsuranceLimit: 'Enter an amount of 0 or more',
      'primaryContact.name': 'Contact person name is required',
      'primaryContact.phone': 'Phone number is required',
      'primaryContact.email': 'Please enter a valid email address',
      'primaryLocation.address': 'Address is required',
      'primaryLocation.latitude': 'Latitude must be a number from -90 to 90',
      'contacts.0': 'Contact "Asha": Email address is required',
      'locations.0': 'Location 1: Location type is required',
    })
  })

  it('loads, saves and deletes through the business entity routes', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: DETAIL }))
    await loadBusinessEntity(12, 3)
    let call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/business-entities/load-data/12')
    expect(call.url.searchParams.get('companyNo')).toBe('3')

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: 'Saved', data: { businessEntityNo: 44 } }))
    const body = buildBusinessEntitySaveBody(draft(), FILL).body!
    await expect(saveBusinessEntity(body)).resolves.toBe(44)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/business-entities/save')
    expect(call.init.method).toBe('POST')
    expect(JSON.parse(String(call.init.body)).businessEntityNo).toBeNull()

    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, message: 'Deleted', data: true }))
    await deleteBusinessEntity(44)
    call = lastCall(fetchMock)
    expect(call.init.method).toBe('DELETE')
    expect(call.url.pathname).toBe('/api/master/business-entities/delete')
    expect(call.url.searchParams.get('businessEntityNo')).toBe('44')

    await deleteBusinessEntityContact(31)
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/business-entities/delete-contact-person')
    expect(call.url.searchParams.get('businessEntityContactPersonDetailNo')).toBe('31')
  })

  it('saves one other contact of a saved entity through save-contact-person', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: 'Saved', data: true }))
    await saveBusinessEntityContact(12, { contactPersonNo: 31, name: ' Asha ', designation: 'CFO', department: '', phone: '111', email: 'asha@tata.com', status: 'Active' })
    const call = lastCall(fetchMock)
    expect(call.init.method).toBe('POST')
    expect(call.url.pathname).toBe('/api/master/business-entities/save-contact-person')
    expect(JSON.parse(String(call.init.body))).toMatchObject({
      businessEntityNo: 12,
      businessEntityContactPersonDetailNo: 31,
      contactPersonName: 'Asha',
      designation: 'CFO',
      phoneNo: '111',
      email: 'asha@tata.com',
      isPrimary: false,
    })

    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, message: '', data: false }))
    await expect(saveBusinessEntityContact(12, { ...emptyBusinessEntityDraft().primaryContact, name: 'New' })).rejects.toMatchObject({
      message: 'The server did not save the contact person.',
    })
  })

  it('surfaces a failed save as an error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: false, message: 'Name already exists' }))
    const body = buildBusinessEntitySaveBody(draft(), FILL).body!
    await expect(saveBusinessEntity(body)).rejects.toMatchObject({ message: 'Name already exists' })
  })

  it('searches contacts and attachments on their own routes with the A–Z filter and cursor', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(200, { success: true, message: '', data: [], alphabets: ['A'], firstRowNo: 21, lastRowNo: 40 }))
    const page = await searchBusinessEntityContacts({ startsWith: 'A', cursorRowNo: 20, direction: 'Next', pageSize: 20 })
    let call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/business-entities/search/contact-person-wise')
    expect(Object.fromEntries(call.url.searchParams)).toEqual({ StartsWith: 'A', CursorRowNo: '20', Direction: 'Next', PageSize: '20' })
    expect(page).toMatchObject({ alphabets: ['A'], firstRowNo: 21, lastRowNo: 40 })

    await searchBusinessEntityAttachments({ pageSize: 20 })
    call = lastCall(fetchMock)
    expect(call.url.pathname).toBe('/api/master/business-entities/search/attachment-wise')
  })

  it('suggests existing names from 2 characters, deduplicated', async () => {
    await expect(findBusinessEntityNames('T')).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValue(
      jsonResponse(200, { success: true, message: '', data: [{ businessEntityName: 'Tata Steel' }, { businessEntityName: 'Tata Steel' }, { businessEntityName: 'Tata Motors' }] }),
    )
    await expect(findBusinessEntityNames('Tata')).resolves.toEqual(['Tata Steel', 'Tata Motors'])
    const { url } = lastCall(fetchMock)
    expect(url.pathname).toBe('/api/master/business-entities')
    expect(url.searchParams.get('BusinessEntityName')).toBe('Tata')
  })

  it('compares entity names ignoring case, accents, punctuation and spacing', () => {
    expect(entityNameKey('Verdés S.A.')).toBe(entityNameKey('  verdes sa '))
    expect(entityNameKey('Tata Steel')).not.toBe(entityNameKey('Tata Steels'))
  })

  it('finds the existing entity with the same name, not one that only contains it', async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse(200, { success: true, message: '', data: [{ businessEntityName: 'Tata Steel Ltd' }, { businessEntityName: 'TATA STEEL' }] }),
    )
    await expect(findDuplicateEntityName('Tata Steel')).resolves.toBe('TATA STEEL')
    await expect(findDuplicateEntityName('Tata')).resolves.toBeNull()
  })

  it('does not report the entity being edited as its own duplicate', async () => {
    await expect(findDuplicateEntityName('Tata Steel', { exclude: 'TATA STEEL' })).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
