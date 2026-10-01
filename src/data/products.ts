import { matchesAny } from '../utils/text'

export interface Product {
  id: number
  itemName: string
  itemCode: string
  hsnSacCode?: string
  subgroup?: {
    id: number
    subgroupCode: string
    subgroupName: string
  }
  group?: {
    id: number
    groupCode: string
    groupName: string
  }
  category?: {
    id: number
    code: string
    categoryName: string
  }
  stockUnit?: {
    id: number
    code: string
    unitName: string
    alias: string
  }
}

/** Product lookup catalog from the provided source JSON. */
export const PRODUCTS: Product[] = [
  {
    hsnSacCode: '85167200',
    subgroup: { id: 545, subgroupCode: '100101', subgroupName: 'Cards' },
    group: { id: 301, groupCode: '1001', groupName: 'Accessories' },
    category: { id: 37, code: '10', categoryName: 'Computer And Accessories' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 36060,
    itemName: "'C' CHANNEL FRAME_HORZTL M",
    itemCode: '1001010002',
  },
  {
    hsnSacCode: '85167200',
    subgroup: { id: 545, subgroupCode: '100101', subgroupName: 'Cards' },
    group: { id: 301, groupCode: '1001', groupName: 'Accessories' },
    category: { id: 37, code: '10', categoryName: 'Computer And Accessories' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 36061,
    itemName: "'C' CHANNEL FRAME_HORZTL Test",
    itemCode: '1001010003',
  },
  {
    subgroup: { id: 967, subgroupCode: '100101', subgroupName: 'Pump Spares' },
    group: { id: 67, groupCode: '1001', groupName: 'Pumps' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 24868,
    itemName: "'O' RING ,PN-525,PUMP-BHR5-22 1/2 DEGREE 1 STAGE,SL NO 1531194003,SELF WATER LUBRICATED",
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 967, subgroupCode: '100101', subgroupName: 'Pump Spares' },
    group: { id: 67, groupCode: '1001', groupName: 'Pumps' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 24872,
    itemName: "'O' RING,PN-522.1,PUMP-BHR5-22 1/2 DEGREE 1 STAGE,SL NO 1531194003,SELF WATER LUBRICATED",
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 967, subgroupCode: '100101', subgroupName: 'Pump Spares' },
    group: { id: 67, groupCode: '1001', groupName: 'Pumps' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 36052,
    itemName: "'O' RING,PN-522.1,PUMP-BHR5-22 1/2 DEGREE 1 STAGE,SL NO 1531194003,SELF WATER LUBRICATED 1",
    itemCode: '1001010005',
  },
  {
    subgroup: { id: 967, subgroupCode: '100101', subgroupName: 'Pump Spares' },
    group: { id: 67, groupCode: '1001', groupName: 'Pumps' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 24873,
    itemName: "'O' RING,PN-522.2,PUMP-BHR5-22 1/2 DEGREE 1 STAGE,SL NO 1531194003,SELF WATER LUBRICATED",
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 967, subgroupCode: '100101', subgroupName: 'Pump Spares' },
    group: { id: 67, groupCode: '1001', groupName: 'Pumps' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 36053,
    itemName: "'O' RING,PN-522.2,PUMP-BHR5-22 1/2 DEGREE 1 STAGE,SL NO 1531194003,SELF WATER LUBRICATED 3",
    itemCode: '1001010006',
  },
  {
    subgroup: { id: 967, subgroupCode: '100101', subgroupName: 'Pump Spares' },
    group: { id: 67, groupCode: '1001', groupName: 'Pumps' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 24870,
    itemName: "'O' RING,PN-524,PUMP-BHR5-22 1/2 DEGREE 1 STAGE,SL NO 1531194003,SELF WATER LUBRICATED",
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 430, subgroupCode: '100101', subgroupName: 'Press Transmitter' },
    group: { id: 131, groupCode: '1001', groupName: 'Electrical' },
    category: { id: 28, code: '10', categoryName: 'Spares' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 8215,
    itemName: '-50 To +50 Mmwc Furnace Pt S/N: 919338086',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 70, subgroupCode: '100101', subgroupName: 'Screen Cloth' },
    group: { id: 190, groupCode: '1001', groupName: 'Vibrating Screen' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 14771,
    itemName: '   VIBRATING SCREEN CLOTH 2385 X 1270 X 22 X 22 SQMM WIRE DIA 6 MM',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 70, subgroupCode: '100101', subgroupName: 'Screen Cloth' },
    group: { id: 190, groupCode: '1001', groupName: 'Vibrating Screen' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 5350,
    itemName: '   VIBRATING SCREEN CLOTH 2385 X 1270 X 30 X 30 SQMM WIRE DIA 6 MM',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 388, subgroupCode: '100101', subgroupName: 'En Round Bar' },
    group: { id: 162, groupCode: '1001', groupName: 'Rounds and Bars' },
    category: { id: 42, code: '10', categoryName: 'Structural' },
    stockUnit: { id: 2, code: 'UM0002', unitName: 'METRIC TON', alias: 'MT' },
    id: 11952,
    itemName: '  EN - 24 FORGED ROUND DIA 360 MM',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 583, subgroupCode: '100101', subgroupName: 'Gaseous Fuels' },
    group: { id: 63, groupCode: '1001', groupName: 'Oil And Lubrications' },
    category: { id: 30, code: '10', categoryName: 'Field Consumables' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 13241,
    itemName: '  OXYGEN GAS CYLINDER TROLLY 51 NO',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 799, subgroupCode: '100101', subgroupName: 'Gear Box' },
    group: { id: 250, groupCode: '1001', groupName: 'Gear And Gear Spares' },
    category: { id: 28, code: '10', categoryName: 'Spares' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 24700,
    itemName: '  SPEEDI SLEEVE,CR 99175 FOR 1.75"/44.45MM SHAFT DIA.',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 799, subgroupCode: '100101', subgroupName: 'Gear Box' },
    group: { id: 250, groupCode: '1001', groupName: 'Gear And Gear Spares' },
    category: { id: 28, code: '10', categoryName: 'Spares' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 24699,
    itemName: '  SPEEDI SLEEVE,CR 99200 FOR 2"/50.8 MM SHAFT DIA.',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 70, subgroupCode: '100101', subgroupName: 'Screen Cloth' },
    group: { id: 190, groupCode: '1001', groupName: 'Vibrating Screen' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 11334,
    itemName: '  VIBRATING SCREEN CLOTH 1790 X 1270 X 4 X 4 SQMM WIRE DIA 2 MM',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 70, subgroupCode: '100101', subgroupName: 'Screen Cloth' },
    group: { id: 190, groupCode: '1001', groupName: 'Vibrating Screen' },
    category: { id: 31, code: '10', categoryName: 'Machinenaries' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 11335,
    itemName: '  VIBRATING SCREEN CLOTH 2385 X 1270 X 20 X 20 SQMM WIRE DIA 6 MM',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 756, subgroupCode: '100101', subgroupName: 'Mccb' },
    group: { id: 131, groupCode: '1001', groupName: 'Electrical' },
    category: { id: 28, code: '10', categoryName: 'Spares' },
    stockUnit: { id: 64, code: 'UM0063', unitName: 'PIECES', alias: 'PCS' },
    id: 5985,
    itemName: ' 16A 2POLE MCB',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 368, subgroupCode: '100101', subgroupName: 'Mcb' },
    group: { id: 131, groupCode: '1001', groupName: 'Electrical' },
    category: { id: 28, code: '10', categoryName: 'Spares' },
    stockUnit: { id: 64, code: 'UM0063', unitName: 'PIECES', alias: 'PCS' },
    id: 5984,
    itemName: ' 25A 4POLE MCB',
    itemCode: '1001010001',
  },
  {
    subgroup: { id: 217, subgroupCode: '100101', subgroupName: 'Ci Ball Valve' },
    group: { id: 185, groupCode: '1001', groupName: 'Valves' },
    category: { id: 28, code: '10', categoryName: 'Spares' },
    stockUnit: { id: 60, code: 'UM0059', unitName: 'NUMBERS', alias: 'NOS' },
    id: 21733,
    itemName: ' 3 WAY CI BALL VALVE 100 MM (4") FLANGED',
    itemCode: '1001010001',
  },
]

export function productUnit(item: Product): string {
  return item.stockUnit?.alias || item.stockUnit?.unitName || 'NOS'
}

export function productLine(item: Product): string {
  return item.itemCode ? `${item.itemCode} - ${item.itemName}` : item.itemName
}

export function findProduct(id: number): Product | undefined {
  return PRODUCTS.find((item) => item.id === id)
}

export function productFromName(name: string): Product | undefined {
  const needle = name.trim().toLowerCase()
  if (!needle) return undefined
  return PRODUCTS.find(
    (item) => item.itemName.toLowerCase() === needle || item.itemCode.toLowerCase() === needle,
  )
}

export function matchesProduct(item: Product, query: string): boolean {
  return matchesAny(
    [
      item.itemName,
      item.itemCode,
      productUnit(item),
      item.hsnSacCode,
      item.subgroup?.subgroupName,
      item.group?.groupName,
      item.category?.categoryName,
    ],
    query,
  )
}

export function productsFromLeadNames(names: string[]): Product[] {
  const seen = new Set<number | string>()
  const next: Product[] = []
  names.forEach((name, index) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const catalog = productFromName(trimmed)
    const key = catalog?.id ?? `legacy:${trimmed}`
    if (seen.has(key)) return
    seen.add(key)
    next.push(catalog ?? { id: -(index + 1), itemName: trimmed, itemCode: '' })
  })
  return next
}

/**
 * Rebuild the selection from stored text (`productsRequired`). Catalogue names are matched inside the
 * text, so names containing commas survive; anything left over is kept as one custom entry.
 */
export function productsFromText(text: string, catalog: readonly Product[]): Product[] {
  let rest = text
  const found: { item: Product; at: number }[] = []
  // Longest names first, so "ERO 10" is not consumed as "ERO 1".
  for (const item of [...catalog].sort((a, b) => b.itemName.length - a.itemName.length)) {
    if (!item.itemName) continue
    // Whole entries only: the name must sit between separators (or the ends of the text).
    const escaped = item.itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`(^|[,;]\\s*)${escaped}(?=\\s*[,;]|\\s*$)`).exec(rest)
    if (!match) continue
    const at = match.index + match[1]!.length
    found.push({ item, at })
    // Blank the name out (same length) so later positions stay valid.
    rest = rest.slice(0, at) + ' '.repeat(item.itemName.length) + rest.slice(at + item.itemName.length)
  }
  const leftover = rest
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
  const ordered = found.sort((a, b) => a.at - b.at).map((entry) => entry.item)
  return leftover ? [...ordered, { id: -1, itemName: leftover, itemCode: '' }] : ordered
}

/** Stored text for a product selection (inverse of `productsFromText`). */
export function productsToText(items: readonly Product[]): string {
  return items.map((item) => item.itemName).join(', ')
}
