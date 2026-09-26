export interface SortChevronsProps {
  active: boolean
  dir: 'asc' | 'desc'
}

/** Compact sort indicator for table column headers. */
export function SortChevrons({ active, dir }: SortChevronsProps) {
  return (
    <span className="ml-1 inline-flex flex-col gap-0.5 align-middle" aria-hidden="true">
      <svg
        width="7"
        height="5"
        viewBox="0 0 7 5"
        className={active && dir === 'asc' ? 'fill-primary' : 'fill-line-strong'}
      >
        <path d="M3.5 0L7 5H0z" />
      </svg>
      <svg
        width="7"
        height="5"
        viewBox="0 0 7 5"
        className={active && dir === 'desc' ? 'fill-primary' : 'fill-line-strong'}
      >
        <path d="M3.5 5L0 0h7z" />
      </svg>
    </span>
  )
}
