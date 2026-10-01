import { describe, expect, it } from 'vitest'
import { formatMoney, formatMoneyTotals } from './leads'

describe('formatMoney', () => {
  it('shows each amount in its own currency', () => {
    expect(formatMoney(500000.75, 'INR')).toBe('₹500,000.75')
    expect(formatMoney(500000.75, 'USD')).toBe('$ 500,000.75')
    expect(formatMoney(1200, 'GBP')).toBe('£ 1,200')
  })

  it('uses millions and billions, not lakh / crore, for every currency', () => {
    expect(formatMoney(6_729_000, 'INR')).toBe('₹6.73 M')
    expect(formatMoney(50_000_000, 'INR')).toBe('₹50.00 M')
    expect(formatMoney(2_500_000_000, 'INR')).toBe('₹2.50 B')
    expect(formatMoney(1_250_000, 'USD')).toBe('$ 1.25 M')
    expect(formatMoney(999_999, 'INR')).toBe('₹999,999')
  })
})

describe('formatMoneyTotals', () => {
  const items = [
    { value: 7_484_000, currency: 'INR' },
    { value: 78_766, currency: 'INR' },
    { value: 500_000.75, currency: 'USD' },
  ]

  it('sums per currency instead of adding different currencies', () => {
    expect(formatMoneyTotals(items)).toBe('₹7.56 M + $ 500,000.75')
  })

  it('averages within each currency', () => {
    expect(formatMoneyTotals(items, { average: true })).toBe('₹3.78 M · $ 500,001')
  })

  it('shows ₹0 for no items and treats a missing currency as INR', () => {
    expect(formatMoneyTotals([])).toBe('₹0')
    expect(formatMoneyTotals([{ value: 100 }])).toBe('₹100')
  })
})
