import { formatTimeRange } from '../utils/dateFormat';

export type MeetingMode = 'In Person' | 'Online' | 'Phone';
export type MeetingStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface Meeting {
  id: string;
  subject: string;
  leadId: string;
  leadName: string;
  contactPerson: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  endTime?: string;      // HH:MM
  mode: MeetingMode;
  location: string;      // address or video-call link
  participants: string[]; // free-text names
  notes: string;         // discussion notes / agenda
  status: MeetingStatus;
  outcome: string;       // filled when Completed
  hasAttachment: boolean;
  attachmentName?: string;
}

export const MEETING_MODES: MeetingMode[] = ['In Person', 'Online', 'Phone'];
export const MEETING_STATUSES: MeetingStatus[] = ['Scheduled', 'Completed', 'Cancelled'];

export const MEETINGS: Meeting[] = [
  {
    id: 'MTG-001',
    subject: 'Product Demo — ERP Suite & Advanced Analytics',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    date: '2024-09-14',
    time: '14:00',
    endTime: '16:00',
    mode: 'In Person',
    location: 'TCS House, Raveline Street, Fort, Mumbai – 400 001',
    participants: ['Rajesh Sharma (CTO, TCS)', 'Deepak Malhotra (CISO, TCS)', 'Priya Mehta (Force Intellect)', 'Vikram Nair (Force Intellect)'],
    notes: 'Full ERP Suite walkthrough followed by live Analytics dashboards. Focus on multi-entity P&L consolidation. Bring printed ROI comparison.',
    status: 'Completed',
    outcome: 'Demo very well received. CTO requested a custom ROI analysis based on TCS\'s 3,200-user scale. CISO wants security architecture document (SOC 2 Type II). Board presentation tentatively agreed for 30 Sep.',
    hasAttachment: true,
    attachmentName: 'ERP_Demo_Deck_TCS_v2.pptx',
  },
  {
    id: 'MTG-002',
    subject: 'Technical Deep-Dive — SAP HR Integration Architecture',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    date: '2024-09-20',
    time: '11:00',
    endTime: '12:30',
    mode: 'Online',
    location: 'Microsoft Teams – link shared on email',
    participants: ['Rajesh Sharma (TCS)', 'IT Architect – TCS (Sunil Menon)', 'Vikram Nair (Force Intellect)', 'Solutions Engineer – Arjun Patel (Force Intellect)'],
    notes: 'Walk through API connector design. Understand existing SAP HCM version and API gateway available. Clarify data sync frequency requirements.',
    status: 'Scheduled',
    outcome: '',
    hasAttachment: false,
  },
  {
    id: 'MTG-003',
    subject: 'Executive Board Presentation — Business Case & Roadmap',
    leadId: 'LID-1001',
    leadName: 'Tata Consultancy Services Ltd.',
    contactPerson: 'Rajesh Sharma',
    date: '2024-09-30',
    time: '10:00',
    endTime: '11:00',
    mode: 'In Person',
    location: 'TCS Boardroom, BKC Tower, Bandra Kurla Complex, Mumbai',
    participants: ['CXO Group – TCS (5 members)', 'Rajesh Sharma (CTO, TCS)', 'Priya Mehta (Force Intellect)', 'Regional Director (Force Intellect)'],
    notes: 'Executive-level pitch. Present 5-year TCO vs legacy, ROI projections, implementation timeline, and change management approach.',
    status: 'Scheduled',
    outcome: '',
    hasAttachment: false,
  },
  {
    id: 'MTG-004',
    subject: 'CRM Platform Walkthrough — Lead-to-Order Flow Demo',
    leadId: 'LID-1002',
    leadName: 'Infosys Limited',
    contactPerson: 'Anita Krishnan',
    date: '2024-09-13',
    time: '14:00',
    endTime: '15:30',
    mode: 'Online',
    location: 'Zoom – Meeting ID: 892 3410 7721',
    participants: ['Anita Krishnan (VP Technology, Infosys)', 'Prakash Iyer (IT Manager, Infosys)', 'Vikram Nair (Force Intellect)'],
    notes: 'Complete product walkthrough: CRM module, lead capture, pipeline management, and order conversion flow. Focus on API Gateway integration demo.',
    status: 'Completed',
    outcome: 'Anita very engaged with API integration capabilities. Requested a 2-week sandbox evaluation with their IT team. Sandbox credentials to be sent by 14 Sep.',
    hasAttachment: false,
  },
  {
    id: 'MTG-005',
    subject: 'Sandbox Evaluation Review — Infosys IT Team',
    leadId: 'LID-1002',
    leadName: 'Infosys Limited',
    contactPerson: 'Anita Krishnan',
    date: '2024-09-28',
    time: '15:00',
    endTime: '16:00',
    mode: 'Online',
    location: 'Google Meet – calendar invite sent',
    participants: ['Anita Krishnan (Infosys)', 'IT Evaluation Team – 3 members (Infosys)', 'Vikram Nair (Force Intellect)', 'Arjun Patel (Force Intellect)'],
    notes: 'Review sandbox evaluation findings. Address technical queries from IT team. Collect formal evaluation feedback document.',
    status: 'Scheduled',
    outcome: '',
    hasAttachment: false,
  },
  {
    id: 'MTG-006',
    subject: 'Commercial Negotiation — Final Pricing & Terms',
    leadId: 'LID-1006',
    leadName: 'Reliance Jio Infocomm',
    contactPerson: 'Sanjay Gupta',
    date: '2024-09-19',
    time: '10:30',
    endTime: '12:00',
    mode: 'In Person',
    location: 'Jio World Centre, BKC, Bandra Kurla Complex, Mumbai',
    participants: ['Sanjay Gupta (GM Technology, Jio)', 'Procurement Head – Jio', 'Priya Mehta (Force Intellect)', 'Regional Director (Force Intellect)'],
    notes: 'Final round commercial discussion. Jio expects minimum 15% discount. Floor authorised at 10%. Bring revised pricing sheet and multi-year lock-in proposal.',
    status: 'Scheduled',
    outcome: '',
    hasAttachment: true,
    attachmentName: 'Jio_Revised_Pricing_v2.xlsx',
  },
  {
    id: 'MTG-007',
    subject: 'Initial Discovery — Core Banking Modernisation',
    leadId: 'LID-1012',
    leadName: 'HDFC Bank',
    contactPerson: 'Ramesh Nambiar',
    date: '2024-09-09',
    time: '11:00',
    endTime: '12:30',
    mode: 'In Person',
    location: 'HDFC Bank Head Office, Senapati Bapat Marg, Lower Parel, Mumbai',
    participants: ['Ramesh Nambiar (CTO, HDFC Bank)', 'IT Strategy Team (2 members)', 'Meena Iyer (Force Intellect)'],
    notes: 'Initial discovery session. Understand CBS architecture, digital banking integration scope, and regulatory compliance requirements.',
    status: 'Completed',
    outcome: 'Ramesh confirmed ₹8 Cr+ budget range for a 5-year contract. Key concerns: RBI compliance, data residency within India, SOC 2 certification. Follow-up ROI analysis requested.',
    hasAttachment: false,
  },
  {
    id: 'MTG-008',
    subject: 'Regulatory Compliance Deep-Dive — QMS Platform',
    leadId: 'LID-1009',
    leadName: 'Sun Pharmaceutical',
    contactPerson: 'Dr. Ashok Mehta',
    date: '2024-09-25',
    time: '09:30',
    endTime: '11:00',
    mode: 'Phone',
    location: '+91 22 4324 4324 (Sun Pharma Conference Line)',
    participants: ['Dr. Ashok Mehta (VP Operations, Sun Pharma)', 'Regulatory Affairs Lead – Sun Pharma', 'Priya Mehta (Force Intellect)'],
    notes: 'Discuss FDA 21 CFR Part 11 compliance, CDSCO requirements, and EU Annex 11 alignment for the QMS platform. Board review on 25 Sep makes this call critical.',
    status: 'Scheduled',
    outcome: '',
    hasAttachment: true,
    attachmentName: 'FDA_21CFR_Part11_Whitepaper.pdf',
  },
];

export function meetingModeMeta(mode: string) {
  if (mode === 'In Person') return { bg: '#fdf4ff', color: '#7c3aed', border: '#e9d5ff', icon: '🏢' };
  if (mode === 'Online')    return { bg: '#eef3fc', color: '#2955a3', border: '#c2d3f5', icon: '💻' };
  if (mode === 'Phone')     return { bg: '#f0fdf6', color: '#0f7a50', border: '#bbf0cf', icon: '📞' };
  return { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', icon: '📅' };
}

export function meetingStatusMeta(status: string) {
  if (status === 'Completed')  return { bg: '#edfbf1', color: '#1a8040', border: '#bbf0cf' };
  if (status === 'Cancelled')  return { bg: '#fff0f0', color: '#c41e1e', border: '#fca5a5' };
  return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' }; // Scheduled
}

/** A meeting's date and start (– end) time — see utils/dateFormat. */
export function formatMeetingDateTime(date: string, time: string, endTime?: string): string {
  return formatTimeRange(date, time, endTime);
}

export const SAMPLE_LEADS_FOR_MEETINGS = [
  { id: 'LID-1001', name: 'Tata Consultancy Services Ltd.', contact: 'Rajesh Sharma' },
  { id: 'LID-1002', name: 'Infosys Limited',                contact: 'Anita Krishnan' },
  { id: 'LID-1003', name: 'Wipro Technologies',             contact: 'Suresh Babu' },
  { id: 'LID-1004', name: 'HCL Technologies',               contact: 'Deepak Agarwal' },
  { id: 'LID-1005', name: 'Mahindra & Mahindra',            contact: 'Kavitha Reddy' },
  { id: 'LID-1006', name: 'Reliance Jio Infocomm',          contact: 'Sanjay Gupta' },
  { id: 'LID-1007', name: 'Larsen & Toubro',                contact: 'Ravi Shankar' },
  { id: 'LID-1008', name: 'Bajaj Finserv',                  contact: 'Pooja Joshi' },
  { id: 'LID-1009', name: 'Sun Pharmaceutical',             contact: 'Dr. Ashok Mehta' },
  { id: 'LID-1012', name: 'HDFC Bank',                      contact: 'Ramesh Nambiar' },
];
