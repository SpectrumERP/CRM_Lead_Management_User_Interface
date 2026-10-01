import { describe, expect, it } from 'vitest'
import type { SpectrumCompany } from './authStore'
import { headOfficeNoOf } from './spectrumCompany'

function company(CompanyNo: number, HeadOfficeNo: number): SpectrumCompany {
  return { CompanyNo, CompanyCode: `C${CompanyNo}`, CompanyName: `Company ${CompanyNo}`, HeadOfficeNo, BaseCurrencyNo: 1, BaseCurrencyName: 'INR', GSTINNo: null }
}

describe('headOfficeNoOf', () => {
  const companies = [company(1, 1), company(4, 1), company(7, 0)]

  it('returns the head office of a branch', () => {
    expect(headOfficeNoOf(companies, 4)).toBe(1)
  })

  it('returns the company itself when it is the head office (0 or missing)', () => {
    expect(headOfficeNoOf(companies, 1)).toBe(1)
    expect(headOfficeNoOf(companies, 7)).toBe(7)
    expect(headOfficeNoOf(companies, 99)).toBe(99)
  })
})
