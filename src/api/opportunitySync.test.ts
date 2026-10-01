import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { login, __resetAuthForTests } from './auth'
import { __resetDb, getState, listOpportunities, upsertServerOpportunities } from './db'
import sample from './fixtures/opportunity-form-fill-values.json'
import { buildOpportunitySaveBody, type OpportunityDetail, type OpportunityRow } from './opportunities'
import type { OpportunityFormFillValues } from './opportunityFormFillValues'
import { opportunityFromRow, opportunityNoFromId, serverOpportunityId } from './opportunitySync'

const fill = sample.data as OpportunityFormFillValues

const row: OpportunityRow = {
  opportunityNo: 7,
  code: 'OP0007',
  opportunityName: 'ERP rollout',
  lead: { leadNo: 42, code: 'LD0042', leadName: 'ERP rollout' },
  opportunityStage: { opportunityStageNo: 3, opportunityStageName: 'Negotiation' },
  opportunityStatus: { opportunityStatusNo: 1, opportunityStatusName: 'Open' },
  businessEntity: { businessEntityNo: 3, businessEntityName: 'Spraying Systems Co.' },
  salesOrganization: { salesOrganizationNo: 2, salesOrganizationName: 'Export Sales' },
  currency: { currencyNo: 2, currencyName: 'US Dollar', currencyCode: 'CM0002', symbol: '$' },
  opportunityValue: 100000,
  expectedClosureDate: '2026-12-31T00:00:00',
  opportunityOwner: { loginNo: 11, printingName: 'Priya Mehta' },
  createdBy: { loginNo: 1, printingName: 'EDP' },
  createdDate: '2026-09-29T10:00:00',
}

const detail: OpportunityDetail = {
  ...row,
  contacts: [{ oppContactDetailNo: 1, businessEntityContactPerson: { businessEntityContactPersonDetailNo: 1, contactPersonName: 'Roberto Matos' } }],
  products: [{ oppProductDetailNo: 1, crmProduct: { crmProductNo: 7, productName: 'CRM', code: 'PM0007' } }],
}

describe('opportunity ids and mapping', () => {
  it('round-trips the opportunity number', () => {
    expect(serverOpportunityId(7)).toBe('SO-0007')
    expect(opportunityNoFromId('SO-0007')).toBe(7)
    expect(opportunityNoFromId('OPP-1')).toBeNull()
  })

  it('maps a row, weighting the value by the server stage weightage', () => {
    const item = opportunityFromRow(row, undefined, fill)
    expect(item).toMatchObject({
      id: 'SO-0007',
      leadId: 'SL-0042',
      name: 'ERP rollout',
      companyName: 'Spraying Systems Co.',
      dealStage: 'Negotiation',
      status: 'Open',
      dealValue: 100000,
      weightPercent: 60,
      weightedValue: 60000,
      valueCurrency: 'USD',
      closingDate: '2026-12-31',
      owner: 'Priya Mehta',
      createdBy: 'EDP',
    })
    expect(item.spectrum).toMatchObject({ opportunityNo: 7, leadNo: 42, businessEntityNo: 3, currencyNo: 2, salesOrganizationNo: 2, ownerLoginNo: 11 })
    expect(item.spectrum?.detailLoaded).toBeUndefined()
  })

  it('maps the detail contacts and products, and a later row keeps them', () => {
    const full = opportunityFromRow(detail, undefined, fill)
    expect(full.contactPerson).toBe('Roberto Matos')
    expect(full.productsRequired).toBe('CRM')
    expect(full.spectrum).toMatchObject({ contactPersonDetailNos: [1], productNos: [7], detailLoaded: true })
    const again = opportunityFromRow(row, full, fill)
    expect(again.contactPerson).toBe('Roberto Matos')
    expect(again.spectrum?.productNos).toEqual([7])
  })
})

describe('buildOpportunitySaveBody', () => {
  const draft = {
    companyNo: 1,
    leadNo: 42,
    name: ' ERP rollout ',
    ownerLoginNo: 11,
    salesOrganizationNo: 2,
    stageName: 'negotiation',
    statusName: 'Open',
    businessEntityNo: 3,
    currencyNo: 2,
    closingDate: '2026-12-31',
    value: 100000,
    contactPersonDetailNos: [1, 1],
    productNos: [7, -1],
  }

  it('builds the body with server numbers', () => {
    expect(buildOpportunitySaveBody(draft, fill).body).toEqual({
      companyNo: 1,
      leadNo: 42,
      opportunityName: 'ERP rollout',
      opportunityOwnerNo: 11,
      salesOrganizationNo: 2,
      opportunityStageNo: 3,
      businessEntityNo: 3,
      currencyNo: 2,
      opportunityStatusNo: 1,
      expectedClosureDate: '2026-12-31T00:00:00.000Z',
      opportunityValue: 100000,
      contacts: [{ businessEntityContactPersonDetailNo: 1, isPrimary: true }],
      products: [{ crmProductNo: 7 }],
    })
  })

  it('reports the required fields the API needs', () => {
    const result = buildOpportunitySaveBody(
      { ...draft, leadNo: undefined, salesOrganizationNo: undefined, ownerLoginNo: undefined, currencyNo: undefined, stageName: 'Nope' },
      fill,
    )
    // Reference lead is optional (its check is disabled in buildOpportunitySaveBody).
    expect(Object.keys(result.errors ?? {}).sort()).toEqual(['currency', 'owner', 'salesOrganization', 'stage'])
  })
})

describe('store', () => {
  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    __resetDb()
    await login('rajiv.anand@forceintellect.com', 'Admin@123')
  })

  afterEach(() => {
    __resetDb()
    __resetAuthForTests()
    vi.unstubAllGlobals()
  })

  it('lists only server opportunities with source=server', () => {
    const localCount = getState().opportunities.length
    upsertServerOpportunities([opportunityFromRow(row, undefined, fill)], { replaceAll: true })
    expect(getState().opportunities.length).toBe(localCount + 1)
    const server = listOpportunities({ source: 'server' })
    expect(server.items.map((item) => item.id)).toEqual(['SO-0007'])
    expect(server.totals).toMatchObject({ dealValue: 100000, weightedValue: 60000 })
    // One currency here, so one per-currency row with the same sums.
    expect(server.totals.byCurrency).toEqual([
      { currency: server.items[0]!.valueCurrency, dealValue: 100000, weightedValue: 60000 },
    ])
    expect(listOpportunities({ leadId: 'SL-0042' }).items).toHaveLength(1)
  })
})

describe('opportunity lead source', () => {
  it('reads the lead source from the opportunity row', () => {
    const full = opportunityFromRow({
      ...detail,
      lead: { leadNo: 34, leadName: 'Lee Jefferson', leadSource: { leadSourceNo: 4, leadSourceName: 'Cold Call' } },
    }, undefined, fill)
    expect(full.leadSource).toBe('Cold Call')
  })
})

describe('opportunity last activity (search-data lastActivityDate)', () => {
  it('takes the date from the search row and keeps it when load-data has none', () => {
    const listed = opportunityFromRow({ ...row, lastActivityDate: '2026-10-01T09:15:00Z' }, undefined, fill)
    expect(listed.lastActivityAt).toBe('2026-10-01T09:15:00Z')
    expect(opportunityFromRow(detail, listed, fill).lastActivityAt).toBe('2026-10-01T09:15:00Z')
    expect(opportunityFromRow({ ...row, lastActivityDate: null }, listed, fill).lastActivityAt).toBeNull()
  })
})
