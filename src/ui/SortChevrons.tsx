export interface SortChevronsProps {
  active: boolean
  dir: 'asc' | 'desc'
}

/** Sort indicator for table column headers: ↕ when unsorted, ↑/↓ when active. */
export function SortChevrons({ active, dir }: SortChevronsProps) {
  if (!active) return <span className="shrink-0 text-ink-faint" aria-hidden="true">↕</span>
  return <span className="shrink-0 text-primary" aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>
}
