import { useCallback, useEffect, useRef, useState } from 'react'
import {
  searchBusinessEntities,
  searchBusinessEntityAttachments,
  searchBusinessEntityContacts,
  type BusinessEntitySearch,
} from '../../api/businessEntities'
import { toApiError } from '../../api/errors'
import {
  attachmentListRow,
  contactListRow,
  entityListRow,
  type AnyListRow,
  type ListSource,
} from './listRows'

export const LIST_PAGE_SIZE = 20

const NO_ROWS: AnyListRow[] = []

interface FeedPage {
  rows: AnyListRow[]
  alphabets: string[]
  firstRowNo: number
  lastRowNo: number
  totalRecords: number
}

async function fetchPage(source: ListSource, input: BusinessEntitySearch, typeNames: ReadonlyMap<number, string>): Promise<FeedPage> {
  const page =
    source === 'contact'
      ? await searchBusinessEntityContacts(input)
      : source === 'attachment'
        ? await searchBusinessEntityAttachments(input)
        : await searchBusinessEntities(input)
  const rows: AnyListRow[] =
    source === 'contact'
      ? page.items.map((r) => contactListRow(r as Parameters<typeof contactListRow>[0]))
      : source === 'attachment'
        ? page.items.map((r) => attachmentListRow(r as Parameters<typeof attachmentListRow>[0]))
        : page.items.map((r) => entityListRow(r as Parameters<typeof entityListRow>[0], typeNames))
  return { rows, alphabets: page.alphabets, firstRowNo: page.firstRowNo, lastRowNo: page.lastRowNo, totalRecords: page.totalRecords }
}

function merge(existing: AnyListRow[], incoming: AnyListRow[], at: 'start' | 'end') {
  const seen = new Set(existing.map((r) => r.key))
  const fresh = incoming.filter((r) => !seen.has(r.key))
  return at === 'start' ? [...fresh, ...existing] : [...existing, ...fresh]
}

/**
 * Cursor-paged business entity search for the list (Task Management behaviour): the first page
 * loads from the top, or from a letter when one is picked (a jump, not a filter — scrolling on
 * loads the neighbouring rows). `loadNext` / `loadPrev` page on from the loaded range's ends.
 */
export function useBusinessEntityFeed(
  source: ListSource,
  options: {
    keyword: string
    startsWith: string
    enabled: boolean
    typeNames: ReadonlyMap<number, string>
    /** Change to load the list again from the top (after a delete, a company switch…). */
    reloadKey: string
  },
) {
  const { keyword, startsWith, enabled, typeNames, reloadKey } = options
  const [rows, setRows] = useState<AnyListRow[]>([])
  // Which source `rows` were loaded for. Switching view renders once before the reload effect
  // clears them — another source's rows must never reach a view built for a different row shape.
  const [rowsSource, setRowsSource] = useState(source)
  const [alphabets, setAlphabets] = useState<string[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState<'next' | 'prev' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const range = useRef({ first: 0, last: 0, atStart: true, atEnd: true })
  const requestId = useRef(0)
  const busy = useRef(false)
  const typeNamesRef = useRef(typeNames)
  typeNamesRef.current = typeNames

  useEffect(() => {
    if (!enabled) return
    const id = ++requestId.current
    busy.current = true
    setLoading(true)
    setError(null)
    setRows([])
    fetchPage(source, { keywordSearch: keyword, startsWith, pageSize: LIST_PAGE_SIZE }, typeNamesRef.current)
      .then((page) => {
        if (id !== requestId.current) return
        setRows(page.rows)
        setRowsSource(source)
        setAlphabets(page.alphabets)
        setTotalRecords(page.totalRecords)
        range.current = {
          first: page.firstRowNo,
          last: page.lastRowNo,
          atStart: page.firstRowNo <= 1,
          atEnd: page.rows.length < LIST_PAGE_SIZE || (page.totalRecords > 0 && page.lastRowNo >= page.totalRecords),
        }
      })
      .catch((err) => {
        if (id !== requestId.current) return
        setError(toApiError(err).message)
        setRowsSource(source) // rows were cleared above; show the error, not an endless spinner
      })
      .finally(() => {
        if (id !== requestId.current) return
        busy.current = false
        setLoading(false)
      })
  }, [source, keyword, startsWith, enabled, reloadKey])

  const loadMore = useCallback(
    async (direction: 'next' | 'prev') => {
      const r = range.current
      if (busy.current || (direction === 'next' ? r.atEnd : r.atStart)) return
      const id = requestId.current
      busy.current = true
      setLoadingMore(direction)
      try {
        const page = await fetchPage(
          source,
          {
            keywordSearch: keyword,
            cursorRowNo: direction === 'next' ? r.last : r.first,
            direction: direction === 'next' ? 'Next' : 'Prev',
            pageSize: LIST_PAGE_SIZE,
          },
          typeNamesRef.current,
        )
        if (id !== requestId.current) return
        setRows((prev) => merge(prev, page.rows, direction === 'next' ? 'end' : 'start'))
        if (page.alphabets.length) setAlphabets(page.alphabets)
        if (page.totalRecords) setTotalRecords(page.totalRecords)
        if (direction === 'next') {
          range.current.last = Math.max(r.last, page.lastRowNo)
          range.current.atEnd = page.rows.length < LIST_PAGE_SIZE || (page.totalRecords > 0 && page.lastRowNo >= page.totalRecords)
        } else {
          range.current.first = page.rows.length ? Math.min(r.first, page.firstRowNo) : r.first
          range.current.atStart = page.rows.length === 0 || page.firstRowNo <= 1
        }
      } catch (err) {
        if (id === requestId.current) setError(toApiError(err).message)
      } finally {
        if (id === requestId.current) {
          busy.current = false
          setLoadingMore(null)
        }
      }
    },
    [source, keyword],
  )

  const rowsMatchSource = rowsSource === source
  return {
    rows: rowsMatchSource ? rows : NO_ROWS,
    alphabets,
    totalRecords,
    loading: loading || (enabled && !rowsMatchSource),
    loadingMore,
    error,
    hasNext: !range.current.atEnd,
    hasPrev: !range.current.atStart,
    loadNext: () => loadMore('next'),
    loadPrev: () => loadMore('prev'),
  }
}
