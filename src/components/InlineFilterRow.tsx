import type { ReactNode } from 'react'
import { Select, type SelectProps } from '../ui'

const FILTER_CONTROL =
  'box-border h-8 !min-h-8 !max-h-8 !py-0 text-xs leading-8'

/**
 * The search box above every data grid (the leads page's): grey field, search icon, 32px high like the
 * compact filters beside it. Use GridSearch, or this class on an input with the icon at left-2.5.
 */
export const GRID_SEARCH_INPUT =
  'box-border h-8 w-full rounded-lg border border-line bg-surface-hover pl-8 pr-3 text-xs text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-primary focus:bg-surface focus-visible:shadow-[var(--shadow-focus)]'

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-ink-faint"
      width="13"
      height="13"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
  )
}

/** The grid search with the leads page's size: grows from 12 to 18rem in a toolbar row. */
export function GridSearch({
  value,
  onChange,
  placeholder = 'Search…',
  'aria-label': ariaLabel,
  className = 'min-w-48 max-w-72 flex-1',
}: FilterSearchProps & { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={GRID_SEARCH_INPUT}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder.replace(/…$/, '')}
      />
    </div>
  )
}

export interface FilterSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  'aria-label'?: string
}

/** Search field sized to match compact Selects — use inside InlineFilterRow. Same look as GridSearch. */
export function FilterSearch({
  value,
  onChange,
  placeholder = 'Search…',
  'aria-label': ariaLabel = 'Search',
}: FilterSearchProps) {
  return (
    // The leads page's width: 12–18rem, so the filters sit beside it on the same row.
    <div className="relative min-w-48 max-w-72 flex-1">
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={GRID_SEARCH_INPUT}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
    </div>
  )
}

export interface FilterSelectProps extends Omit<SelectProps, 'size'> {
  /** Width utility for the select wrapper. Prefer explicit widths in flex toolbars. */
  widthClass?: string
}

/** Compact select that lines up with FilterSearch (no min-width overflow). */
export function FilterSelect({ widthClass = 'w-full min-w-0', rootClassName = '', className = '', ...props }: FilterSelectProps) {
  return (
    <div className={`min-w-0 ${widthClass}`.trim()}>
      <Select
        size="compact"
        rootClassName={`is-fluid ${rootClassName}`.trim()}
        className={`w-full ${FILTER_CONTROL} !px-2.5 ${className}`.trim()}
        {...props}
      />
    </div>
  )
}

/**
 * One-row filter toolbar: search grows; prefer fixed widths on FilterSelect
 * (avoid default w-full in flex-wrap — it forces a full-width row mid-toolbar).
 */
export function InlineFilterRow({
  children,
  className = '',
  /** When true, search + first control share a 1fr / 9rem grid. Extra children continue on the same row. */
  pairLayout = false,
  /** Search on top; remaining children in an equal column grid below. */
  stacked = false,
  /** Column count for stacked filter grid (sm+). */
  filterCols = 4,
}: {
  children: ReactNode
  className?: string
  pairLayout?: boolean
  stacked?: boolean
  filterCols?: 2 | 3 | 4
}) {
  if (pairLayout) {
    return (
      <div
        className={`mb-4 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_9rem] items-center gap-2 overflow-hidden ${className}`.trim()}
      >
        {children}
      </div>
    )
  }

  if (stacked) {
    const cols =
      filterCols === 2
        ? 'sm:grid-cols-2'
        : filterCols === 3
          ? 'sm:grid-cols-2 lg:grid-cols-3'
          : 'sm:grid-cols-2 xl:grid-cols-4'
    return (
      <div className={`mb-4 flex w-full min-w-0 flex-col gap-2 ${className}`.trim()}>
        <div className={`grid w-full min-w-0 grid-cols-1 gap-2 ${cols} [&>*:first-child]:col-span-full`.trim()}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={`mb-4 flex w-full min-w-0 flex-wrap items-center gap-2 overflow-hidden ${className}`.trim()}>
      {children}
    </div>
  )
}
