/**
 * Attachments on lead notes. Files are uploaded to the document store as they are picked (AttachmentsField)
 * with detailType 1 under the Lead form (377); the note save links them — `attachments: [{ docNo }]` on
 * save-notes-detail and on the lead save's `notes`. A saved note's files are listed back from the store
 * (transactionId = its leadNotesDetailNo). Opportunity notes take no attachments (their save model has none).
 */
import {
  ATTACHMENT_FORM_NO,
  NOTE_ATTACHMENT_DETAIL_TYPE,
  attachmentLinks,
  forgetCachedAttachments,
  listAttachmentsCached,
  type Attachment,
} from './attachments'

/** Store query for a saved lead note (`SN-…` id); null for notes not saved yet and opportunity notes. */
export function noteAttachmentSource(note: { id: string }): { transactionId: number; formNo: number; detailType: number } | null {
  const match = /^SN-(\d+)$/.exec(note.id)
  const transactionId = match ? Number(match[1]) : 0
  return transactionId > 0 ? { transactionId, formNo: ATTACHMENT_FORM_NO.lead, detailType: NOTE_ATTACHMENT_DETAIL_TYPE } : null
}

/** A saved lead note's files from the document store ([] when it has no store query), cached per note. */
export function loadNoteAttachments(note: { id: string }): Promise<Attachment[]> {
  const source = noteAttachmentSource(note)
  if (!source) return Promise.resolve([])
  return listAttachmentsCached(note.id, source.transactionId, source.formNo, source.detailType)
}

/** After a note save / delete: its files are listed afresh. */
export function forgetNoteAttachments(noteIds: readonly string[]) {
  forgetCachedAttachments(noteIds)
}

/** Save-body field: the files to link; left out when the form did not touch them. */
export function noteAttachmentBody(note: { attachments?: readonly Attachment[] }): { attachments?: { docNo: number }[] } {
  return note.attachments ? { attachments: attachmentLinks(note.attachments) } : {}
}
