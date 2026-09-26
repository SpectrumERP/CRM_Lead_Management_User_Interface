export type EntityType = 'Prospect' | 'Customer' | 'Dealer' | 'Distributor' | 'Other';
export type EntityStatus = 'Prospect' | 'Customer' | 'Inactive';

export interface EntityLocation {
  id: string;
  label: string;       // e.g. "Head Office", "Mumbai Plant"
  address: string;
  city: string;
  state: string;
  country: string;
  territory: string;
  preferredPort: string;
  isPrimary: boolean;
}

export interface EntityContact {
  id: string;
  name: string;
  designation: string;
  department: string;
  mobile: string;
  email: string;
  isPrimary: boolean;
}

export interface BusinessEntity {
  id: string;
  name: string;
  type: EntityType;
  website: string;
  gstin: string;
  status: EntityStatus;
  locations: EntityLocation[];
  contacts: EntityContact[];
  products: string;
  remarks: string;
  salesperson: string;
  createdDate: string;
  activeLeads: number;
  lastActivity: string;
}

export const ENTITY_TYPES: EntityType[] = ['Prospect', 'Customer', 'Dealer', 'Distributor', 'Other'];
export const ENTITY_STATUSES: EntityStatus[] = ['Prospect', 'Customer', 'Inactive'];

export const TERRITORIES = [
  'North India – Delhi NCR',
  'North India – Punjab & Haryana',
  'West India – Maharashtra',
  'West India – Gujarat',
  'South India – Karnataka',
  'South India – Tamil Nadu',
  'South India – Telangana & AP',
  'East India – West Bengal',
  'East India – Odisha',
  'Central India – MP & Chhattisgarh',
  'Pan India',
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'West Bengal', 'Delhi', 'Odisha',
];

export const SALESPERSONS = [
  'Priya Mehta', 'Vikram Nair', 'Arjun Patel', 'Meena Iyer', 'Rohan Desai', 'Sunita Rao',
];

export const BUSINESS_ENTITIES: BusinessEntity[] = [
  {
    id: 'BE-001',
    name: 'Tata Consultancy Services Ltd.',
    type: 'Customer',
    website: 'www.tcs.com',
    gstin: '27AABCT1332L000',
    status: 'Customer',
    salesperson: 'Priya Mehta',
    createdDate: '2024-01-15',
    activeLeads: 3,
    lastActivity: '17 Sep 2024',
    products: 'ERP Suite, Advanced Analytics Module, CRM Platform',
    remarks: 'Tier-1 IT services company. Multiple business units. Decision cycle 6–9 months. Budget pre-approved for FY25.',
    locations: [
      {
        id: 'L001', label: 'Head Office', address: 'TCS House, Raveline Street, Fort',
        city: 'Mumbai', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: 'JNPT, Nhava Sheva',
        isPrimary: true,
      },
      {
        id: 'L002', label: 'Pune Delivery Centre', address: 'Hinjewadi Phase II, IT Park',
        city: 'Pune', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: '',
        isPrimary: false,
      },
      {
        id: 'L003', label: 'Bengaluru Office', address: 'Manyata Tech Park, Nagavara',
        city: 'Bengaluru', state: 'Karnataka', country: 'India',
        territory: 'South India – Karnataka', preferredPort: '',
        isPrimary: false,
      },
    ],
    contacts: [
      {
        id: 'C001', name: 'Rajesh Sharma', designation: 'Chief Technology Officer',
        department: 'IT / Technology', mobile: '+91 98101 23456',
        email: 'rajesh.sharma@tcs.com', isPrimary: true,
      },
      {
        id: 'C002', name: 'Deepak Malhotra', designation: 'Chief Information Security Officer',
        department: 'Information Security', mobile: '+91 98201 34567',
        email: 'deepak.malhotra@tcs.com', isPrimary: false,
      },
    ],
  },
  {
    id: 'BE-002',
    name: 'Infosys Limited',
    type: 'Customer',
    website: 'www.infosys.com',
    gstin: '29AAACI1681G1ZK',
    status: 'Customer',
    salesperson: 'Vikram Nair',
    createdDate: '2024-02-10',
    activeLeads: 2,
    lastActivity: '14 Sep 2024',
    products: 'CRM Platform, API Gateway, Document Management',
    remarks: 'Global IT company. Key contact VP Technology – Anita Krishnan. SAP landscape existing.',
    locations: [
      {
        id: 'L004', label: 'Electronic City Campus', address: 'Electronics City Phase 1',
        city: 'Bengaluru', state: 'Karnataka', country: 'India',
        territory: 'South India – Karnataka', preferredPort: '',
        isPrimary: true,
      },
      {
        id: 'L005', label: 'Pune Software Park', address: 'Rajiv Gandhi Infotech Park, Hinjewadi',
        city: 'Pune', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: '',
        isPrimary: false,
      },
    ],
    contacts: [
      {
        id: 'C003', name: 'Anita Krishnan', designation: 'VP Technology',
        department: 'Technology', mobile: '+91 98765 43210',
        email: 'anita.krishnan@infosys.com', isPrimary: true,
      },
      {
        id: 'C004', name: 'Prakash Iyer', designation: 'IT Manager',
        department: 'IT Operations', mobile: '+91 97654 32109',
        email: 'prakash.iyer@infosys.com', isPrimary: false,
      },
    ],
  },
  {
    id: 'BE-003',
    name: 'Reliance Jio Infocomm Ltd.',
    type: 'Prospect',
    website: 'www.jio.com',
    gstin: '27AABCR0148P1ZX',
    status: 'Prospect',
    salesperson: 'Priya Mehta',
    createdDate: '2024-03-05',
    activeLeads: 1,
    lastActivity: '19 Sep 2024',
    products: 'ERP Suite, Billing Engine, Customer Analytics',
    remarks: 'Telecom giant. GM Tech – Sanjay Gupta is primary contact. Budget confirmed above ₹5Cr. Final negotiation stage.',
    locations: [
      {
        id: 'L006', label: 'Jio World Centre', address: 'G Block, BKC',
        city: 'Mumbai', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: 'JNPT, Nhava Sheva',
        isPrimary: true,
      },
    ],
    contacts: [
      {
        id: 'C005', name: 'Sanjay Gupta', designation: 'GM Technology',
        department: 'Technology', mobile: '+91 98112 45678',
        email: 'sanjay.gupta@jio.com', isPrimary: true,
      },
    ],
  },
  {
    id: 'BE-004',
    name: 'HDFC Bank Ltd.',
    type: 'Prospect',
    website: 'www.hdfcbank.com',
    gstin: '27AABCH0942F1ZM',
    status: 'Prospect',
    salesperson: 'Meena Iyer',
    createdDate: '2024-04-20',
    activeLeads: 1,
    lastActivity: '09 Sep 2024',
    products: 'Core Banking Solution, Compliance Module',
    remarks: 'India\'s largest private bank. CTO Ramesh Nambiar is decision maker. RBI compliance and data residency are critical requirements.',
    locations: [
      {
        id: 'L007', label: 'Head Office', address: 'HDFC Bank House, Senapati Bapat Marg',
        city: 'Mumbai', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: '',
        isPrimary: true,
      },
    ],
    contacts: [
      {
        id: 'C006', name: 'Ramesh Nambiar', designation: 'Chief Technology Officer',
        department: 'Technology', mobile: '+91 98900 12345',
        email: 'ramesh.nambiar@hdfcbank.com', isPrimary: true,
      },
    ],
  },
  {
    id: 'BE-005',
    name: 'Sun Pharmaceutical Industries',
    type: 'Prospect',
    website: 'www.sunpharma.com',
    gstin: '24AAECS1645J1Z3',
    status: 'Prospect',
    salesperson: 'Priya Mehta',
    createdDate: '2024-05-08',
    activeLeads: 1,
    lastActivity: '16 Sep 2024',
    products: 'QMS Platform, Regulatory Compliance Module',
    remarks: 'World\'s 4th largest specialty pharma company. FDA 21 CFR Part 11 compliance mandatory. Board review on 25 Sep 2024.',
    locations: [
      {
        id: 'L008', label: 'Corporate Office', address: 'Sun Pharma Advanced Research Centre, Tandalja',
        city: 'Vadodara', state: 'Gujarat', country: 'India',
        territory: 'West India – Gujarat', preferredPort: 'Mundra Port',
        isPrimary: true,
      },
      {
        id: 'L009', label: 'Mumbai R&D Centre', address: 'Akruti Trade Centre, Road No. 7, MIDC',
        city: 'Mumbai', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: '',
        isPrimary: false,
      },
    ],
    contacts: [
      {
        id: 'C007', name: 'Dr. Ashok Mehta', designation: 'VP Operations',
        department: 'Operations', mobile: '+91 99001 23456',
        email: 'ashok.mehta@sunpharma.com', isPrimary: true,
      },
    ],
  },
  {
    id: 'BE-006',
    name: 'Mahindra & Mahindra Ltd.',
    type: 'Customer',
    website: 'www.mahindra.com',
    gstin: '27AABCM4706C1Z3',
    status: 'Customer',
    salesperson: 'Arjun Patel',
    createdDate: '2023-11-12',
    activeLeads: 2,
    lastActivity: '05 Sep 2024',
    products: 'ERP Suite, Supply Chain Management, Dealer Network Module',
    remarks: 'Large conglomerate. Multiple divisions. Auto & Farm Equipment are key verticals.',
    locations: [
      {
        id: 'L010', label: 'Gateway Building', address: 'Apollo Bunder, Colaba',
        city: 'Mumbai', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: 'JNPT, Nhava Sheva',
        isPrimary: true,
      },
    ],
    contacts: [
      {
        id: 'C008', name: 'Kavitha Reddy', designation: 'Group CIO',
        department: 'Information Technology', mobile: '+91 98234 56789',
        email: 'kavitha.reddy@mahindra.com', isPrimary: true,
      },
    ],
  },
  {
    id: 'BE-007',
    name: 'Larsen & Toubro Ltd.',
    type: 'Customer',
    website: 'www.larsentoubro.com',
    gstin: '27AAACL0112J1ZQ',
    status: 'Customer',
    salesperson: 'Rohan Desai',
    createdDate: '2023-09-01',
    activeLeads: 1,
    lastActivity: '01 Sep 2024',
    products: 'Project Management Suite, EPC Analytics',
    remarks: 'Engineering & construction conglomerate. Complex multi-project tracking requirement.',
    locations: [
      {
        id: 'L011', label: 'L&T House', address: 'Ballard Estate',
        city: 'Mumbai', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: 'JNPT, Nhava Sheva',
        isPrimary: true,
      },
      {
        id: 'L012', label: 'Chennai Campus', address: 'L&T Campus, Mount Poonamallee Road',
        city: 'Chennai', state: 'Tamil Nadu', country: 'India',
        territory: 'South India – Tamil Nadu', preferredPort: 'Chennai Port',
        isPrimary: false,
      },
    ],
    contacts: [
      {
        id: 'C009', name: 'Ravi Shankar', designation: 'Chief Digital Officer',
        department: 'Digital & IT', mobile: '+91 98345 67890',
        email: 'ravi.shankar@larsentoubro.com', isPrimary: true,
      },
    ],
  },
  {
    id: 'BE-008',
    name: 'Bajaj Finserv Ltd.',
    type: 'Prospect',
    website: 'www.bajajfinserv.in',
    gstin: '27AABCB8766Q1ZK',
    status: 'Prospect',
    salesperson: 'Sunita Rao',
    createdDate: '2024-06-15',
    activeLeads: 1,
    lastActivity: '10 Aug 2024',
    products: 'Loan Origination System, Collections Module',
    remarks: 'Leading NBFC. Digital-first transformation in progress. VP IT is key contact.',
    locations: [
      {
        id: 'L013', label: 'Corporate Office', address: 'Bajaj Finserv Corporate Office, Viman Nagar',
        city: 'Pune', state: 'Maharashtra', country: 'India',
        territory: 'West India – Maharashtra', preferredPort: '',
        isPrimary: true,
      },
    ],
    contacts: [
      {
        id: 'C010', name: 'Pooja Joshi', designation: 'VP Information Technology',
        department: 'IT', mobile: '+91 97890 12345',
        email: 'pooja.joshi@bajajfinserv.in', isPrimary: true,
      },
    ],
  },
];

export function entityTypeMeta(type: string) {
  const m: Record<string, { bg: string; color: string; border: string }> = {
    'Prospect':    { bg: '#eef3fc', color: '#2955a3', border: '#c2d3f5' },
    'Customer':    { bg: '#edfbf1', color: '#1a8040', border: '#bbf0cf' },
    'Dealer':      { bg: '#fdf4ff', color: '#7c3aed', border: '#e9d5ff' },
    'Distributor': { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    'Other':       { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' },
  };
  return m[type] ?? m['Other'];
}

export function entityStatusMeta(status: string) {
  if (status === 'Customer')  return { bg: '#edfbf1', color: '#1a8040', border: '#bbf0cf' };
  if (status === 'Inactive')  return { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
  return { bg: '#fffbeb', color: '#b45309', border: '#fde68a' }; // Prospect
}
