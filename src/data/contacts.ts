export type ContactStatus = 'Active' | 'Inactive';

export interface Contact {
  id: string;
  name: string;
  businessEntityId: string;
  businessEntityName: string;
  designation: string;
  department: string;
  mobile: string;
  email: string;
  locationLabel: string;   // which branch/office
  isPrimary: boolean;
  status: ContactStatus;
  remarks: string;
  createdDate: string;
  lastActivity: string;
}

export const CONTACT_STATUSES: ContactStatus[] = ['Active', 'Inactive'];

export const DEPARTMENTS = [
  'Information Technology',
  'Technology',
  'IT Operations',
  'Information Security',
  'Operations',
  'Finance & Accounts',
  'Procurement',
  'Digital & Innovation',
  'Supply Chain',
  'Research & Development',
  'Legal & Compliance',
  'Human Resources',
  'Sales & Marketing',
  'General Management',
  'Other',
];

export const CONTACTS: Contact[] = [
  {
    id: 'CON-001',
    name: 'Rajesh Sharma',
    businessEntityId: 'BE-001',
    businessEntityName: 'Tata Consultancy Services Ltd.',
    designation: 'Chief Technology Officer',
    department: 'Technology',
    mobile: '+91 98101 23456',
    email: 'rajesh.sharma@tcs.com',
    locationLabel: 'Head Office, Mumbai',
    isPrimary: true,
    status: 'Active',
    remarks: 'Primary decision-maker for ERP evaluation. Closely involved with CISO Deepak Malhotra on security sign-off. Best time to reach: 10 AM – 12 PM.',
    createdDate: '2024-01-15',
    lastActivity: '10 Sep 2024',
  },
  {
    id: 'CON-002',
    name: 'Deepak Malhotra',
    businessEntityId: 'BE-001',
    businessEntityName: 'Tata Consultancy Services Ltd.',
    designation: 'Chief Information Security Officer',
    department: 'Information Security',
    mobile: '+91 98201 34567',
    email: 'deepak.malhotra@tcs.com',
    locationLabel: 'Head Office, Mumbai',
    isPrimary: false,
    status: 'Active',
    remarks: 'Requires SOC 2 Type II certification and pen-test reports before sign-off. Very technical — prefers written communication.',
    createdDate: '2024-01-15',
    lastActivity: '14 Sep 2024',
  },
  {
    id: 'CON-003',
    name: 'Anita Krishnan',
    businessEntityId: 'BE-002',
    businessEntityName: 'Infosys Limited',
    designation: 'VP Technology',
    department: 'Technology',
    mobile: '+91 98765 43210',
    email: 'anita.krishnan@infosys.com',
    locationLabel: 'Electronic City Campus, Bengaluru',
    isPrimary: true,
    status: 'Active',
    remarks: 'Very interested in API Gateway integration. Wants sandbox access before any commercial discussion. Responds quickly on email.',
    createdDate: '2024-02-10',
    lastActivity: '13 Sep 2024',
  },
  {
    id: 'CON-004',
    name: 'Prakash Iyer',
    businessEntityId: 'BE-002',
    businessEntityName: 'Infosys Limited',
    designation: 'IT Manager',
    department: 'IT Operations',
    mobile: '+91 97654 32109',
    email: 'prakash.iyer@infosys.com',
    locationLabel: 'Electronic City Campus, Bengaluru',
    isPrimary: false,
    status: 'Active',
    remarks: 'Handles technical evaluation from IT operations side. Will be main contact during sandbox trial.',
    createdDate: '2024-02-10',
    lastActivity: '14 Sep 2024',
  },
  {
    id: 'CON-005',
    name: 'Sanjay Gupta',
    businessEntityId: 'BE-003',
    businessEntityName: 'Reliance Jio Infocomm Ltd.',
    designation: 'GM Technology',
    department: 'Technology',
    mobile: '+91 98112 45678',
    email: 'sanjay.gupta@jio.com',
    locationLabel: 'Jio World Centre, Mumbai',
    isPrimary: true,
    status: 'Active',
    remarks: 'Final commercial negotiation on 19 Sep. Authorised to negotiate pricing. Expects minimum 15% discount. Very direct communicator.',
    createdDate: '2024-03-05',
    lastActivity: '19 Sep 2024',
  },
  {
    id: 'CON-006',
    name: 'Ramesh Nambiar',
    businessEntityId: 'BE-004',
    businessEntityName: 'HDFC Bank Ltd.',
    designation: 'Chief Technology Officer',
    department: 'Information Technology',
    mobile: '+91 98900 12345',
    email: 'ramesh.nambiar@hdfcbank.com',
    locationLabel: 'Head Office, Mumbai',
    isPrimary: true,
    status: 'Active',
    remarks: 'Confirmed ₹8 Cr+ budget for 5-year contract. Key concerns: RBI compliance, data residency, SOC 2. Prefers in-person meetings.',
    createdDate: '2024-04-20',
    lastActivity: '09 Sep 2024',
  },
  {
    id: 'CON-007',
    name: 'Dr. Ashok Mehta',
    businessEntityId: 'BE-005',
    businessEntityName: 'Sun Pharmaceutical Industries',
    designation: 'VP Operations',
    department: 'Operations',
    mobile: '+91 99001 23456',
    email: 'ashok.mehta@sunpharma.com',
    locationLabel: 'Corporate Office, Vadodara',
    isPrimary: true,
    status: 'Active',
    remarks: 'Board review on 25 Sep 2024. FDA 21 CFR Part 11 compliance is non-negotiable. Highly technical — PhD in Chemical Engineering.',
    createdDate: '2024-05-08',
    lastActivity: '16 Sep 2024',
  },
  {
    id: 'CON-008',
    name: 'Kavitha Reddy',
    businessEntityId: 'BE-006',
    businessEntityName: 'Mahindra & Mahindra Ltd.',
    designation: 'Group CIO',
    department: 'Information Technology',
    mobile: '+91 98234 56789',
    email: 'kavitha.reddy@mahindra.com',
    locationLabel: 'Gateway Building, Mumbai',
    isPrimary: true,
    status: 'Active',
    remarks: 'Oversees IT across all M&M verticals. Interested in Supply Chain Management and Dealer Network modules for auto division.',
    createdDate: '2023-11-12',
    lastActivity: '05 Sep 2024',
  },
  {
    id: 'CON-009',
    name: 'Ravi Shankar',
    businessEntityId: 'BE-007',
    businessEntityName: 'Larsen & Toubro Ltd.',
    designation: 'Chief Digital Officer',
    department: 'Digital & Innovation',
    mobile: '+91 98345 67890',
    email: 'ravi.shankar@larsentoubro.com',
    locationLabel: 'L&T House, Mumbai',
    isPrimary: true,
    status: 'Active',
    remarks: 'L&T EPC division needs multi-project milestone tracking. Working with pre-existing Oracle ERP — wants integration layer.',
    createdDate: '2023-09-01',
    lastActivity: '01 Sep 2024',
  },
  {
    id: 'CON-010',
    name: 'Pooja Joshi',
    businessEntityId: 'BE-008',
    businessEntityName: 'Bajaj Finserv Ltd.',
    designation: 'VP Information Technology',
    department: 'Information Technology',
    mobile: '+91 97890 12345',
    email: 'pooja.joshi@bajajfinserv.in',
    locationLabel: 'Corporate Office, Pune',
    isPrimary: true,
    status: 'Active',
    remarks: 'Digital-first transformation push from the board. Loan origination system is priority. Has pre-allocated ₹3.5 Cr budget.',
    createdDate: '2024-06-15',
    lastActivity: '10 Aug 2024',
  },
  {
    id: 'CON-011',
    name: 'Suresh Babu',
    businessEntityId: 'BE-001',
    businessEntityName: 'Tata Consultancy Services Ltd.',
    designation: 'VP Engineering',
    department: 'Technology',
    mobile: '+91 98456 78901',
    email: 'suresh.babu@tcs.com',
    locationLabel: 'Pune Delivery Centre',
    isPrimary: false,
    status: 'Active',
    remarks: 'Handles engineering decisions for Pune delivery centre. Reports to CTO Rajesh Sharma.',
    createdDate: '2024-03-20',
    lastActivity: '08 Sep 2024',
  },
  {
    id: 'CON-012',
    name: 'Meenakshi Sundaram',
    businessEntityId: 'BE-007',
    businessEntityName: 'Larsen & Toubro Ltd.',
    designation: 'IT Procurement Manager',
    department: 'Procurement',
    mobile: '+91 98567 89012',
    email: 'meenakshi.s@larsentoubro.com',
    locationLabel: 'Chennai Campus',
    isPrimary: false,
    status: 'Active',
    remarks: 'Manages vendor onboarding and procurement approvals for IT tools. Send all commercial proposals through her.',
    createdDate: '2023-09-15',
    lastActivity: '28 Aug 2024',
  },
];

export function contactStatusMeta(status: string) {
  if (status === 'Active') return { bg: '#edfbf1', color: '#1a8040', border: '#bbf0cf' };
  return { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
}

import { personInitials } from '../utils/text'

export function initialsAvatar(name: string) {
  return personInitials(name)
}

// Avatar gradient palette keyed by first letter
const AVATAR_GRADIENTS: Record<string, string> = {
  A: 'linear-gradient(135deg,#7c3aed,#2955a3)',
  B: 'linear-gradient(135deg,#0f7a50,#2955a3)',
  C: 'linear-gradient(135deg,#c41e1e,#b45309)',
  D: 'linear-gradient(135deg,#0c1a3a,#2955a3)',
  E: 'linear-gradient(135deg,#7c3aed,#c41e1e)',
  M: 'linear-gradient(135deg,#0f7a50,#1a8040)',
  P: 'linear-gradient(135deg,#7c3aed,#2955a3)',
  R: 'linear-gradient(135deg,#c41e1e,#2955a3)',
  S: 'linear-gradient(135deg,#b45309,#c41e1e)',
  K: 'linear-gradient(135deg,#0c1a3a,#7c3aed)',
  V: 'linear-gradient(135deg,#2955a3,#0f7a50)',
};
export function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[name.charAt(0).toUpperCase()] ?? 'linear-gradient(135deg,#0c1a3a,#2955a3)';
}
