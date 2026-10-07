import { formatDateParts } from '../utils/dateFormat';

export type ActivityType =
  | 'Task'
  | 'Follow-up'
  | 'Phone Call'
  | 'Meeting'
  | 'Customer Visit'
  | 'Online Meeting'
  | 'Requirement Discussion'
  | 'Commercial Discussion'
  | 'Negotiation'
  | 'Document Submission'
  | 'Other';

/** Pending = open; Closed = closed without completing (with a closure date); Completed = done (with a remark). */
export type ActivityStatus = 'Pending' | 'Closed' | 'Completed' | 'Cancelled';

export type ReminderOption =
  | 'None'
  | '15 minutes before'
  | '30 minutes before'
  | '1 hour before'
  | '2 hours before'
  | '1 day before';

export interface Activity {
  id: string;
  type: ActivityType;
  subject: string;
  leadId: string;
  /** Set when the activity belongs to an opportunity (server opportunity activities). */
  opportunityId?: string;
  leadName: string;
  contactPerson: string;
  assignedTo: string;
  scheduleDate: string;
  scheduleTime: string;
  reminder: ReminderOption;
  notes: string;
  status: ActivityStatus;
  /** Completion remark (Mark Complete) — the server's `completionRemark`. */
  outcome: string;
  /** `YYYY-MM-DD` — set when the activity is Closed (the server's `closureDate`). */
  closureDate?: string;
  completeDate: string;
  completeTime: string;
  hasAttachment: boolean;
  attachmentName?: string;
  parentActivityId?: string; // for follow-ups
  /** Server activity number to save with (expected-closures `lastActivity.activityDetailNo`); wins over the one in `id`. */
  serverDetailNo?: number;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  'Task',
  'Follow-up',
  'Phone Call',
  'Meeting',
  'Customer Visit',
  'Online Meeting',
  'Requirement Discussion',
  'Commercial Discussion',
  'Negotiation',
  'Document Submission',
  'Other',
];

export const ACTIVITY_STATUSES: ActivityStatus[] = ['Pending', 'Closed', 'Completed', 'Cancelled'];

export const ACTIVITY_FORM_STATUSES = ['Open', 'Closed'] as const
export type ActivityFormStatus = (typeof ACTIVITY_FORM_STATUSES)[number]

export function activityFormStatus(status: ActivityStatus): ActivityFormStatus {
  return status === 'Closed' ? 'Closed' : 'Open'
}

/** Form Open / Closed → stored status. Completed is set only by Mark Complete (with its remark). */
export function toStoredActivityStatus(status: ActivityFormStatus): ActivityStatus {
  return status === 'Closed' ? 'Closed' : 'Pending'
}

/** Which server activity status an app status is saved as. */
export type ServerActivityStatusKind = 'open' | 'closed' | 'completed'

export function serverActivityStatusKind(status: ActivityStatus): ServerActivityStatusKind {
  if (status === 'Completed') return 'completed'
  if (status === 'Closed' || status === 'Cancelled') return 'closed'
  return 'open'
}

/** Server status name → app status ("Open" → Pending, "Closed" → Closed, "Completed" → Completed). */
export function activityStatusFromServer(name?: string | null): ActivityStatus {
  const n = (name ?? '').trim().toLowerCase()
  if (/^(completed?|done)$/.test(n)) return 'Completed'
  if (/^(closed|cancel+ed)$/.test(n)) return 'Closed'
  return 'Pending'
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  'None',
  '15 minutes before',
  '30 minutes before',
  '1 hour before',
  '2 hours before',
  '1 day before',
];

export const SALESPERSONS = [
  'Priya Mehta',
  'Vikram Nair',
  'Arjun Patel',
  'Meena Iyer',
  'Rohan Desai',
  'Sunita Rao',
];

export const SAMPLE_LEADS = [
  { id: 'LID-1001', name: 'Tata Consultancy Services Ltd.', contact: 'Rajesh Sharma' },
  { id: 'LID-1002', name: 'Infosys Limited', contact: 'Anita Krishnan' },
  { id: 'LID-1003', name: 'Wipro Technologies', contact: 'Suresh Babu' },
  { id: 'LID-1004', name: 'HCL Technologies', contact: 'Deepak Agarwal' },
  { id: 'LID-1005', name: 'Mahindra & Mahindra', contact: 'Kavitha Reddy' },
  { id: 'LID-1006', name: 'Reliance Jio Infocomm', contact: 'Sanjay Gupta' },
  { id: 'LID-1007', name: 'Larsen & Toubro', contact: 'Ravi Shankar' },
  { id: 'LID-1008', name: 'Bajaj Finserv', contact: 'Pooja Joshi' },
  { id: 'LID-1009', name: 'Sun Pharmaceutical', contact: 'Dr. Ashok Mehta' },
  { id: 'LID-1012', name: 'HDFC Bank', contact: 'Ramesh Nambiar' },
];

export const ACTIVITIES: Activity[] = [
  {
    id: 'ACT-001',
    type: 'Phone Call',
    subject: 'Discovery Call — ERP requirements walkthrough',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    assignedTo: 'Priya Mehta',
    scheduleDate: '2024-09-10',
    scheduleTime: '11:00',
    reminder: '30 minutes before',
    notes: 'Discuss key ERP pain points and multi-entity reporting needs.',
    status: 'Completed',
    outcome: 'Positive — stakeholder confirmed budget approval. CTO to involve CISO. Follow-up demo scheduled for 14 Sep.',
    completeDate: '2024-09-10',
    completeTime: '11:48',
    hasAttachment: false,
  },
  {
    id: 'ACT-002',
    type: 'Document Submission',
    subject: 'Sent ERP brochure & 3 client case studies',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    assignedTo: 'Priya Mehta',
    scheduleDate: '2024-09-08',
    scheduleTime: '14:30',
    reminder: 'None',
    notes: 'Send ERP Suite v3 brochure, BFSI case study and manufacturing case study.',
    status: 'Completed',
    outcome: 'Email delivered. Rajesh confirmed receipt and forwarded to CISO Deepak Malhotra.',
    completeDate: '2024-09-08',
    completeTime: '14:33',
    hasAttachment: true,
    attachmentName: 'ERP_Suite_Brochure_v3.pdf',
  },
  {
    id: 'ACT-003',
    type: 'Customer Visit',
    subject: 'In-person visit — TCS House, Fort, Mumbai',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    assignedTo: 'Priya Mehta',
    scheduleDate: '2024-09-05',
    scheduleTime: '10:00',
    reminder: '1 hour before',
    notes: 'Initial face-to-face visit. Carry NDA and capability deck.',
    status: 'Completed',
    outcome: 'Met CTO and IT Head. Identified 3 key pain points. NDA signed. Demo to be scheduled.',
    completeDate: '2024-09-05',
    completeTime: '12:10',
    hasAttachment: true,
    attachmentName: 'NDA_TCS_Signed.pdf',
  },
  {
    id: 'ACT-004',
    type: 'Task',
    subject: 'Prepare custom demo environment for TCS data set',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    assignedTo: 'Vikram Nair',
    scheduleDate: '2024-09-14',
    scheduleTime: '09:00',
    reminder: '1 day before',
    notes: 'Configure demo with ~3200 user data set. Include GSTIN billing and multi-entity consolidation.',
    status: 'Pending',
    outcome: '',
    completeDate: '',
    completeTime: '',
    hasAttachment: false,
  },
  {
    id: 'ACT-005',
    type: 'Commercial Discussion',
    subject: 'Pricing discussion — volume discount options',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    assignedTo: 'Priya Mehta',
    scheduleDate: '2024-09-17',
    scheduleTime: '15:00',
    reminder: '30 minutes before',
    notes: 'Present tiered pricing. Authorised to offer up to 12% volume discount for 3200+ users.',
    status: 'Pending',
    outcome: '',
    completeDate: '',
    completeTime: '',
    hasAttachment: false,
  },
  {
    id: 'ACT-006',
    type: 'Requirement Discussion',
    subject: 'Technical deep-dive — SAP HR integration scope',
    leadId: 'LID-1002',
    leadName: 'Infosys Limited',
    contactPerson: 'Anita Krishnan',
    assignedTo: 'Vikram Nair',
    scheduleDate: '2024-09-18',
    scheduleTime: '11:00',
    reminder: '1 hour before',
    notes: 'Understand existing SAP landscape. Map API touchpoints for our ERP connector.',
    status: 'Pending',
    outcome: '',
    completeDate: '',
    completeTime: '',
    hasAttachment: false,
  },
  {
    id: 'ACT-007',
    type: 'Online Meeting',
    subject: 'Product walkthrough — CRM Platform demo',
    leadId: 'LID-1002',
    leadName: 'Infosys Limited',
    contactPerson: 'Anita Krishnan',
    assignedTo: 'Vikram Nair',
    scheduleDate: '2024-09-13',
    scheduleTime: '14:00',
    reminder: '30 minutes before',
    notes: 'MS Teams. Walk through CRM module — lead-to-order flow.',
    status: 'Completed',
    outcome: 'Anita interested in API Gateway integration. Requested sandbox access for 2 weeks.',
    completeDate: '2024-09-13',
    completeTime: '15:20',
    hasAttachment: false,
  },
  {
    id: 'ACT-008',
    type: 'Follow-up',
    subject: 'Send sandbox credentials to Infosys IT team',
    leadId: 'LID-1002',
    leadName: 'Infosys Limited',
    contactPerson: 'Anita Krishnan',
    assignedTo: 'Vikram Nair',
    scheduleDate: '2024-09-14',
    scheduleTime: '10:00',
    reminder: '15 minutes before',
    notes: 'Create sandbox tenant. Share credentials, quick-start guide, and Slack support channel invite.',
    status: 'Completed',
    outcome: 'Credentials sent. IT team acknowledged. Sandbox evaluation starts 15 Sep.',
    completeDate: '2024-09-14',
    completeTime: '09:52',
    hasAttachment: true,
    attachmentName: 'Sandbox_QuickStart_v2.pdf',
    parentActivityId: 'ACT-007',
  },
  {
    id: 'ACT-009',
    type: 'Negotiation',
    subject: 'Commercial negotiation — final pricing terms',
    leadId: 'LID-1006',
    leadName: 'Reliance Jio Infocomm',
    contactPerson: 'Sanjay Gupta',
    assignedTo: 'Priya Mehta',
    scheduleDate: '2024-09-19',
    scheduleTime: '10:30',
    reminder: '1 hour before',
    notes: 'Bring revised pricing sheet. GM Tech expects min 15% discount. Floor is 10%.',
    status: 'Pending',
    outcome: '',
    completeDate: '',
    completeTime: '',
    hasAttachment: true,
    attachmentName: 'Jio_Revised_Pricing_v2.xlsx',
  },
  {
    id: 'ACT-010',
    type: 'Task',
    subject: 'Prepare ROI analysis for HDFC Core Banking pitch',
    leadId: 'LID-1012',
    leadName: 'HDFC Bank',
    contactPerson: 'Ramesh Nambiar',
    assignedTo: 'Meena Iyer',
    scheduleDate: '2024-09-20',
    scheduleTime: '09:00',
    reminder: '1 day before',
    notes: 'ROI model based on 5-year TCO vs legacy system. Include compliance cost savings.',
    status: 'Pending',
    outcome: '',
    completeDate: '',
    completeTime: '',
    hasAttachment: false,
  },
  {
    id: 'ACT-011',
    type: 'Phone Call',
    subject: 'Check-in call — Sun Pharma QMS evaluation status',
    leadId: 'LID-1009',
    leadName: 'Sun Pharmaceutical',
    contactPerson: 'Dr. Ashok Mehta',
    assignedTo: 'Priya Mehta',
    scheduleDate: '2024-09-16',
    scheduleTime: '12:00',
    reminder: '15 minutes before',
    notes: 'Enquire about internal evaluation progress. Offer to arrange regulatory team call.',
    status: 'Completed',
    outcome: 'Dr. Mehta confirmed evaluation in final stage. Board review on 25 Sep. Optimistic.',
    completeDate: '2024-09-16',
    completeTime: '12:18',
    hasAttachment: false,
  },
  {
    id: 'ACT-012',
    type: 'Follow-up',
    subject: 'Share regulatory compliance whitepaper — Sun Pharma',
    leadId: 'LID-1009',
    leadName: 'Sun Pharmaceutical',
    contactPerson: 'Dr. Ashok Mehta',
    assignedTo: 'Priya Mehta',
    scheduleDate: '2024-09-17',
    scheduleTime: '10:00',
    reminder: 'None',
    notes: 'Follow-up from check-in call. Share FDA 21 CFR Part 11 compliance doc.',
    status: 'Pending',
    outcome: '',
    completeDate: '',
    completeTime: '',
    hasAttachment: false,
    parentActivityId: 'ACT-011',
  },
];

export type ActivityTypeMeta = { bg: string; color: string; border: string };

export function activityTypeMeta(type: string): ActivityTypeMeta {
  const m: Record<string, ActivityTypeMeta> = {
    'Task':                    { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
    'Follow-up':               { bg: '#f0fdf6', color: '#0f7a50', border: '#bbf0cf' },
    'Phone Call':              { bg: '#eef3fc', color: '#2955a3', border: '#c2d3f5' },
    'Meeting':                 { bg: '#fdf4ff', color: '#7c3aed', border: '#e9d5ff' },
    'Customer Visit':          { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    'Online Meeting':          { bg: '#eef3fc', color: '#1d4ed8', border: '#bfdbfe' },
    'Requirement Discussion':  { bg: '#f0fdf6', color: '#15803d', border: '#bbf7d0' },
    'Commercial Discussion':   { bg: '#fff0f0', color: '#c41e1e', border: '#fca5a5' },
    'Negotiation':             { bg: '#fdf4ff', color: '#9333ea', border: '#e9d5ff' },
    'Document Submission':     { bg: '#f0f4fb', color: '#4a5d82', border: '#dce4f2' },
    'Other':                   { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
  };
  return m[type] ?? m['Other'];
}

export function activityStatusMeta(s: string) {
  if (s === 'Completed' || s === 'Closed')  return { bg: '#edfbf1', color: '#1a8040', border: '#bbf0cf' };
  if (s === 'Cancelled')  return { bg: '#fff0f0', color: '#c41e1e', border: '#fca5a5' };
  return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' }; // Pending / Open
}

/** An activity's date and optional time — see utils/dateFormat. */
export function formatDateTime(date: string, time: string): string {
  return formatDateParts(date, time);
}
