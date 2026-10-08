import type { ReactNode, SVGProps } from 'react'
import { Button, IconTooltip } from '../ui'
import { interpolate, PAGE_COPY } from '../constants/messages'

/** Grids show the pager only when there are more than this many records. */
export const PAGINATION_MIN_RECORDS = 10

export function needsPagination(total: number) {
  return total > PAGINATION_MIN_RECORDS
}

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  disabled?: boolean
  end?: ReactNode
}

function pageItems(page: number, totalPages: number): Array<number | '…'> {
  return Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<Array<number | '…'>>((acc, n, i, arr) => {
      if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…')
      acc.push(n)
      return acc
    }, [])
}

function Chevron({ d, ...props }: SVGProps<SVGSVGElement> & { d: string }) {
  return (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4} aria-hidden="true" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <IconTooltip label={label}>
      <Button
        variant="secondary"
        className="pager-hit"
        disabled={disabled}
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    </IconTooltip>
  )
}

export default function Pagination({ page, pageSize, total, onPageChange, disabled = false, end }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages)
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1
  const stop = Math.min(current * pageSize, total)
  const copy = PAGE_COPY.pagination
  const atStart = disabled || current === 1
  const atEnd = disabled || current === totalPages

  return (
    // "Showing …" on the left; the pager at the right end of the grid (any `end` summary just before it).
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2">
      <p className="text-xs leading-7 text-ink-muted">
        {interpolate(copy.showing, {
          start: String(start),
          end: String(stop),
          total: String(total),
        })}
      </p>
      {/* { pageSize > 10 ? ( */}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {end ? <div className="text-xs leading-7 text-ink-muted">{end}</div> : null}

        {/* Pager only when there is more than one screenful (> 10 records); the count always shows. */}
        {needsPagination(total) ? (
        <nav className="inline-flex items-center gap-1" aria-label="Pagination">
          <NavButton label={copy.first} disabled={atStart} onClick={() => onPageChange(1)}>
            <span className="inline-flex -space-x-1.5">
              <Chevron d="M15 19l-7-7 7-7" />
              <Chevron d="M15 19l-7-7 7-7" />
            </span>
          </NavButton>
          <NavButton label={copy.previous} disabled={atStart} onClick={() => onPageChange(current - 1)}>
            <Chevron d="M15 19l-7-7 7-7" />
          </NavButton>
          {pageItems(current, totalPages).map((item, i) =>
            item === '…' ? (
              <span key={`ellipsis-${i}`} className="flex h-7 w-5 items-center justify-center text-xs text-ink-faint" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={item}
                variant={item === current ? 'solid' : 'secondary'}
                className="pager-hit tabular-nums"
                aria-label={interpolate(copy.page, { page: String(item) })}
                disabled={disabled}
                aria-current={item === current ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
          <NavButton label={copy.next} disabled={atEnd} onClick={() => onPageChange(current + 1)}>
            <Chevron d="M9 5l7 7-7 7" />
          </NavButton>
          <NavButton label={copy.last} disabled={atEnd} onClick={() => onPageChange(totalPages)}>
            <span className="inline-flex -space-x-1.5">
              <Chevron d="M9 5l7 7-7 7" />
              <Chevron d="M9 5l7 7-7 7" />
            </span>
          </NavButton>
        </nav>
        ) : null}
      </div>
      {/* ) : null } */}
    </div> 
  )
}
