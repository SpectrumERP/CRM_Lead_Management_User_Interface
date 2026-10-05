/**
 * Activities for the dashboard. The server has no "all activities" endpoint yet, so each open lead /
 * opportunity is loaded once per session through its load-data (which puts its activities in the store).
 * Replace this file with a dashboard endpoint when the server has one — the page reads the store only.
 */
import { leadNoFromId, refreshServerLead } from './leadSync'
import { opportunityNoFromId, refreshServerOpportunity } from './opportunitySync'

/** Parallel load-data requests. */
const CONCURRENCY = 4

/** Record ids whose activities are already in the store this session. */
const loaded = new Set<string>()

/** Forget what was loaded (after an activity is saved elsewhere, or on Retry). */
export function resetDashboardActivities(ids?: readonly string[]) {
  if (!ids) loaded.clear()
  else ids.forEach((id) => loaded.delete(id))
}

function loaderFor(id: string): (() => Promise<unknown>) | null {
  const leadNo = leadNoFromId(id)
  if (leadNo) return () => refreshServerLead(leadNo)
  const opportunityNo = opportunityNoFromId(id)
  if (opportunityNo) return () => refreshServerOpportunity(opportunityNo)
  return null
}

/**
 * Load the activities of the given server leads (`SL-…`) and opportunities (`SO-…`) not loaded yet.
 * Resolves to the number of records that failed; the rest stay usable.
 */
export async function loadDashboardActivities(ids: readonly string[]): Promise<number> {
  const queue = ids.filter((id) => !loaded.has(id))
  let failed = 0
  async function worker() {
    for (let id = queue.shift(); id; id = queue.shift()) {
      const load = loaderFor(id)
      if (!load) continue
      try {
        await load()
        loaded.add(id)
      } catch {
        failed += 1
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  return failed
}
