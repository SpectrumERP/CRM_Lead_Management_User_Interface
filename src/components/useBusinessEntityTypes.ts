/**
 * Business entity type (Customer / Prospect / …) per `businessEntityNo`. Lead rows carry only the
 * entity's number and name, so each entity is looked up once per session through the entity search.
 * Drop this when leads/search-data returns `businessEntityTypeName`.
 */
import { useEffect, useMemo, useState } from 'react'
import { searchBusinessEntities } from '../api/businessEntities'

export interface EntityRef {
  no: number
  name: string
}

/** Entity number → type name ('' when the server has none). Shared by every caller this session. */
const cache = new Map<number, string>()
const inFlight = new Map<number, Promise<void>>()

function lookup({ no, name }: EntityRef): Promise<void> {
  const pending = inFlight.get(no)
  if (pending) return pending
  const request = searchBusinessEntities({ businessEntityName: name, pageSize: 50 })
    .then((page) => {
      const row = page.items.find((r) => r.businessEntityNo === no)
      cache.set(no, row?.businessEntityTypeName?.trim() ?? '')
    })
    .catch(() => {
      // Left out of the cache so a later render can try again.
    })
    .finally(() => inFlight.delete(no))
  inFlight.set(no, request)
  return request
}

export function useBusinessEntityTypes(entities: readonly EntityRef[]): ReadonlyMap<number, string> {
  const [version, setVersion] = useState(0)
  const missingKey = entities
    .filter((e) => e.no && e.name && !cache.has(e.no))
    .map((e) => e.no)
    .sort((a, b) => a - b)
    .join(',')

  useEffect(() => {
    if (!missingKey) return
    let active = true
    const wanted = new Set(missingKey.split(',').map(Number))
    const unique = new Map(entities.filter((e) => wanted.has(e.no)).map((e) => [e.no, e]))
    void Promise.all([...unique.values()].map(lookup)).then(() => {
      if (active) setVersion((v) => v + 1)
    })
    return () => {
      active = false
    }
    // `missingKey` carries what changed in `entities`.
  }, [missingKey])

  // A new map after each lookup round, so memoised columns see the change.
  return useMemo(() => new Map(cache), [version, missingKey])
}
