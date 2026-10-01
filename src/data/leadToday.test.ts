import { describe, expect, it } from 'vitest'
import { isTodayIso, leadTouchedToday } from './leads'

const now = new Date(2026, 8, 30, 15, 0) // 30 Sep 2026, 15:00 local

describe('isTodayIso', () => {
  it('compares calendar days in local time', () => {
    expect(isTodayIso(new Date(2026, 8, 30, 0, 5).toISOString(), now)).toBe(true)
    expect(isTodayIso(new Date(2026, 8, 29, 23, 55).toISOString(), now)).toBe(false)
    expect(isTodayIso('2026-09-30', now)).toBe(true)
    expect(isTodayIso('', now)).toBe(false)
    expect(isTodayIso('not a date', now)).toBe(false)
  })
})

describe('leadTouchedToday', () => {
  const old = new Date(2026, 8, 1, 10).toISOString()
  const today = new Date(2026, 8, 30, 9).toISOString()

  it('keeps leads created or modified today', () => {
    expect(leadTouchedToday({ createdAt: '2026-09-01', audit: { createdBy: '', createdAt: today, modifiedBy: '', modifiedAt: '' } }, now)).toBe(true)
    expect(leadTouchedToday({ createdAt: '2026-09-01', audit: { createdBy: '', createdAt: old, modifiedBy: '', modifiedAt: today } }, now)).toBe(true)
    expect(leadTouchedToday({ createdAt: '2026-09-01', audit: { createdBy: '', createdAt: old, modifiedBy: '', modifiedAt: old } }, now)).toBe(false)
  })

  it('falls back to createdAt without audit stamps', () => {
    expect(leadTouchedToday({ createdAt: '2026-09-30' }, now)).toBe(true)
  })
})

describe('isLeadConverted', () => {
  it('matches the converted status or stage in any case (server: "Converted To Opportunity")', async () => {
    const { isLeadConverted } = await import('./leads')
    expect(isLeadConverted({ leadStage: 'Converted To Opportunity' as never, leadStatus: 'Open' })).toBe(true)
    expect(isLeadConverted({ leadStage: 'Converted to Opportunity', leadStatus: 'Open' })).toBe(true)
    expect(isLeadConverted({ leadStage: 'Qualified', leadStatus: 'Converted' })).toBe(true)
    expect(isLeadConverted({ leadStage: 'Qualified', leadStatus: 'Open' })).toBe(false)
  })
})
