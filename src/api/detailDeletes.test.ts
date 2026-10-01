import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetAuthStoreForTests } from './authStore'
import { deleteLeadActivities, deleteLeadNotes } from './leads'
import { deleteOpportunityActivities } from './opportunities'

describe('activity / note delete APIs', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ success: true, message: '', data: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  function lastCall() {
    const [url, init] = fetchMock.mock.calls.at(-1)!
    return { url: new URL(String(url)), method: init.method }
  }

  it('sends the detail numbers as repeated query keys with DELETE', async () => {
    await deleteLeadActivities([4, 9])
    expect(lastCall().method).toBe('DELETE')
    expect(lastCall().url.pathname).toBe('/api/crm/leads/delete-activity-detail')
    expect(lastCall().url.searchParams.getAll('leadActivityDetailNos')).toEqual(['4', '9'])

    await deleteLeadNotes([7])
    expect(lastCall().url.pathname).toBe('/api/crm/leads/delete-notes-detail')
    expect(lastCall().url.searchParams.getAll('leadNotesDetailNos')).toEqual(['7'])

    await deleteOpportunityActivities([12])
    expect(lastCall().url.pathname).toBe('/api/crm/opportunities/delete-activity-detail')
    expect(lastCall().url.searchParams.getAll('opportunityActivityDetailNos')).toEqual(['12'])
  })

  it('does nothing for an empty list', async () => {
    await deleteOpportunityActivities([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces a server refusal', async () => {
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ success: false, message: 'Activity is closed', data: false }), { status: 200 }))
    await expect(deleteOpportunityActivities([3])).rejects.toMatchObject({ message: 'Activity is closed' })
  })
})
