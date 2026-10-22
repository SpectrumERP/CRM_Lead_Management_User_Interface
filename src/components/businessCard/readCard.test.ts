import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from '../../api/authStore'
import { CardReaderError, readCard } from './readCard'

// OpenCV / Tesseract are only needed when the server readers read nothing.
vi.mock('./imaging', () => ({ loadOpenCv: vi.fn(), preprocessForOcr: vi.fn() }))

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const SCAN = '/api/utility/google-vision/business-card/scan'
const ANNOTATE = '/api/utility/google-vision/images/annotate'

describe('readCard', () => {
  const fetchMock = vi.fn()
  const paths = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    __resetAuthStoreForTests()
  })

  it('uses the business-card scan API when it reads the card', async () => {
    fetchMock.mockResolvedValueOnce(json({ success: true, data: { personName: 'Ravi', organization: 'Tata Steel' } }))
    const reading = await readCard(new Blob(['img']), () => undefined)
    expect(reading).toMatchObject({ source: 'server', data: { name: 'Ravi', company: 'Tata Steel' } })
    expect(paths()).toEqual([SCAN])
  })

  it('falls back to the vision API when the scan API fails', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ success: false, error: 'Vision service is unavailable.' }, 503))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: '{"full_name":"Ravi"}' }] } }] }))
    const reading = await readCard(new Blob(['img']), () => undefined)
    expect(reading).toMatchObject({ source: 'server', data: { name: 'Ravi' } })
    expect(paths()).toEqual([SCAN, ANNOTATE])
  })

  it('falls back to the vision API when the scan API reads nothing', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ success: true, data: { personName: null, email: [] } }))
      .mockResolvedValueOnce(json({ candidates: [{ content: { parts: [{ text: '{"full_name":"Ravi"}' }] } }] }))
    await expect(readCard(new Blob(['img']), () => undefined)).resolves.toMatchObject({ data: { name: 'Ravi' } })
    expect(paths()).toEqual([SCAN, ANNOTATE])
  })

  it('reports the first failure when both APIs fail', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ success: false, error: 'Vision service is unavailable.' }, 503))
      .mockResolvedValueOnce(json({ error: { message: 'The model is overloaded.' } }))
    const failure = readCard(new Blob(['img']), () => undefined)
    await expect(failure).rejects.toBeInstanceOf(CardReaderError)
    await expect(failure).rejects.toThrow('Vision service is unavailable.')
  })
})
