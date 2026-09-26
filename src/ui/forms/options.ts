/** Option shape for Select, ChoiceGroup, and similar controls. No CRM data here. */
export interface FormOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

export function compareAlpha(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
}

export function sortAlpha(values: readonly string[]): string[] {
  return [...values].sort(compareAlpha)
}

/** Empty-value / “All …” items stay first; the rest are A–Z by label. */
export function sortByLabel<T extends { label: string; value: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => {
    const leftPinned = isPinnedOption(left)
    const rightPinned = isPinnedOption(right)
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1
    return compareAlpha(left.label, right.label)
  })
}

function isPinnedOption(item: { label: string; value: string }) {
  if (item.value === '') return true
  const value = item.value.toLowerCase()
  if (value === 'all') return true
  return item.label.toLowerCase().startsWith('all ')
}

export function toOptions(values: readonly string[]): FormOption[] {
  return sortAlpha(values).map((value) => ({ value, label: value }))
}
