/**
 * Attachments on lead / opportunity activities.
 *
 * Files are uploaded to the document store as they are picked (AttachmentsField), filed under the parent
 * record's form (Lead 377 / Opportunity 380). The activity save (leads / opportunities save-activity-detail)
 * links them: `attachments: [{ docNo }]`. Mock mode also keeps the activity → files link in this browser.
 *
 * Viewing: a saved activity's files are listed from the store (GET document-attachments with the activity's
 * detail number, its parent's form and the activity detailType), cached per activity until it is saved again.
 */
import type { Activity } from '../data/activities'
import {
  ACTIVITY_ATTACHMENT_DETAIL_TYPE,
  ATTACHMENT_FORM_NO,
  attachmentLinks,
  forgetCachedAttachments,
  listAttachmentsCached,
  type Attachment,
} from './attachments'
import type { ServerActivityAttachment } from './leads'
import { getState } from './db'
import { PENDING_API_MODE, getPendingData, updatePendingData } from './pendingApiStore'

/** Form the files are filed under: the activity's opportunity, else its lead. */
export function activityAttachmentFormNo(activity: Pick<Activity, 'opportunityId'>): number {
  return activity.opportunityId ? ATTACHMENT_FORM_NO.opportunity : ATTACHMENT_FORM_NO.lead
}

/** Store entry `detailType` for the files: opportunity activity 3, lead activity 2. */
export function activityAttachmentDetailType(activity: Pick<Activity, 'opportunityId'>): number {
  return activity.opportunityId ? ACTIVITY_ATTACHMENT_DETAIL_TYPE.opportunity : ACTIVITY_ATTACHMENT_DETAIL_TYPE.lead
}

/** Store query for a saved activity's files (`SA-…` lead / `SOA-…` opportunity ids); null when not saved yet. */
export function activityAttachmentSource(
  activity: Pick<Activity, 'id' | 'serverDetailNo'>,
): { transactionId: number; formNo: number; detailType: number } | null {
  const match = /^(SA|SOA)-(\d+)$/.exec(activity.id)
  if (!match) return null
  const opportunity = match[1] === 'SOA'
  const transactionId = opportunity ? (activity.serverDetailNo ?? Number(match[2])) : Number(match[2])
  if (!(transactionId > 0)) return null
  return opportunity
    ? { transactionId, formNo: ATTACHMENT_FORM_NO.opportunity, detailType: ACTIVITY_ATTACHMENT_DETAIL_TYPE.opportunity }
    : { transactionId, formNo: ATTACHMENT_FORM_NO.lead, detailType: ACTIVITY_ATTACHMENT_DETAIL_TYPE.lead }
}

/** A saved activity's files from the document store ([] for activities not saved yet), cached per activity. */
export function loadActivityAttachments(activity: Pick<Activity, 'id' | 'serverDetailNo'>): Promise<Attachment[]> {
  const source = activityAttachmentSource(activity)
  if (!source) return Promise.resolve([])
  return listAttachmentsCached(activity.id, source.transactionId, source.formNo, source.detailType)
}

function fromServerRows(rows: readonly ServerActivityAttachment[] | null | undefined): Attachment[] {
  return (rows ?? [])
    .filter((row) => row && row.docNo)
    .map((row) => ({ id: row.docNo, name: row.fileName || 'attachment', size: row.fileSize ?? undefined, type: row.fileType ?? undefined }))
}

/**
 * Attachment fields of an activity read from the server: its files from load-data (server mode) or the
 * ones linked in this browser (mock). No files → just `hasAttachment: false`.
 */
export function activityAttachmentFields(
  activityId: string,
  serverRows?: readonly ServerActivityAttachment[] | null,
): Pick<Activity, 'hasAttachment' | 'attachmentName' | 'attachments'> {
  const files = PENDING_API_MODE === 'server' ? fromServerRows(serverRows) : (getPendingData().activityAttachments[activityId] ?? [])
  if (!files.length) return { hasAttachment: false }
  return {
    hasAttachment: true,
    attachmentName: files.length === 1 ? files[0]!.name : `${files.length} files`,
    attachments: files,
  }
}

/** Save-body field: the files to link (`CrmAttachmentSaveModel[]`); left out when the form did not touch them. */
export function activityAttachmentBody(activity: Pick<Activity, 'attachments'>): { attachments?: { docNo: number }[] } {
  if (!activity.attachments) return {}
  return { attachments: attachmentLinks(activity.attachments) }
}

/** After a save: drop the activity's cached store list; mock: link the files to it (`undefined` = the form did not touch them). */
export function rememberActivityAttachments(activityId: string, files: readonly Attachment[] | undefined) {
  forgetCachedAttachments([activityId])
  if (PENDING_API_MODE === 'server' || files === undefined) return
  updatePendingData((data) => {
    const next = { ...data.activityAttachments }
    if (files.length) next[activityId] = files.filter((file) => file.id > 0)
    else delete next[activityId]
    return { ...data, activityAttachments: next }
  })
}

/** After a delete: drop the cached store list; mock: drop the link. */
export function forgetActivityAttachments(activityIds: readonly string[]) {
  forgetCachedAttachments(activityIds)
  if (PENDING_API_MODE === 'server') return
  const known = getPendingData().activityAttachments
  if (!activityIds.some((id) => id in known)) return
  updatePendingData((data) => {
    const next = { ...data.activityAttachments }
    for (const id of activityIds) delete next[id]
    return { ...data, activityAttachments: next }
  })
}

/**
 * The id a just-created activity got: the one activity of the record that was not there before the save.
 * Undefined when that cannot be told (none, or several new ones).
 */
export function newActivityId(before: readonly string[], after: readonly Pick<Activity, 'id'>[]): string | undefined {
  const known = new Set(before)
  const added = after.filter((item) => !known.has(item.id))
  return added.length === 1 ? added[0]!.id : undefined
}

/**
 * Mock, new lead saved with its activities: link each activity's files to the activity the server created
 * for it (same subject and due date, each server activity used once). True when anything was linked.
 */
export function linkNewLeadActivityFiles(
  leadId: string,
  drafts: readonly { subject: string; dueDate: string; attachments: readonly Attachment[] }[],
): boolean {
  if (PENDING_API_MODE === 'server') return false
  const created = getState().activities.filter((a) => a.leadId === leadId && !a.opportunityId)
  const used = new Set<string>()
  let linked = false
  for (const draft of drafts) {
    if (!draft.attachments.length) continue
    const match = created.find(
      (a) => !used.has(a.id) && a.subject.trim() === draft.subject.trim() && a.scheduleDate === draft.dueDate,
    )
    if (!match) continue
    used.add(match.id)
    rememberActivityAttachments(match.id, draft.attachments)
    linked = true
  }
  return linked
}
