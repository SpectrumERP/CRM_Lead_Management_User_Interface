import { describe, expect, it } from 'vitest'
import { ApiError } from './errors'
import { pickAllowlisted } from './pick'
import { isEmail, isPhone, sanitizeEmail, sanitizeText } from './sanitize'
import {
  assertMoney,
  assertRecordId,
  LEAD_PATCH_KEYS,
  validateConvertInput,
  validateLeadWrite,
} from './validate'
import type { Lead } from '../data/leads'

const baseLead = (): Lead => ({
  id: 'LID-1001',
  leadName: 'LID-1001',
  companyName: 'Acme',
  contactPerson: 'Ada Lovelace',
  email: 'ada@acme.com',
  phone: '9876543210',
  leadSource: 'Website',
  leadStage: 'New',
  leadStatus: 'Open',
  productsRequired: 'ERP',
  opportunityValue: 1000,
  expectedClosureDate: '2026-12-31',
  assignedSalesperson: 'Priya Mehta',
  lastActivity: 'now',
  createdAt: '2024-09-18',
})

describe('sanitize', () => {
  it('strips markup and dangerous protocols', () => {
    expect(sanitizeText('<script>alert(1)</script>Safe')).toBe('Safe')
    expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitizeEmail('  Ada.Lovelace@Acme.COM ')).toBe('ada.lovelace@acme.com')
  })

  it('validates email and phone shapes', () => {
    expect(isEmail('priya.mehta@forceintellect.com')).toBe(true)
    expect(isEmail('not-an-email')).toBe(false)
    expect(isPhone('+91 98765 43210')).toBe(true)
    expect(isPhone('123')).toBe(false)
  })
})

describe('pickAllowlisted', () => {
  it('drops mass-assignment of immutable fields', () => {
    const patch = pickAllowlisted(
      { companyName: 'New Co', id: 'HACKED', createdAt: '1999-01-01' } as Partial<Lead>,
      LEAD_PATCH_KEYS,
    )
    expect(patch).toEqual({ companyName: 'New Co' })
    expect('id' in patch).toBe(false)
    expect('createdAt' in patch).toBe(false)
  })
})

describe('validate', () => {
  it('accepts a well-formed lead', () => {
    expect(validateLeadWrite(baseLead()).id).toBe('LID-1001')
  })

  it('rejects invalid enums and money', () => {
    expect(() => validateLeadWrite({ ...baseLead(), leadStage: 'Nope' as Lead['leadStage'] })).toThrow(
      ApiError,
    )
    expect(() => assertMoney(-1)).toThrow(ApiError)
    expect(() => assertRecordId('bad id')).toThrow(ApiError)
  })

  it('normalizes conversion input', () => {
    expect(
      validateConvertInput({ dealValue: 10.456, valueCurrency: 'inr' as never, closingDate: '2026-03-31' }),
    ).toEqual({ dealValue: 10.46, valueCurrency: 'INR', closingDate: '2026-03-31' })
  })
})
