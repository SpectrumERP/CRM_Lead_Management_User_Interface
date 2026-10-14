import type { Attachment } from '../api/attachments'

export interface CrmNote {
  id: string
  title: string
  text: string
  relatedLeadId: string
  relatedLeadName: string
  attachmentName?: string
  /** Lead notes: files linked by the note save (document store docNos; see api/noteAttachments.ts). */
  attachments?: Attachment[]
  date: string
  by: string
}

export interface CrmEmail {
  id: string
  leadId: string
  leadName: string
  to: string
  from: string
  subject: string
  body: string
  date: string
  time: string
  by: string
  direction: 'in' | 'out'
}
