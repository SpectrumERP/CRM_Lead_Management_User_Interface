import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEAL_STAGES, DEAL_STAGE_WEIGHT, OPPORTUNITY_STATUSES } from '../data/opportunities'
import { __resetAuthStoreForTests } from './authStore'
import { bySequence, type SpectrumResponse } from './fillValues'
import sample from './fixtures/opportunity-form-fill-values.json'
import {
  fetchOpportunityFormFillValues,
  opportunityStageLabel,
  stageWeight,
  type OpportunityFormFillValues,
} from './opportunityFormFillValues'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Compile-time check that the sample matches the contract.
const typedSample: SpectrumResponse<OpportunityFormFillValues> = sample

describe('opportunity form fill values', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetAuthStoreForTests()
  })

  it('loads every dropdown list for the company', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, typedSample))
    const values = await fetchOpportunityFormFillValues(3)
    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.pathname).toBe('/api/crm/opportunities/fill-values')
    expect(url.searchParams.get('companyNo')).toBe('3')
    expect(values).toEqual(typedSample.data)
  })

  it('fills in missing lists as empty arrays', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...typedSample, data: null }))
    await expect(fetchOpportunityFormFillValues(1)).resolves.toEqual({
      opportunityStages: [],
      opportunityStatuses: [],
      currencies: [],
      activityStatuses: [],
      products: [],
      salesOrganizations: [],
    })
  })

  it('surfaces the server error when success is false', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { success: false, message: 'Request failed.', data: null, error: 'Company not found.', errors: [], traceId: null }),
    )
    await expect(fetchOpportunityFormFillValues(9)).rejects.toMatchObject({ code: 'VALIDATION', message: 'Company not found.' })
  })

  it('rejects a bad company without calling the server', async () => {
    await expect(fetchOpportunityFormFillValues(-1)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sample mirrors the stages, weights and statuses the forms use today', () => {
    const stages = bySequence(typedSample.data.opportunityStages)
    expect(stages.map((s) => s.opportunityStageName)).toEqual(DEAL_STAGES)
    for (const stage of stages) {
      expect(stageWeight(stage)).toBe(DEAL_STAGE_WEIGHT[stage.opportunityStageName as keyof typeof DEAL_STAGE_WEIGHT])
    }
    expect(typedSample.data.opportunityStatuses.map((s) => s.opportunityStatusName)).toEqual(OPPORTUNITY_STATUSES)
    expect(opportunityStageLabel(stages[2]!)).toBe('Negotiation (60%)')
  })

  it('reads the string weightage safely', () => {
    expect(stageWeight({ weightage: '60' })).toBe(60)
    expect(stageWeight({ weightage: '75%' })).toBe(75)
    expect(stageWeight({ weightage: null })).toBe(0)
    expect(stageWeight(undefined)).toBe(0)
  })
})
