import { createContext, useContext, useState, ReactNode } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type MasterItemStatus = 'Active' | 'Inactive';

export interface LeadSourceItem {
  id: string;
  name: string;
  description: string;
  status: MasterItemStatus;
  createdDate: string;
}

export interface LeadStageItem {
  id: string;
  name: string;
  displayOrder: number;
  status: MasterItemStatus;
}

export interface LeadStatusItem {
  id: string;
  name: string;
  description: string;
  status: MasterItemStatus;
}

export interface EntityTypeItem {
  id: string;
  name: string;
  status: MasterItemStatus;
}

export interface ActivityTypeItem {
  id: string;
  name: string;
  status: MasterItemStatus;
}

export interface MasterData {
  leadSources: LeadSourceItem[];
  leadStages: LeadStageItem[];
  leadStatuses: LeadStatusItem[];
  entityTypes: EntityTypeItem[];
  activityTypes: ActivityTypeItem[];
}

// ─── Default data ─────────────────────────────────────────────────────────────
const DEFAULT_LEAD_SOURCES: LeadSourceItem[] = [
  { id: 'LS1', name: 'Exhibition', description: 'Leads from trade fairs and exhibitions', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS2', name: 'Cold Calling', description: 'Outbound telephone prospecting', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS3', name: 'Existing Customer', description: 'Upsell or cross-sell to current accounts', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS4', name: 'Website', description: 'Enquiries from the company website', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS5', name: 'Referral', description: 'Introduced by an existing customer or partner', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS6', name: 'Email Campaign', description: 'Responses from email marketing campaigns', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS7', name: 'LinkedIn', description: 'Leads sourced through LinkedIn outreach', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS8', name: 'Trade Show', description: 'Industry events and trade shows', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS9', name: 'Partner', description: 'Channel or alliance partner referrals', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS10', name: 'Inbound', description: 'Walk-in or direct inbound enquiry', status: 'Active', createdDate: '01 Jan 2024' },
  { id: 'LS11', name: 'Other', description: 'Any other lead source not listed above', status: 'Active', createdDate: '01 Jan 2024' },
];

const DEFAULT_LEAD_STAGES: LeadStageItem[] = [
  { id: 'LST1', name: 'New', displayOrder: 1, status: 'Active' },
  { id: 'LST2', name: 'Contacted', displayOrder: 2, status: 'Active' },
  { id: 'LST3', name: 'Requirement Identified', displayOrder: 3, status: 'Active' },
  { id: 'LST4', name: 'Under Qualification', displayOrder: 4, status: 'Active' },
  { id: 'LST5', name: 'Qualified', displayOrder: 5, status: 'Active' },
  { id: 'LST6', name: 'Converted to Opportunity', displayOrder: 6, status: 'Active' },
];

const DEFAULT_LEAD_STATUSES: LeadStatusItem[] = [
  { id: 'LSTS1', name: 'Open', description: 'Lead is actively being pursued', status: 'Active' },
  { id: 'LSTS2', name: 'On Hold', description: 'Lead is paused, to be revisited later', status: 'Active' },
  { id: 'LSTS3', name: 'Cold', description: 'Lead has gone unresponsive or uninterested', status: 'Active' },
  { id: 'LSTS4', name: 'Converted', description: 'Lead has been converted to an opportunity', status: 'Active' },
  { id: 'LSTS5', name: 'Dropped/Lost', description: 'Lead closed without a sale', status: 'Active' },
];

const DEFAULT_ENTITY_TYPES: EntityTypeItem[] = [
  { id: 'ET1', name: 'Prospect', status: 'Active' },
  { id: 'ET2', name: 'Customer', status: 'Active' },
  { id: 'ET3', name: 'Dealer', status: 'Active' },
  { id: 'ET4', name: 'Distributor', status: 'Active' },
  { id: 'ET5', name: 'Other', status: 'Active' },
];

const DEFAULT_ACTIVITY_TYPES: ActivityTypeItem[] = [
  { id: 'AT1', name: 'Task', status: 'Active' },
  { id: 'AT2', name: 'Follow-up', status: 'Active' },
  { id: 'AT3', name: 'Phone Call', status: 'Active' },
  { id: 'AT4', name: 'Meeting', status: 'Active' },
  { id: 'AT5', name: 'Customer Visit', status: 'Active' },
  { id: 'AT6', name: 'Online Meeting', status: 'Active' },
  { id: 'AT7', name: 'Requirement Discussion', status: 'Active' },
  { id: 'AT8', name: 'Commercial Discussion', status: 'Active' },
  { id: 'AT9', name: 'Negotiation', status: 'Active' },
  { id: 'AT10', name: 'Document Submission', status: 'Active' },
  { id: 'AT11', name: 'Other', status: 'Active' },
];

// ─── Context ──────────────────────────────────────────────────────────────────
interface MasterDataContextValue {
  data: MasterData;
  setLeadSources: (v: LeadSourceItem[]) => void;
  setLeadStages: (v: LeadStageItem[]) => void;
  setLeadStatuses: (v: LeadStatusItem[]) => void;
  setEntityTypes: (v: EntityTypeItem[]) => void;
  setActivityTypes: (v: ActivityTypeItem[]) => void;
  // Convenience: active items only
  activeLeadSourceNames: string[];
  activeLeadStageNames: string[];
  activeLeadStatusNames: string[];
  activeEntityTypeNames: string[];
  activeActivityTypeNames: string[];
}

const MasterDataContext = createContext<MasterDataContextValue | null>(null);

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [leadSources, setLeadSources] = useState<LeadSourceItem[]>(DEFAULT_LEAD_SOURCES);
  const [leadStages, setLeadStages] = useState<LeadStageItem[]>(DEFAULT_LEAD_STAGES);
  const [leadStatuses, setLeadStatuses] = useState<LeadStatusItem[]>(DEFAULT_LEAD_STATUSES);
  const [entityTypes, setEntityTypes] = useState<EntityTypeItem[]>(DEFAULT_ENTITY_TYPES);
  const [activityTypes, setActivityTypes] = useState<ActivityTypeItem[]>(DEFAULT_ACTIVITY_TYPES);

  const data: MasterData = { leadSources, leadStages, leadStatuses, entityTypes, activityTypes };

  const activeLeadSourceNames = leadSources.filter((x) => x.status === 'Active').map((x) => x.name);
  const activeLeadStageNames = leadStages.filter((x) => x.status === 'Active').sort((a, b) => a.displayOrder - b.displayOrder).map((x) => x.name);
  const activeLeadStatusNames = leadStatuses.filter((x) => x.status === 'Active').map((x) => x.name);
  const activeEntityTypeNames = entityTypes.filter((x) => x.status === 'Active').map((x) => x.name);
  const activeActivityTypeNames = activityTypes.filter((x) => x.status === 'Active').map((x) => x.name);

  return (
    <MasterDataContext.Provider value={{
      data,
      setLeadSources, setLeadStages, setLeadStatuses, setEntityTypes, setActivityTypes,
      activeLeadSourceNames, activeLeadStageNames, activeLeadStatusNames,
      activeEntityTypeNames, activeActivityTypeNames,
    }}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData(): MasterDataContextValue {
  const ctx = useContext(MasterDataContext);
  if (!ctx) throw new Error('useMasterData must be used inside MasterDataProvider');
  return ctx;
}
