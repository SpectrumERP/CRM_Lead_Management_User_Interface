import { useEffect, useRef, useState } from 'react'
import { searchContactPersons, type ContactPersonRow } from '../api/businessEntities'
import { toApiError } from '../api/errors'
import type { EntityOption } from './useBusinessEntityOptions'

export interface SpectrumContactOption {
  id: string
  name: string
  designation: string
  company: string
  email: string
  businessEntityContactPersonDetailNo: number
}

const SEARCH_DEBOUNCE_MS = 300

function toOption(row: ContactPersonRow): SpectrumContactOption {
  return {
    id: `SPX-CP-${row.businessEntityContactPersonDetailNo}`,
    name: row.contactPersonName,
    designation: row.designation ?? '',
    company: row.businessEntityName ?? '',
    email: row.email ?? '',
    businessEntityContactPersonDetailNo: row.businessEntityContactPersonDetailNo,
  }
}

/**
 * Contact persons of the selected Spectrum business entity, searched on the server as the user types
 * (`KeywordSearch`). Inactive (`active: false`) when the entity is local or has no Spectrum number —
 * the form then keeps its in-app contact list.
 */
export function useContactPersonOptions(entity: EntityOption | null) {
  const businessEntityNo = entity?.source === 'spectrum' ? entity.businessEntityNo : undefined
  const active = businessEntityNo !== undefined
  // Nothing is requested until the user opens the field (again, after the entity changes).
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SpectrumContactOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Bumped to fetch the list again (a contact was added from the form).
  const [version, setVersion] = useState(0)
  const requestId = useRef(0)

  // A different entity starts a fresh list and search.
  useEffect(() => {
    setOpened(false)
    setQuery('')
    setOptions([])
    setError(null)
  }, [businessEntityNo])

  useEffect(() => {
    if (businessEntityNo === undefined || !opened) return
    const id = ++requestId.current
    setLoading(true)
    const timer = window.setTimeout(() => {
      searchContactPersons({ businessEntityNo, keywordSearch: query })
        .then((rows) => {
          if (id !== requestId.current) return
          setOptions(rows.map(toOption))
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
  }, [businessEntityNo, opened, query, version])

  return {
    active,
    options: active ? options : [],
    loading: active && loading,
    footer: active && error ? `Could not load contact persons: ${error}` : undefined,
    onQueryChange: active ? setQuery : undefined,
    onOpenChange: (open: boolean) => {
      if (open) setOpened(true)
    },
    /** Fetch the contact persons again (e.g. after adding one). */
    reload: () => {
      setOpened(true)
      setVersion((v) => v + 1)
    },
  }
}
