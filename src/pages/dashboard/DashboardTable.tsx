import { useMemo, useState, type ReactNode } from 'react'
import Pagination from '../../components/Pagination'
import { PageLoader, SortChevrons } from '../../ui'
import { usePageChangeLoader } from '../../components/usePageChangeLoader'
import { DASHBOARD_PAGE_SIZE, DASHBOARD_PAGE_SIZES } from '../../data/dashboard'
import { matchesAny } from '../../utils/text'

export interface DashboardColumn<T> {
  key: string
  label: string
  render: (row: T) => ReactNode
  /** Value used for sorting; omit for a column that does not sort. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Text searched by the table search box. */
  searchText?: (row: T) => string | null | undefined
  align?: 'left' | 'right'
}

interface DashboardTableProps<T> {
  label: string
  rows: readonly T[]
  columns: DashboardColumn<T>[]
  rowKey: (row: T) => string
  defaultSort?: { key: string; dir: 'asc' | 'desc' }
  /** Order used until a column header is clicked (when there is no `defaultSort`). */
  defaultOrder?: (a: T, b: T) => number
  searchable?: boolean
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  empty: ReactNode
}

function compare(a: string | number | null | undefined, b: string | number | null | undefined) {
  // Missing values sort last in both directions handled by caller.
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' })
}

/** Dashboard grid: optional search across columns, sortable headers, client pagination. */
export function DashboardTable<T>({
  label,
  rows,
  columns,
  rowKey,
  defaultSort,
  defaultOrder,
  searchable = false,
  searchPlaceholder = 'Search…',
  onRowClick,
  rowLabel,
  empty,
}: DashboardTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(defaultSort)
  const [page, setPage] = useState(1)
  const pager = usePageChangeLoader()
  const [pageSize, setPageSize] = useState(DASHBOARD_PAGE_SIZE)

  const visible = useMemo(() => {
    let list = [...rows]
    if (search.trim()) {
      list = list.filter((row) => matchesAny(columns.map((c) => c.searchText?.(row)), search))
    }
    const column = sort && columns.find((c) => c.key === sort.key)
    if (!sort && defaultOrder) list.sort(defaultOrder)
    if (sort && column?.sortValue) {
      const get = column.sortValue
      list.sort((a, b) => {
        const av = get(a)
        const bv = get(b)
        const aMissing = av === null || av === undefined || av === ''
        const bMissing = bv === null || bv === undefined || bv === ''
        if (aMissing || bMissing) return Number(aMissing) - Number(bMissing)
        const cmp = compare(av, bv)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return list
  }, [rows, columns, search, sort, defaultOrder])

  /** First and last columns stay put while the table scrolls sideways. */
  const stickyClass = (index: number) =>
    columns.length < 3 ? '' : index === 0 ? 'sticky-col-start' : index === columns.length - 1 ? 'sticky-col-last' : ''

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const current = Math.min(page, totalPages)
  const paged = visible.slice((current - 1) * pageSize, current * pageSize)

  function toggleSort(key: string) {
    setPage(1)
    // Ascending → descending → back to the table's default order.
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: 'asc' }
      return prev.dir === 'asc' ? { key, dir: 'desc' } : defaultSort
    })
  }

  if (rows.length === 0) return <>{empty}</>

  return (
    <div className="space-y-3">
      {searchable ? (
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder={searchPlaceholder}
          aria-label={`Search ${label}`}
          className="h-8 w-full max-w-72 rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-faint focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-primary/30"
        />
      ) : null}
      <div className="table-scroll">
        <table className="crm-table" aria-label={label}>
          <thead>
            <tr>
              {columns.map((c, index) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={[c.align === 'right' ? 'text-right' : '', stickyClass(index)].filter(Boolean).join(' ') || undefined}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="flex w-full items-center gap-2 font-bold focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <span className={`flex-1 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</span>
                        <SortChevrons active={active} dir={sort?.dir ?? 'asc'} />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-xs text-ink-muted">
                  No matches for “{search}”.
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={onRowClick ? 'cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((c, index) => (
                    <td
                      key={c.key}
                      className={[c.align === 'right' ? 'text-right tabular-nums' : '', stickyClass(index)].filter(Boolean).join(' ') || undefined}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pager.busy && <PageLoader label="Loading" />}
      {visible.length > DASHBOARD_PAGE_SIZES[0] ? (
        <Pagination
          page={current}
          pageSize={pageSize}
          total={visible.length}
          disabled={pager.busy}
          onPageChange={(next) => pager.run(() => setPage(next))}
          end={
            <label className="inline-flex items-center gap-1.5">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-primary"
              >
                {DASHBOARD_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          }
        />
      ) : null}
    </div>
  )
}
