import { currencySymbol } from "./currencies"

export type LeadStage = "New" | "Contacted" | "Requirement Identified" | "Under Qualification" | "Qualified" | "Converted to Opportunity"

export type LeadStatus = "Open" | "On Hold" | "Cold" | "Converted" | "Dropped/Lost"

export type LeadSource = "LinkedIn" | "Referral" | "Cold Call" | "Website" | "Trade Show" | "Email Campaign" | "Partner" | "Inbound"

export type LeadPriority = "High" | "Medium" | "Low"

export type LeadCurrency = string

export { LEAD_CURRENCIES } from "./currencies"

export interface LeadContactEntry {
  name: string
  email: string
  phones: string[]
  primary: boolean
}

export const LEAD_PRIORITIES: LeadPriority[] = ["High", "Medium", "Low"]

export const PRODUCT_TYPES = [
  "ERP Suite",
  "Analytics Module",
  "CRM Platform",
  "API Gateway",
  "Cloud Migration Services",
  "DevOps Toolchain",
  "Security Suite",
  "Supply Chain Management",
  "Network Management",
  "BSS/OSS",
  "Project Management Suite",
  "Loan Origination System",
  "Risk Analytics",
  "Regulatory Compliance",
  "QMS Software",
  "Logistics Management",
  "IoT Platform",
  "HRMS",
  "Payroll Software",
  "Core Banking Modernisation",
] as const

export interface Lead {
  id: string
  leadName: string
  companyName: string
  contactPerson: string
  email: string
  phone: string
  leadSource: LeadSource
  leadStage: LeadStage
  leadStatus: LeadStatus
  productsRequired: string
  opportunityValue: number
  expectedClosureDate?: string
  assignedSalesperson: string
  lastActivity: string
  createdAt: string
  description?: string
  estimatedLeadName?: string
  leadDescription?: string
  conversationDetails?: string
  taskId?: string
  taskName?: string
  taskDescription?: string
  priority?: LeadPriority
  productTypes?: string[]
  contacts?: LeadContactEntry[]
  valueCurrency?: LeadCurrency
}

export const LEADS: Lead[] = [
  {
    id: "LID-1001",
    leadName: "LID-1001",
    companyName: "Tata Consultancy Services",
    contactPerson: "Rajesh Sharma",
    email: "rajesh.sharma@tcs.com",
    phone: "+91 98101 23456",
    leadSource: "LinkedIn",
    leadStage: "Qualified",
    leadStatus: "Open",
    productsRequired: "ERP Suite, Analytics Module",
    opportunityValue: 42_00_000,
    expectedClosureDate: "2024-10-31",
    assignedSalesperson: "Priya Mehta",
    lastActivity: "2 hours ago",
    createdAt: "2024-09-01",
    contacts: [
      {
        name: "Rajesh Sharma",
        email: "rajesh.sharma@tcs.com",
        phones: ["+91 98101 23456"],
        primary: true,
      },
      {
        name: "Meera Iyer",
        email: "meera.iyer@tcs.com",
        phones: ["+91 98200 11880"],
        primary: false,
      },
      {
        name: "Deepak Malhotra",
        email: "deepak.malhotra@tcs.com",
        phones: ["+91 98201 34567"],
        primary: false,
      },
      {
        name: "Suresh Babu",
        email: "suresh.babu@tcs.com",
        phones: ["+91 98456 78901"],
        primary: false,
      },
      {
        name: "Anjali Menon",
        email: "anjali.menon@tcs.com",
        phones: ["+91 98202 44110"],
        primary: false,
      },
      {
        name: "Vikram Rao",
        email: "vikram.rao@tcs.com",
        phones: ["+91 98203 55221"],
        primary: false,
      },
      {
        name: "Pooja Nair",
        email: "pooja.nair@tcs.com",
        phones: ["+91 98204 66332"],
        primary: false,
      },
      {
        name: "Arun Krishnan",
        email: "arun.krishnan@tcs.com",
        phones: ["+91 98205 77443"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1002",
    leadName: "LID-1002",
    companyName: "Infosys Limited",
    contactPerson: "Anita Krishnan",
    email: "anita.k@infosys.com",
    phone: "+91 80756 34567",
    leadSource: "Referral",
    leadStage: "Requirement Identified",
    leadStatus: "Open",
    productsRequired: "CRM Platform, API Gateway",
    opportunityValue: 28_50_000,
    expectedClosureDate: "2024-11-15",
    assignedSalesperson: "Vikram Nair",
    lastActivity: "Yesterday",
    createdAt: "2024-09-03",
    contacts: [
      {
        name: "Anita Krishnan",
        email: "anita.k@infosys.com",
        phones: ["+91 80756 34567"],
        primary: true,
      },
      {
        name: "Prakash Iyer",
        email: "prakash.iyer@infosys.com",
        phones: ["+91 97654 32109"],
        primary: false,
      },
      {
        name: "Divya Nair",
        email: "divya.nair@infosys.com",
        phones: ["+91 98440 11223"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1003",
    leadName: "LID-1003",
    companyName: "Wipro Technologies",
    contactPerson: "Suresh Babu",
    email: "suresh.babu@wipro.com",
    phone: "+91 94432 56789",
    leadSource: "Cold Call",
    leadStage: "Contacted",
    leadStatus: "On Hold",
    productsRequired: "Cloud Migration Services",
    opportunityValue: 15_75_000,
    expectedClosureDate: "2024-12-20",
    assignedSalesperson: "Meena Iyer",
    lastActivity: "3 days ago",
    createdAt: "2024-09-05",
    contacts: [
      {
        name: "Suresh Babu",
        email: "suresh.babu@wipro.com",
        phones: ["+91 94432 56789"],
        primary: true,
      },
      {
        name: "Lakshmi Rao",
        email: "lakshmi.rao@wipro.com",
        phones: ["+91 98450 22110"],
        primary: false,
      },
      {
        name: "Harish Menon",
        email: "harish.menon@wipro.com",
        phones: ["+91 97410 55667"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1004",
    leadName: "LID-1004",
    companyName: "HCL Technologies",
    contactPerson: "Deepak Agarwal",
    email: "deepak.a@hcl.com",
    phone: "+91 91234 67890",
    leadSource: "Trade Show",
    leadStage: "Under Qualification",
    leadStatus: "Open",
    productsRequired: "DevOps Toolchain, Security Suite",
    opportunityValue: 36_20_000,
    expectedClosureDate: "2024-11-30",
    assignedSalesperson: "Arjun Patel",
    lastActivity: "1 day ago",
    createdAt: "2024-09-07",
    contacts: [
      {
        name: "Deepak Agarwal",
        email: "deepak.a@hcl.com",
        phones: ["+91 91234 67890"],
        primary: true,
      },
      {
        name: "Neha Kapoor",
        email: "neha.kapoor@hcl.com",
        phones: ["+91 98111 44550"],
        primary: false,
      },
      {
        name: "Karan Sethi",
        email: "karan.sethi@hcl.com",
        phones: ["+91 99100 22334"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1005",
    leadName: "LID-1005",
    companyName: "Mahindra & Mahindra",
    contactPerson: "Kavitha Reddy",
    email: "k.reddy@mahindra.com",
    phone: "+91 99870 12345",
    leadSource: "Website",
    leadStage: "Converted to Opportunity",
    leadStatus: "Converted",
    productsRequired: "Supply Chain Management",
    opportunityValue: 19_00_000,
    expectedClosureDate: "2025-01-15",
    assignedSalesperson: "Priya Mehta",
    lastActivity: "5 hours ago",
    createdAt: "2024-09-10",
    contacts: [
      {
        name: "Kavitha Reddy",
        email: "k.reddy@mahindra.com",
        phones: ["+91 99870 12345"],
        primary: true,
      },
      {
        name: "Amit Deshmukh",
        email: "amit.deshmukh@mahindra.com",
        phones: ["+91 98700 33441"],
        primary: false,
      },
      {
        name: "Rina Shah",
        email: "rina.shah@mahindra.com",
        phones: ["+91 98200 77889"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1006",
    leadName: "LID-1006",
    companyName: "Reliance Jio Infocomm",
    contactPerson: "Sanjay Gupta",
    email: "sanjay.gupta@jio.com",
    phone: "+91 77890 23456",
    leadSource: "Email Campaign",
    leadStage: "Converted to Opportunity",
    leadStatus: "Converted",
    productsRequired: "Network Management, BSS/OSS",
    opportunityValue: 85_00_000,
    expectedClosureDate: "2024-10-15",
    assignedSalesperson: "Vikram Nair",
    lastActivity: "30 mins ago",
    createdAt: "2024-08-28",
    contacts: [
      {
        name: "Sanjay Gupta",
        email: "sanjay.gupta@jio.com",
        phones: ["+91 77890 23456"],
        primary: true,
      },
      {
        name: "Farah Khan",
        email: "farah.khan@jio.com",
        phones: ["+91 98202 66770"],
        primary: false,
      },
      {
        name: "Imran Qureshi",
        email: "imran.qureshi@jio.com",
        phones: ["+91 97690 33445"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1007",
    leadName: "LID-1007",
    companyName: "Larsen & Toubro",
    contactPerson: "Ravi Shankar",
    email: "r.shankar@lntecc.com",
    phone: "+91 88012 34567",
    leadSource: "Partner",
    leadStage: "Converted to Opportunity",
    leadStatus: "Converted",
    productsRequired: "Project Management Suite, ERP",
    opportunityValue: 1_20_00_000,
    expectedClosureDate: "2024-09-30",
    assignedSalesperson: "Arjun Patel",
    lastActivity: "6 days ago",
    createdAt: "2024-08-15",
    contacts: [
      {
        name: "Ravi Shankar",
        email: "r.shankar@lntecc.com",
        phones: ["+91 88012 34567"],
        primary: true,
      },
      {
        name: "Meenakshi Sundaram",
        email: "meenakshi.s@larsentoubro.com",
        phones: ["+91 98567 89012"],
        primary: false,
      },
      {
        name: "Arvind Pillai",
        email: "arvind.pillai@lntecc.com",
        phones: ["+91 98840 66778"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1008",
    leadName: "LID-1008",
    companyName: "Bajaj Finserv",
    contactPerson: "Pooja Joshi",
    email: "pooja.joshi@bajajfinserv.in",
    phone: "+91 96543 78901",
    leadSource: "LinkedIn",
    leadStage: "Contacted",
    leadStatus: "Cold",
    productsRequired: "Loan Origination System, Risk Analytics",
    opportunityValue: 55_00_000,
    expectedClosureDate: "2025-02-28",
    assignedSalesperson: "Meena Iyer",
    lastActivity: "2 weeks ago",
    createdAt: "2024-08-20",
    contacts: [
      {
        name: "Pooja Joshi",
        email: "pooja.joshi@bajajfinserv.in",
        phones: ["+91 96543 78901"],
        primary: true,
      },
      {
        name: "Rohit Kulkarni",
        email: "rohit.kulkarni@bajajfinserv.in",
        phones: ["+91 97631 22008"],
        primary: false,
      },
      {
        name: "Sneha Patil",
        email: "sneha.patil@bajajfinserv.in",
        phones: ["+91 98810 44556"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1009",
    leadName: "LID-1009",
    companyName: "Sun Pharmaceutical",
    contactPerson: "Dr. Ashok Mehta",
    email: "a.mehta@sunpharma.com",
    phone: "+91 92345 56789",
    leadSource: "Referral",
    leadStage: "Requirement Identified",
    leadStatus: "Open",
    productsRequired: "Regulatory Compliance, QMS Software",
    opportunityValue: 31_50_000,
    expectedClosureDate: "2024-12-01",
    assignedSalesperson: "Priya Mehta",
    lastActivity: "4 hours ago",
    createdAt: "2024-09-08",
    contacts: [
      {
        name: "Dr. Ashok Mehta",
        email: "a.mehta@sunpharma.com",
        phones: ["+91 92345 56789"],
        primary: true,
      },
      {
        name: "Shalini Menon",
        email: "shalini.menon@sunpharma.com",
        phones: ["+91 99022 11880"],
        primary: false,
      },
      {
        name: "Nikhil Bhatt",
        email: "nikhil.bhatt@sunpharma.com",
        phones: ["+91 97250 88990"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1010",
    leadName: "LID-1010",
    companyName: "Adani Ports & SEZ",
    contactPerson: "Nilesh Shah",
    email: "nilesh.shah@adani.com",
    phone: "+91 87654 90123",
    leadSource: "Cold Call",
    leadStage: "New",
    leadStatus: "Dropped/Lost",
    productsRequired: "Logistics Management, IoT Platform",
    opportunityValue: 68_00_000,
    expectedClosureDate: "2024-11-01",
    assignedSalesperson: "Vikram Nair",
    lastActivity: "1 month ago",
    createdAt: "2024-08-01",
    contacts: [
      {
        name: "Nilesh Shah",
        email: "nilesh.shah@adani.com",
        phones: ["+91 87654 90123"],
        primary: true,
      },
      {
        name: "Priyanka Bose",
        email: "priyanka.bose@adani.com",
        phones: ["+91 98123 55660"],
        primary: false,
      },
      {
        name: "Manish Trivedi",
        email: "manish.trivedi@adani.com",
        phones: ["+91 98790 11224"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1011",
    leadName: "LID-1011",
    companyName: "Godrej Industries",
    contactPerson: "Smita Kulkarni",
    email: "smita.k@godrej.com",
    phone: "+91 93456 01234",
    leadSource: "Trade Show",
    leadStage: "Under Qualification",
    leadStatus: "Open",
    productsRequired: "HRMS, Payroll Software",
    opportunityValue: 22_80_000,
    expectedClosureDate: "2024-11-20",
    assignedSalesperson: "Arjun Patel",
    lastActivity: "3 hours ago",
    createdAt: "2024-09-09",
    contacts: [
      {
        name: "Smita Kulkarni",
        email: "smita.k@godrej.com",
        phones: ["+91 93456 01234"],
        primary: true,
      },
      {
        name: "Vivek Banerjee",
        email: "vivek.banerjee@godrej.com",
        phones: ["+91 98300 77441"],
        primary: false,
      },
      {
        name: "Tara Fernandes",
        email: "tara.fernandes@godrej.com",
        phones: ["+91 98204 55661"],
        primary: false,
      },
    ],
  },
  {
    id: "LID-1012",
    leadName: "LID-1012",
    companyName: "HDFC Bank",
    contactPerson: "Ramesh Nambiar",
    email: "r.nambiar@hdfcbank.com",
    phone: "+91 98234 12345",
    leadSource: "Inbound",
    leadStage: "Converted to Opportunity",
    leadStatus: "Converted",
    productsRequired: "Core Banking Modernisation",
    opportunityValue: 2_50_00_000,
    expectedClosureDate: "2025-03-31",
    assignedSalesperson: "Meena Iyer",
    lastActivity: "1 hour ago",
    createdAt: "2024-09-11",
    contacts: [
      {
        name: "Ramesh Nambiar",
        email: "r.nambiar@hdfcbank.com",
        phones: ["+91 98234 12345"],
        primary: true,
      },
      {
        name: "Anjali Desai",
        email: "anjali.desai@hdfcbank.com",
        phones: ["+91 98765 44021"],
        primary: false,
      },
      {
        name: "Mohit Saxena",
        email: "mohit.saxena@hdfcbank.com",
        phones: ["+91 98198 33440"],
        primary: false,
      },
    ],
  },
]

export function formatINR(value: number): string {
  if (value >= 10_000_000) {
    return `₹${(value / 10_000_000).toFixed(2)} Cr`
  }
  if (value >= 100_000) {
    return `₹${(value / 100_000).toFixed(2)} L`
  }
  return `₹${value.toLocaleString("en-IN")}`
}

export const LEAD_STAGES: LeadStage[] = [
  "New",
  "Contacted",
  "Requirement Identified",
  "Under Qualification",
  "Qualified",
  "Converted to Opportunity",
]

export const LEAD_STATUSES: LeadStatus[] = [
  "Open",
  "On Hold",
  "Cold",
  "Converted",
  "Dropped/Lost",
]

export const LEAD_SOURCES: LeadSource[] = [
  "LinkedIn",
  "Referral",
  "Cold Call",
  "Website",
  "Trade Show",
  "Email Campaign",
  "Partner",
  "Inbound",
]

/** Mock-dataset clock used by 360° summaries so overdue / upcoming stay meaningful. */
export const CRM_AS_OF = "2024-09-18"

export interface LeadRequirementExtra {
  approximateQuantity: string
  requirementDetails: string
  remarks: string
}

export const LEAD_REQUIREMENT_EXTRAS: Record<string, LeadRequirementExtra> = {
  "LID-1001": {
    approximateQuantity: "3,200 user licenses",
    requirementDetails:
      "Multi-entity ERP with GSTIN billing, consolidated P&L and an advanced analytics module. Must integrate with existing SAP HCM and support SOC 2 Type II controls.",
    remarks:
      "CTO and CISO jointly evaluating. Budget pre-approved for FY25. Board presentation targeted for 30 Sep.",
  },
  "LID-1002": {
    approximateQuantity: "1,800 seats + API gateway",
    requirementDetails:
      "CRM platform with lead-to-order flow and an API gateway to the existing SAP landscape. Sandbox evaluation requested before commercial discussion.",
    remarks:
      "VP Technology wants 2-week sandbox access. IT operations (Prakash Iyer) will run the technical trial.",
  },
  "LID-1003": {
    approximateQuantity: "Cloud migration for 4 BUs",
    requirementDetails:
      "Lift-and-shift plus re-platform of core workloads. Preference for a phased migration with rollback windows and 24×7 hypercare.",
    remarks:
      "Currently On Hold pending internal budget reforecast. Revisit after Q3 close.",
  },
  "LID-1004": {
    approximateQuantity: "DevOps toolchain + 12 security seats",
    requirementDetails:
      "End-to-end DevOps toolchain and enterprise security suite covering SAST, secrets and container scanning.",
    remarks:
      "Qualification in progress. Need to confirm buying centre and FY25 security budget owner.",
  },
  "LID-1005": {
    approximateQuantity: "Supply chain across 3 plants",
    requirementDetails:
      "Supply-chain management covering plant, dealer and spare-parts visibility for Auto and Farm Equipment divisions.",
    remarks: "Inbound website enquiry. First discovery still pending.",
  },
  "LID-1006": {
    approximateQuantity: "Network + BSS/OSS for 5 circles",
    requirementDetails:
      "Network management with BSS/OSS modernisation. Commercial negotiation in final round; floor discount authorised at 10%.",
    remarks:
      "GM Technology authorised to close. Expects a minimum 15% discount — hold the line at 10%.",
  },
  "LID-1007": {
    approximateQuantity: "Multi-project EPC portfolio",
    requirementDetails:
      "Project management suite integrated with the existing Oracle ERP for milestone tracking across EPC programmes.",
    remarks: "Converted to opportunity. Handoff to delivery in progress.",
  },
  "LID-1008": {
    approximateQuantity: "LOS + risk analytics, 40 branches",
    requirementDetails:
      "Loan origination system with risk analytics for the digital-first NBFC stack. Board has a pre-allocated transformation budget.",
    remarks: "Gone Cold after initial contact. Re-engage via referral in Q4.",
  },
  "LID-1009": {
    approximateQuantity: "QMS for 2 manufacturing sites",
    requirementDetails:
      "QMS and regulatory compliance covering FDA 21 CFR Part 11, CDSCO and EU Annex 11. Board review on 25 Sep.",
    remarks:
      "Compliance is non-negotiable. Keep regulatory whitepaper in the pack.",
  },
  "LID-1010": {
    approximateQuantity: "IoT + logistics, 8 terminals",
    requirementDetails:
      "Logistics management and IoT platform for port operations and hinterland connectivity.",
    remarks:
      "Dropped/Lost — competitor locked a multi-year contract. Keep on nurture list.",
  },
  "LID-1011": {
    approximateQuantity: "HRMS + payroll, 8,000 employees",
    requirementDetails:
      "HRMS and payroll covering multi-entity statutory compliance and self-service for corporate and plant staff.",
    remarks:
      "Under qualification. Confirm HRIS owner and payroll vendor lock-in.",
  },
  "LID-1012": {
    approximateQuantity: "Core banking modernisation, 5-year TCO",
    requirementDetails:
      "Core banking modernisation with RBI compliance, data residency and digital-banking integration. 5-year TCO vs legacy is the decision frame.",
    remarks:
      "CTO is the decision-maker. Compliance and data residency are the critical gates.",
  },
}

export function getLeadRequirement(lead: Lead): LeadRequirementExtra {
  return (
    LEAD_REQUIREMENT_EXTRAS[lead.id] ?? {
      approximateQuantity: "To be confirmed",
      requirementDetails: lead.productsRequired,
      remarks: "",
    }
  )
}

export function leadDescriptionOf(lead: Lead): string {
  const written = (lead.description ?? lead.leadDescription ?? "").trim()
  if (written) return written
  return getLeadRequirement(lead).requirementDetails
}

export function displayLeadName(lead: Lead): string {
  if (lead.leadName && lead.leadName !== lead.id) return lead.leadName
  return `${lead.companyName} — ${lead.productsRequired}`
}

export function leadProductList(lead: Lead): string[] {
  if (lead.productTypes?.length) return lead.productTypes
  return lead.productsRequired.split(",").map((item) => item.trim()).filter(Boolean)
}

export function leadContactsOf(lead: Lead): LeadContactEntry[] {
  if (lead.contacts?.length) return lead.contacts
  return [
    {
      name: lead.contactPerson,
      email: lead.email,
      phones: lead.phone ? [lead.phone] : [],
      primary: true,
    },
  ]
}

export function primaryLeadContact(lead: Lead): LeadContactEntry {
  const list = leadContactsOf(lead)
  return list.find((item) => item.primary) ?? list[0]
}

export function secondaryLeadContacts(lead: Lead): LeadContactEntry[] {
  return leadContactsOf(lead).filter((item) => !item.primary)
}

export function leadPriorityOf(lead: Lead): LeadPriority {
  return lead.priority ?? "Medium"
}

export function formatLeadValue(lead: Lead): string {
  const code = lead.valueCurrency ?? "INR"
  if (code === "INR") return formatINR(lead.opportunityValue)
  const amount = lead.opportunityValue.toLocaleString("en-US")
  const symbol = currencySymbol(code).trim()
  if (/[\u0600-\u06FF]/.test(symbol)) {
    return `${code} ${amount}`
  }
  return `${symbol}\u00A0${amount}`
}

export function formatLeadDate(iso: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function normalizeOrgName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd\.?|limited|industries|pvt\.?|private|inc\.?|& sez)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
}

const LEAD_STAGE_CLASS: Record<string, string> = {
  New: "stage-new",
  Contacted: "stage-contacted",
  "Requirement Identified": "stage-requirement",
  "Under Qualification": "stage-qualification",
  Qualified: "stage-qualified",
  "Converted to Opportunity": "stage-converted",
}

const LEAD_STATUS_CLASS: Record<string, string> = {
  Open: "status-open",
  "On Hold": "status-onhold",
  Cold: "status-cold",
  Converted: "status-converted",
  "Dropped/Lost": "status-dropped",
}

/** CSS badge class for a lead pipeline stage. */
export function leadStageClass(stage: string) {
  return LEAD_STAGE_CLASS[stage] ?? "stage-new"
}

/** CSS badge class for a lead disposition status. */
export function leadStatusClass(status: string) {
  return LEAD_STATUS_CLASS[status] ?? "status-open"
}

export type LeadStagePalette = { bg: string; text: string; border: string }

const LEAD_STAGE_PALETTE: Record<string, LeadStagePalette> = {
  New: { bg: "#edfbf1", text: "#1a8040", border: "#bbf0cf" },
  Contacted: { bg: "#eef3fc", text: "#2955a3", border: "#c2d3f5" },
  "Requirement Identified": { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
  "Under Qualification": { bg: "#fdf4ff", text: "#7c3aed", border: "#e9d5ff" },
  Qualified: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" },
  "Converted to Opportunity": { bg: "#eef3fc", text: "#1e3f87", border: "#c2d3f5" },
}

const DEFAULT_LEAD_STAGE_PALETTE: LeadStagePalette = {
  bg: "#f0f4fb",
  text: "#4a5d82",
  border: "#dce4f2",
}

/** Soft palette for kanban column chrome / stage chips. */
export function leadStagePalette(stage: string): LeadStagePalette {
  return LEAD_STAGE_PALETTE[stage] ?? DEFAULT_LEAD_STAGE_PALETTE
}
