export type NotificationCategory =
  | 'task-due-today'
  | 'overdue-task'
  | 'upcoming-task'
  | 'follow-up-due'
  | 'meeting-today'
  | 'meeting-reminder'
  | 'stage-change'
  | 'status-change';

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  'task-due-today': 'Tasks Due Today',
  'overdue-task': 'Overdue Tasks',
  'upcoming-task': 'Upcoming Tasks',
  'follow-up-due': 'Follow-ups Due',
  'meeting-today': 'Meetings Today',
  'meeting-reminder': 'Meeting Reminders',
  'stage-change': 'Lead Stage Changes',
  'status-change': 'Lead Status Changes',
};

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  relatedLead?: { id: string; name: string };
  relatedActivity?: string; // activity id
  relatedMeeting?: string;  // meeting id
  relatedCompany?: string;
  dateTime: string; // ISO-like "YYYY-MM-DD HH:MM"
  isRead: boolean;
}

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  // ── Tasks Due Today ──────────────────────────────────────────────
  {
    id: 'NTF-001',
    category: 'task-due-today',
    title: 'Follow-up call with Rajesh Sharma due today',
    description: 'Discovery call follow-up was scheduled for today at 11:00 AM.',
    relatedLead: { id: 'LID-1001', name: 'Tata Consultancy Services' },
    relatedActivity: 'ACT-001',
    relatedCompany: 'Tata Consultancy Services',
    dateTime: '2024-09-25 09:00',
    isRead: false,
  },
  {
    id: 'NTF-002',
    category: 'task-due-today',
    title: 'Send proposal to Infosys Limited',
    description: 'Requirement analysis discussion task is due today at 3:00 PM.',
    relatedLead: { id: 'LID-1002', name: 'Infosys Limited' },
    relatedActivity: 'ACT-006',
    relatedCompany: 'Infosys Limited',
    dateTime: '2024-09-25 09:15',
    isRead: false,
  },

  // ── Overdue Tasks ────────────────────────────────────────────────
  {
    id: 'NTF-003',
    category: 'overdue-task',
    title: 'Task overdue: Commercial Discussion with Wipro Technologies',
    description: 'Scheduled on Sep 22 — not yet completed. Action required.',
    relatedLead: { id: 'LID-1003', name: 'Wipro Technologies' },
    relatedActivity: 'ACT-010',
    relatedCompany: 'Wipro Technologies',
    dateTime: '2024-09-23 08:00',
    isRead: false,
  },
  {
    id: 'NTF-004',
    category: 'overdue-task',
    title: 'Task overdue: Send NDA to HCL Technologies',
    description: 'Document submission task is 3 days past due.',
    relatedLead: { id: 'LID-1004', name: 'HCL Technologies' },
    relatedCompany: 'HCL Technologies',
    dateTime: '2024-09-22 08:00',
    isRead: true,
  },
  {
    id: 'NTF-005',
    category: 'overdue-task',
    title: 'Task overdue: Requirement discussion with Sun Pharmaceutical',
    description: 'This activity was due on Sep 20 and is still pending.',
    relatedLead: { id: 'LID-1009', name: 'Sun Pharmaceutical' },
    relatedCompany: 'Sun Pharmaceutical',
    dateTime: '2024-09-21 08:00',
    isRead: true,
  },

  // ── Upcoming Tasks ───────────────────────────────────────────────
  {
    id: 'NTF-006',
    category: 'upcoming-task',
    title: 'Board presentation prep — L&T due in 2 days',
    description: 'Prepare executive summary and ROI slides for Larsen & Toubro.',
    relatedLead: { id: 'LID-1007', name: 'Larsen & Toubro' },
    relatedCompany: 'Larsen & Toubro',
    dateTime: '2024-09-25 10:30',
    isRead: false,
  },
  {
    id: 'NTF-007',
    category: 'upcoming-task',
    title: 'Send integration proposal to Reliance Jio Infocomm',
    description: 'Technical requirements document submission due Sep 28.',
    relatedLead: { id: 'LID-1006', name: 'Reliance Jio Infocomm' },
    relatedCompany: 'Reliance Jio Infocomm',
    dateTime: '2024-09-25 11:00',
    isRead: true,
  },

  // ── Follow-ups Due ───────────────────────────────────────────────
  {
    id: 'NTF-008',
    category: 'follow-up-due',
    title: 'Follow-up with ABC Industries is due today',
    description: 'Post-demo follow-up email agreed during TCS board meeting.',
    relatedLead: { id: 'LID-1001', name: 'Tata Consultancy Services' },
    relatedActivity: 'ACT-004',
    relatedCompany: 'Tata Consultancy Services',
    dateTime: '2024-09-25 08:30',
    isRead: false,
  },
  {
    id: 'NTF-009',
    category: 'follow-up-due',
    title: 'Follow-up with Mahindra & Mahindra overdue by 1 day',
    description: 'Agreed to send pricing sheet after requirement call.',
    relatedLead: { id: 'LID-1005', name: 'Mahindra & Mahindra' },
    relatedCompany: 'Mahindra & Mahindra',
    dateTime: '2024-09-24 09:00',
    isRead: false,
  },
  {
    id: 'NTF-010',
    category: 'follow-up-due',
    title: 'Follow-up with HDFC Bank due tomorrow',
    description: 'Compliance review outcome expected; follow up if no response.',
    relatedLead: { id: 'LID-1012', name: 'HDFC Bank' },
    relatedCompany: 'HDFC Bank',
    dateTime: '2024-09-25 09:45',
    isRead: true,
  },

  // ── Meetings Today ───────────────────────────────────────────────
  {
    id: 'NTF-011',
    category: 'meeting-today',
    title: 'Meeting with TCS starts in 30 minutes',
    description: 'Technical Deep-Dive — SAP HR Integration Architecture at 11:00 AM (Online).',
    relatedLead: { id: 'LID-1001', name: 'Tata Consultancy Services' },
    relatedMeeting: 'MTG-002',
    relatedCompany: 'Tata Consultancy Services',
    dateTime: '2024-09-25 10:30',
    isRead: false,
  },
  {
    id: 'NTF-012',
    category: 'meeting-today',
    title: 'Executive Board Presentation with L&T today at 2:00 PM',
    description: 'In-person meeting at Head Office. Bring printed decks.',
    relatedLead: { id: 'LID-1007', name: 'Larsen & Toubro' },
    relatedMeeting: 'MTG-007',
    relatedCompany: 'Larsen & Toubro',
    dateTime: '2024-09-25 08:00',
    isRead: false,
  },

  // ── Meeting Reminders ────────────────────────────────────────────
  {
    id: 'NTF-013',
    category: 'meeting-reminder',
    title: 'Reminder: Meeting with XYZ Manufacturing starts in 30 minutes',
    description: 'Product walkthrough — Analytics Module. Online via Teams at 3:30 PM.',
    relatedLead: { id: 'LID-1003', name: 'Wipro Technologies' },
    relatedMeeting: 'MTG-005',
    relatedCompany: 'Wipro Technologies',
    dateTime: '2024-09-25 15:00',
    isRead: false,
  },
  {
    id: 'NTF-014',
    category: 'meeting-reminder',
    title: 'Reminder: Bajaj Finserv demo call in 1 hour',
    description: 'Finance module demonstration scheduled at 4:00 PM.',
    relatedLead: { id: 'LID-1008', name: 'Bajaj Finserv' },
    relatedMeeting: 'MTG-009',
    relatedCompany: 'Bajaj Finserv',
    dateTime: '2024-09-25 15:00',
    isRead: true,
  },

  // ── Lead Stage Changes ───────────────────────────────────────────
  {
    id: 'NTF-015',
    category: 'stage-change',
    title: 'Lead stage changed: Infosys Limited',
    description: 'Stage changed from Contacted → Requirement Identified by Vikram Nair.',
    relatedLead: { id: 'LID-1002', name: 'Infosys Limited' },
    relatedCompany: 'Infosys Limited',
    dateTime: '2024-09-24 16:20',
    isRead: false,
  },
  {
    id: 'NTF-016',
    category: 'stage-change',
    title: 'Lead stage changed: HCL Technologies',
    description: 'Stage changed from Under Qualification → Qualified by Priya Mehta.',
    relatedLead: { id: 'LID-1004', name: 'HCL Technologies' },
    relatedCompany: 'HCL Technologies',
    dateTime: '2024-09-23 14:05',
    isRead: true,
  },
  {
    id: 'NTF-017',
    category: 'stage-change',
    title: 'Lead stage changed: Wipro Technologies',
    description: 'Stage changed from New → Contacted by Arjun Patel.',
    relatedLead: { id: 'LID-1003', name: 'Wipro Technologies' },
    relatedCompany: 'Wipro Technologies',
    dateTime: '2024-09-22 11:45',
    isRead: true,
  },

  // ── Lead Status Changes ──────────────────────────────────────────
  {
    id: 'NTF-018',
    category: 'status-change',
    title: 'Lead status changed: Mahindra & Mahindra → On Hold',
    description: 'Status updated from Open → On Hold. Budget freeze until Q2.',
    relatedLead: { id: 'LID-1005', name: 'Mahindra & Mahindra' },
    relatedCompany: 'Mahindra & Mahindra',
    dateTime: '2024-09-24 17:00',
    isRead: false,
  },
  {
    id: 'NTF-019',
    category: 'status-change',
    title: 'Lead status changed: Sun Pharmaceutical → Cold',
    description: 'Status updated from Open → Cold. No response for 3 weeks.',
    relatedLead: { id: 'LID-1009', name: 'Sun Pharmaceutical' },
    relatedCompany: 'Sun Pharmaceutical',
    dateTime: '2024-09-23 10:30',
    isRead: true,
  },
  {
    id: 'NTF-020',
    category: 'status-change',
    title: 'Lead status changed: HDFC Bank → Converted',
    description: 'Status updated to Converted. Opportunity created by Priya Mehta.',
    relatedLead: { id: 'LID-1012', name: 'HDFC Bank' },
    relatedCompany: 'HDFC Bank',
    dateTime: '2024-09-22 09:15',
    isRead: true,
  },
];
