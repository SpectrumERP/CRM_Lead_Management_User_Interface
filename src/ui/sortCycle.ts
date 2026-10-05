export type SortDir = 'asc' | 'desc'

export interface SortState<F extends string> {
  field: F
  dir: SortDir
}

/**
 * Next sort after a header click, the same in every table:
 * another column → ascending; same column → descending; third click → back to the table's default.
 */
export function nextSort<F extends string>(prev: SortState<F>, field: F, initial: SortState<F>): SortState<F> {
  if (prev.field !== field) return { field, dir: 'asc' }
  if (prev.dir === 'asc') return { field, dir: 'desc' }
  // The default column itself would otherwise loop asc ↔ desc: its third click shows the default too.
  return initial
}
