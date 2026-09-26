import { describe, expect, it } from 'vitest'
import { PRODUCTS, matchesProduct, productsFromLeadNames } from './products'

describe('products catalog', () => {
  it('includes the provided source item', () => {
    const item = PRODUCTS.find((row) => row.id === 36060)
    expect(item?.itemCode).toBe('1001010002')
    expect(item?.itemName).toBe("'C' CHANNEL FRAME_HORZTL M")
  })

  it('matches by name or code', () => {
    expect(matchesProduct(PRODUCTS[0], 'CHANNEL')).toBe(true)
    expect(matchesProduct(PRODUCTS[0], '1001010002')).toBe(true)
    expect(matchesProduct(PRODUCTS[0], 'zzz')).toBe(false)
  })

  it('does not duplicate names when hydrating a lead', () => {
    const next = productsFromLeadNames(["'C' CHANNEL FRAME_HORZTL M", "'C' CHANNEL FRAME_HORZTL M", 'Legacy Kit'])
    expect(next).toHaveLength(2)
    expect(next[0]?.id).toBe(36060)
    expect(next[1]?.itemName).toBe('Legacy Kit')
  })

  it('loads every provided catalog product by id', () => {
    expect(PRODUCTS).toHaveLength(20)
    expect(new Set(PRODUCTS.map((row) => row.id)).size).toBe(20)
  })

  it('keeps lookup rows with duplicate item codes distinct', () => {
    const matches = PRODUCTS.filter((row) => row.itemCode === '1001010001')
    expect(matches.length).toBeGreaterThan(1)
    expect(new Set(matches.map((row) => row.id)).size).toBe(matches.length)
  })
})
