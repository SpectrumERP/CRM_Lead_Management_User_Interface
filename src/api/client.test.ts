import { beforeEach, describe, expect, it } from 'vitest'
import { API_BASE, endpoints } from './endpoints'
import { api, client } from './index'
import { api as crmApi } from './crm'
import { ApiError } from './errors'
import { login, __resetAuthForTests } from './auth'
import { __resetDb } from './db'
import type { Lead } from '../data/leads'

describe('api endpoints', () => {
  it('keeps every static path under /api/v1', () => {
    expect(endpoints.auth.login.startsWith(API_BASE)).toBe(true)
    expect(endpoints.crm.snapshot.startsWith(API_BASE)).toBe(true)
    expect(endpoints.leads.create.startsWith(API_BASE)).toBe(true)
    expect(endpoints.activities.byId('ACT-1')).toBe(`${API_BASE}/activities/ACT-1`)
  })

  it('rejects unknown routes from the shared client', () => {
    expect(() => client.getSync('/api/v1/not-a-route')).toThrow(ApiError)
    expect(() => client.getSync('/api/v1/not-a-route')).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    )
  })

  it('rejects the wrong HTTP method with METHOD_NOT_ALLOWED', () => {
    expect(() => client.postSync(endpoints.crm.snapshot)).toThrow(
      expect.objectContaining({ code: 'METHOD_NOT_ALLOWED', status: 405 }),
    )
  })
})

describe('api access', () => {
  beforeEach(() => {
    __resetDb()
    __resetAuthForTests()
  })

  it('logs in through api.auth', async () => {
    const user = await api.auth.login('priya.mehta@forceintellect.com', 'Force@123')
    expect(user.role).toBe('Sales Manager')
    expect(await api.auth.me()).toMatchObject({ id: user.id })
  })

  it('creates a lead through api.leads after session', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    crmApi.leads.create({
      id: 'LID-API',
      leadName: 'LID-API',
      companyName: 'Endpoint Co',
      contactPerson: 'A',
      email: 'a@test.com',
      phone: '1',
      leadSource: 'Website',
      leadStage: 'New',
      leadStatus: 'Open',
      productsRequired: 'ERP',
      opportunityValue: 1,
      expectedClosureDate: '2024-12-31',
      assignedSalesperson: 'Priya Mehta',
      lastActivity: 'now',
      createdAt: '2024-09-18',
    } satisfies Lead)
    expect(crmApi.crm.getState().leads[0]?.id).toBe('LID-API')
  })

  it('lists opportunities from the dummy API envelope', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    const page = await crmApi.opportunities.list({ page: 1, pageSize: 10 })
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.total).toBeGreaterThanOrEqual(page.items.length)
    expect(page.totals).toEqual(
      expect.objectContaining({
        dealValue: expect.any(Number),
        weightedValue: expect.any(Number),
      }),
    )
  })

  it('filters opportunity stages through the query string', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    const page = await crmApi.opportunities.list({ stages: ['Proposal'], pageSize: 50 })
    expect(page.items.every((item) => item.dealStage === 'Proposal')).toBe(true)
  })

  it('returns opportunity meta for filters', async () => {
    await login('priya.mehta@forceintellect.com', 'Force@123')
    const meta = await crmApi.opportunities.meta()
    expect(meta.stages.length).toBeGreaterThan(0)
    expect(meta.currencies).toContain('INR')
  })
})
