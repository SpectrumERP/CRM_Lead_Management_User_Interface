import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { fetchTimelinePage, timelineFromRows, TIMELINE_PAGE_SIZE } from './timeline'

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

const rows = [
  { title: 'Lead Created', description: 'Janna Good', timelineType: 'LeadCreated', timelineTypeNo: 1, actionDate: '2026-09-30T16:02:00Z', createdBy: { loginNo: 1, loginId: 'edp', printingName: 'EDP TEMP' } },
  { title: 'Lead Status', description: 'Open', timelineType: 'LeadStatus', timelineTypeNo: 2, actionDate: '2026-09-30T16:02:00Z', createdBy: { loginNo: 1, loginId: 'edp' } },
  { title: null, description: null, timelineType: 'Activity', timelineTypeNo: 4, actionDate: null, createdBy: null },
]

describe('timelineFromRows', () => {
  it('keeps the rows in the order the server sent them', () => {
    expect(timelineFromRows(rows)).toEqual([
      { title: 'Lead Created', description: 'Janna Good', type: 'LeadCreated', typeNo: 1, at: '2026-09-30T16:02:00Z', by: 'EDP TEMP' },
      { title: 'Lead Status', description: 'Open', type: 'LeadStatus', typeNo: 2, at: '2026-09-30T16:02:00Z', by: 'edp' },
      // No title → the type; no date / user → empty.
      { title: 'Activity', description: '', type: 'Activity', typeNo: 4, at: '', by: '' },
    ])
  })
})

describe('fetchTimelinePage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('asks for one page of 20 of a lead timeline', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: '', data: rows, pageNo: 1, pageSize: 20, totalRecords: 45, totalPages: 3 }))
    const page = await fetchTimelinePage('lead', 40, { pageNo: 1 })
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/crm/leads/timeline/40')
    expect(url.searchParams.get('PageNo')).toBe('1')
    expect(url.searchParams.get('PageSize')).toBe(String(TIMELINE_PAGE_SIZE))
    expect(url.searchParams.has('TimelineTypeNo')).toBe(false)
    expect(url.searchParams.has('SortingType')).toBe(false)
    expect(page).toMatchObject({ pageNo: 1, totalPages: 3, totalRecords: 45 })
    expect(page.entries).toHaveLength(3)
  })

  it('filters by type and sorts newest first on an opportunity timeline', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: '', data: [], pageNo: 2, pageSize: 20, totalRecords: 21, totalPages: 2 }))
    await fetchTimelinePage('opportunity', 38, { pageNo: 2, timelineTypeNo: 4, order: 'newest' })
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/crm/opportunities/timeline/38')
    expect(url.searchParams.get('PageNo')).toBe('2')
    expect(url.searchParams.get('TimelineTypeNo')).toBe('4')
    expect(url.searchParams.get('SortingColumnName')).toBe('ActionDate')
    expect(url.searchParams.get('SortingType')).toBe('DESC')
  })

  it('treats a short page as the last when the server sends no totals', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: '', data: rows }))
    const page = await fetchTimelinePage('lead', 40, { pageNo: 3 })
    expect(page.totalPages).toBe(3)
  })
})
