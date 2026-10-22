import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { emptyBusinessEntityDraft } from './businessEntities'
import { parseCardText, parseVisionCard, readCardWithVision, scanBusinessCard } from './businessCard'
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

  it.each([
    ['an HTTP error', new Response(JSON.stringify({ message: 'Vision quota exceeded.' }), { status: 500 }), 'Vision quota exceeded.'],
    ['the model error in a 200', new Response(JSON.stringify({ error: { code: 503, message: 'The model is overloaded.' } }), { status: 200 }), 'The model is overloaded.'],
    ['a failure envelope in a 200', new Response(JSON.stringify({ success: false, message: 'Image too large.' }), { status: 200 }), 'Image too large.'],
    ['a blocked image', new Response(JSON.stringify({ promptFeedback: { blockReason: 'OTHER' } }), { status: 200 }), 'could not process this image'],
    ['no result', new Response(JSON.stringify({}), { status: 200 }), 'returned no result'],
  ])('rejects %s with a message for the user', async (_, response, message) => {
    fetchMock.mockResolvedValue(response)
    await expect(readCardWithVision(new Blob(['img'], { type: 'image/jpeg' }))).rejects.toThrow(message)
  })

  it('returns empty text when the model read nothing', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }), { status: 200 }))
    await expect(readCardWithVision(new Blob(['img'], { type: 'image/jpeg' }))).resolves.toBe('')
  })

  it('scans with the business-card API and maps its fields', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      success: true,
      data: {
        personName: 'Sergi Conesa', designation: 'Sales Area Manager', organization: 'Verdés',
        phoneNumber: ['', '+34 607 164 143', '+34 93 846 04 96'], email: ['sconesa@verdes.com'],
        website: ['www.verdes.com/briquetting', 'verdes.es'], address: ['c/ Metal·lúrgia, 1'],
        country: ['Spain'], state: null, city: ['Barcelona'], qrCode: false,
      },
    }), { status: 200 }))
    const { data, text } = await scanBusinessCard(new Blob(['img'], { type: 'image/png' }))
    expect(data).toMatchObject({
      name: 'Sergi Conesa', designation: 'Sales Area Manager', company: 'Verdés', phone: '+34 607 164 143',
      email: 'sconesa@verdes.com', website: 'www.verdes.com/briquetting, verdes.es', address: 'c/ Metal·lúrgia, 1',
      city: 'Barcelona', state: '', country: 'Spain',
    })
    expect(text).toContain('Sergi Conesa')
    const [url, init] = fetchMock.mock.calls[0]
    expect(new URL(String(url)).pathname).toBe('/api/utility/google-vision/business-card/scan')
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ imageBase64: btoa('img'), mimeType: 'image/png' })
  })

  it.each([
    ['a 503', new Response(JSON.stringify({ success: false, error: 'Vision service is unavailable.' }), { status: 503 }), 'Vision service is unavailable.'],
    ['success: false in a 200', new Response(JSON.stringify({ success: false, message: 'Image could not be decoded.' }), { status: 200 }), 'Image could not be decoded.'],
  ])('rejects a scan failure (%s) with its message', async (_, response, message) => {
    fetchMock.mockResolvedValue(response)
    await expect(scanBusinessCard(new Blob(['img']))).rejects.toThrow(message)
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
