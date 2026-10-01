import { describe, expect, it } from 'vitest'
import { productsFromText, productsToText, type Product } from './products'

const catalog: Product[] = [
  { id: 1, itemName: 'P1', itemCode: 'PM0001' },
  { id: 5, itemName: 'ERO 1', itemCode: 'PM0005' },
  { id: 6, itemName: 'ERO 10', itemCode: 'PM0006' },
  { id: 9, itemName: "'O' RING,PN-525,PUMP", itemCode: 'X1' },
]

describe('product text round trip', () => {
  it('matches whole names, including names that contain commas', () => {
    const text = productsToText([catalog[3]!, catalog[2]!, catalog[0]!])
    expect(productsFromText(text, catalog).map((p) => p.id)).toEqual([9, 6, 1])
  })

  it('does not match a short name inside a longer one', () => {
    expect(productsFromText('ERO 10', catalog).map((p) => p.id)).toEqual([6])
  })

  it('keeps unknown free text as one custom entry', () => {
    const result = productsFromText('ERP Suite, P1, CRM Module', catalog)
    expect(result.map((p) => p.itemName)).toEqual(['P1', 'ERP Suite, CRM Module'])
    expect(result[1]!.id).toBe(-1)
  })

  it('returns nothing for empty text', () => {
    expect(productsFromText('  ', catalog)).toEqual([])
  })
})
