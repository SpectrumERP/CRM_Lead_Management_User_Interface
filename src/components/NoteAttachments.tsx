import type { Attachment } from '../api/attachments'
import { ATTACHMENT_FORM_NO, NOTE_ATTACHMENT_DETAIL_TYPE } from '../api/attachments'
import { loadNoteAttachments, noteAttachmentSource } from '../api/noteAttachments'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import { AttachmentChips, useStoreFiles } from './ActivityAttachments'
import AttachmentsField from './AttachmentsField'

/** A lead note's files as chips: saved notes list theirs from the document store (detailType 1). */
export function NoteAttachments({ note, className = '' }: { note: { id: string; attachments?: readonly Attachment[] }; className?: string }) {
  const files = useStoreFiles(note, loadNoteAttachments)
  return <AttachmentChips files={files} className={className} />
}

/**
 * Attachments of a lead note being added / edited: uploaded with detailType 1 under the Lead form; the
 * note save links them. `noteId` (a saved note) loads the files it already has into the field.
 */
export function NoteAttachmentsField({
  noteId,
  value,
  onChange,
  onBusyChange,
}: {
  noteId?: string | null
  value: Attachment[]
  onChange: (next: Attachment[]) => void
  /** True while a file uploads (or the saved ones load), so the note save can wait. */
  onBusyChange?: (busy: boolean) => void
}) {
  const company = useSpectrumCompany()
  return (
    <AttachmentsField
      noun="note"
      formNo={ATTACHMENT_FORM_NO.lead}
      companyNo={company.enabled ? company.headOfficeNo : null}
      detailType={NOTE_ATTACHMENT_DETAIL_TYPE}
      transactionId={noteId ? noteAttachmentSource({ id: noteId })?.transactionId : undefined}
      value={value}
      onChange={onChange}
      onBusyChange={onBusyChange}
    />
  )
}
