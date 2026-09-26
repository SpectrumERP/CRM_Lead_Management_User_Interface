export interface CrmNote {
  id: string
  title: string
  text: string
  relatedLeadId: string
  relatedLeadName: string
  attachmentName?: string
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
