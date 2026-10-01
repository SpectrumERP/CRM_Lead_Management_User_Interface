/**
 * Lead / opportunity timelines, paged by the server:
 *
 *   GET /api/crm/leads/timeline/{leadNo}?TimelineTypeNo=&PageNo=&PageSize=&SortingColumnName=&SortingType=
 *   GET /api/crm/opportunities/timeline/{opportunityNo}?…same
 *
 * The views load the first page (20) and the next one each time the list is scrolled to its end.
 */
import type { LeadTimelineEntry } from '../data/leads'
import { spectrumEndpoints } from './endpoints'
import { assertSuccess } from './fillValues'
import { http } from './http'
import type { ServerTimelineRow, SpectrumPage } from './leads'
import { withQuery } from './query'

export type TimelineRecord = 'lead' | 'opportunity'

/** Entries per request. */
export const TIMELINE_PAGE_SIZE = 20

export interface TimelineQuery {
  pageNo: number
  pageSize?: number
  /** Only this type (`timelineTypeNo` from the rows); omit for all. */
  timelineTypeNo?: number
  /** `newest`: latest first (ActionDate DESC); omit for the server's own order. */
  order?: 'received' | 'newest'
}

export interface TimelinePage {
  entries: LeadTimelineEntry[]
  pageNo: number
  totalPages: number
  totalRecords: number
}

/** Timeline rows → app entries, in the order the server sent them. */
export function timelineFromRows(rows: readonly ServerTimelineRow[] | null | undefined): LeadTimelineEntry[] {
  return (rows ?? []).map((row) => ({
    title: row.title?.trim() || row.timelineType || 'Update',
    description: row.description?.trim() ?? '',
    type: row.timelineType ?? '',
    typeNo: row.timelineTypeNo ?? undefined,
    at: row.actionDate ?? '',
    by: row.createdBy?.printingName?.trim() || row.createdBy?.loginId || '',
  }))
}

export async function fetchTimelinePage(record: TimelineRecord, id: number, query: TimelineQuery): Promise<TimelinePage> {
  const base = record === 'lead' ? spectrumEndpoints.leads.timeline : spectrumEndpoints.opportunities.timeline
  const pageSize = query.pageSize ?? TIMELINE_PAGE_SIZE
  const url = withQuery(`${base}/${id}`, {
    TimelineTypeNo: query.timelineTypeNo,
    PageNo: query.pageNo,
    PageSize: pageSize,
    ...(query.order === 'newest' ? { SortingColumnName: 'ActionDate', SortingType: 'DESC' } : {}),
  })
  const response = await http.get<SpectrumPage<ServerTimelineRow>>(url)
  assertSuccess(response)
  const entries = timelineFromRows(response.data)
  const totalRecords = Number(response.totalRecords) || 0
  // Servers that omit the totals: a short page is the last one.
  const totalPages = Number(response.totalPages) || (entries.length < pageSize ? query.pageNo : query.pageNo + 1)
  return { entries, pageNo: Number(response.pageNo) || query.pageNo, totalPages, totalRecords }
}
