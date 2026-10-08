import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { emptyBusinessEntityDraft } from './businessEntities'
import { parseCardText, parseVisionCard, readCardWithVision } from './businessCard'
import { mergeScannedCard } from '../pages/businessEntities/applyScannedCard'

const FILL = {
  countries: [{ countryNo: 1, countryName: 'India' }],
  locationTypes: [{ locationTypeNo: 4, locationTypeName: 'Office', isDefault: true }],
  timeZones: [{ timeZoneNo: 5, timeZoneName: 'India Standard Time', countryNo: 1 }],
}

describe('business card reading', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('sends the image with the extraction schema and returns the model text', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: ' {"full_name":"Ravi"} ' }] } }] }), { status: 200 }))
    await expect(readCardWithVision(new Blob(['img'], { type: 'image/jpeg' }))).resolves.toBe('{"full_name":"Ravi"}')
    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/utility/google-vision/images/annotate')
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/jpeg', data: btoa('img') })
    expect(body.generationConfig.response_schema.required).toEqual(['full_name'])
  })

  it('parses the model JSON, fenced or bare', () => {
    expect(parseVisionCard('```json\n{"full_name":"Ravi Kumar","job_title":"CFO","phone_numbers":["+91 98200 00000","022 1234"],"postal_code":400001}\n```')).toMatchObject({
      name: 'Ravi Kumar', designation: 'CFO', phone: '+91 98200 00000', zipCode: '400001',
    })
    expect(parseVisionCard('not json')).toEqual({})
  })

  it('parses raw OCR text by patterns and line heuristics', () => {
    const card = parseCardText([
      'Ravi Kumar',
      'Purchase Manager',
      'Tata Steel Limited',
      'ravi.kumar@tatasteel.com',
      'Tel: +91 98200 12345',
      'www.tatasteel.com',
      'Bombay House, 24 Homi Mody Street',
      'Mumbai 400001',
    ].join('\n'))
    expect(card).toMatchObject({
      name: 'Ravi Kumar',
      designation: 'Purchase Manager',
      company: 'Tata Steel Limited',
      email: 'ravi.kumar@tatasteel.com',
      phone: '+91 98200 12345',
      website: 'www.tatasteel.com',
    })
    expect(card.address).toContain('Bombay House')
  })
})

describe('applying a scanned card', () => {
  it('fills only empty fields', () => {
    const draft = { ...emptyBusinessEntityDraft(), website: 'old.com' }
    const { draft: next, placeForPrimary } = mergeScannedCard(draft, {
      company: 'Tata Steel', website: 'tata.com, tatasteel.in', name: 'Ravi', phone: '111', email: 'r@t.com',
      address: 'Bombay House', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400001',
    }, FILL)
    expect(next.name).toBe('Tata Steel')
    expect(next.website).toBe('old.com')
    expect(next.primaryContact).toMatchObject({ name: 'Ravi', phone: '111', email: 'r@t.com' })
    expect(next.primaryLocation).toMatchObject({ address: 'Bombay House', pinCode: '400001' })
    expect(placeForPrimary).toEqual({ city: 'Mumbai', state: 'Maharashtra', country: 'India' })
  })

  it('keeps another person and address as extra contact and location', () => {
    const base = emptyBusinessEntityDraft()
    const draft = {
      ...base,
      primaryContact: { ...base.primaryContact, name: 'Asha' },
      primaryLocation: { ...base.primaryLocation, address: 'Plant 1' },
    }
    const { draft: next, placeForPrimary } = mergeScannedCard(draft, { name: 'Ravi', phone: '111', address: 'Bombay House', country: 'India' }, FILL)
    expect(next.primaryContact.name).toBe('Asha')
    expect(next.contacts).toEqual([expect.objectContaining({ name: 'Ravi', phone: '111', contactPersonNo: null })])
    expect(next.locations).toEqual([
      expect.objectContaining({ address: 'Bombay House', countryNo: '1', countryName: 'India', locationTypeNo: '4', timeZoneNo: '5' }),
    ])
    expect(placeForPrimary).toBeNull()
  })
})
