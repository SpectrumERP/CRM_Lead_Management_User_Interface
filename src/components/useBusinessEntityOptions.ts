import { useEffect, useRef, useState } from 'react'
import {
  BUSINESS_ENTITY_PAGE_SIZE,
  businessEntityLocation,
  searchBusinessEntities,
  type BusinessEntityPage,
  type BusinessEntityRow,
} from '../api/businessEntities'
import { toApiError } from '../api/errors'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'

export interface EntityOption {
  id: string
  name: string
  type: string
  city: string
  code?: string
  /** Where the option came from — Spectrum entities have no local contacts yet. */
  source: 'local' | 'spectrum'
  /** Spectrum `businessEntityNo`, for API payloads. */
  businessEntityNo?: number
}

const SEARCH_DEBOUNCE_MS = 300

export function spectrumEntityId(no: number) {
  return `SPX-BE-${no}`
}

function fromSpectrum(row: BusinessEntityRow): EntityOption {
  return {
    id: spectrumEntityId(row.businessEntityNo),
    name: row.businessEntityName,
    code: row.code || undefined,
    type: row.businessEntityTypeName ?? '',
    city: businessEntityLocation(row),
    source: 'spectrum',
    businessEntityNo: row.businessEntityNo,
  }
}

/**
 * Options for the Business Entity field: server-side keyword search of
 * `/api/master/business-entities/search/business-entity-wise` (server entities only — none without a
 * Spectrum login). The first request is sent when the dropdown is first opened, not when the form mounts.
 * `current` stays selectable even when it is not on the loaded page (e.g. editing).
 */
export function useBusinessEntityOptions(current?: EntityOption | null) {
  const company = useSpectrumCompany()
  const remote = company.enabled
  // Nothing is requested until the user first opens the field.
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState<BusinessEntityPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (!remote || !opened) return
    const id = ++requestId.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      searchBusinessEntities({ keywordSearch: query, pageSize: BUSINESS_ENTITY_PAGE_SIZE })
        .then((next) => {
          if (id !== requestId.current) return
          setPage(next)
          setError(null)
        })
        .catch((err: unknown) => {
          if (id === requestId.current) setError(toApiError(err).message)
        })
        .finally(() => {
          if (id === requestId.current) setLoading(false)
        })
    }, query ? SEARCH_DEBOUNCE_MS : 0)
    return () => window.clearTimeout(timer)
  }, [remote, opened, company.companyNo, query])

  const base = remote ? (page?.items ?? []).map(fromSpectrum) : []
  const options = current && !base.some((o) => o.id === current.id) ? [current, ...base] : base

  let footer: string | undefined
  if (remote && error) footer = `Could not load business entities: ${error}`
  else if (remote && page && page.totalRecords > page.items.length) {
    footer = `Showing ${page.items.length} of ${page.totalRecords.toLocaleString('en-IN')} — keep typing to narrow`
  }

  return {
    options,
    remote,
    loading: remote && loading,
    footer,
    onQueryChange: remote ? setQuery : undefined,
    /** Pass to the dropdown: the first open triggers the first search. */
    onOpenChange: (open: boolean) => {
      if (open) setOpened(true)
    },
  }
}
