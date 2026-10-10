/**
 * Attachments on lead / opportunity activities.
 *
 * Files are uploaded to the document store as they are picked (AttachmentsField), filed under the parent
 * record's form (Lead 377 / Opportunity 380). Linking them to the activity is a pending backend change
 * (docs/Point3_Point4_Backend_Schema.md): `attachments: [{ docNo }]` on the activity save models, and the
 * files back on load-data. Until then (mock mode) the activity → files link is kept in this browser.
 */
import type { Activity } from '../data/activities'
import { ATTACHMENT_FORM_NO, attachmentLinks, type Attachment } from './attachments'
import type { ServerActivityAttachment } from './leads'
import { getState } from './db'
import { PENDING_API_MODE, getPendingData, updatePendingData } from './pendingApiStore'

/** Form the files are filed under: the activity's opportunity, else its lead. */
export function activityAttachmentFormNo(activity: Pick<Activity, 'opportunityId'>): number {
  return activity.opportunityId ? ATTACHMENT_FORM_NO.opportunity : ATTACHMENT_FORM_NO.lead
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

/** Save-body field: the files to link (server mode only; the mock links them after the save). */
export function activityAttachmentBody(activity: Pick<Activity, 'attachments'>): { attachments?: { docNo: number }[] } {
  if (PENDING_API_MODE !== 'server' || !activity.attachments) return {}
  return { attachments: attachmentLinks(activity.attachments) }
}

/** Mock: link the files to the saved activity (`undefined` = the form did not touch them). */
export function rememberActivityAttachments(activityId: string, files: readonly Attachment[] | undefined) {
  if (PENDING_API_MODE === 'server' || files === undefined) return
  updatePendingData((data) => {
    const next = { ...data.activityAttachments }
    if (files.length) next[activityId] = files.filter((file) => file.id > 0)
    else delete next[activityId]
    return { ...data, activityAttachments: next }
  })
}

/** Mock: drop the link when the activity is deleted. */
export function forgetActivityAttachments(activityIds: readonly string[]) {
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
