import { useState } from 'react';
import type { ToastType } from '../components/Toast';
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice';
import { SelectField, CountBadge, Spinner } from '../ui';
import { masterApis } from '../api/masters';
import { useSpectrumCompany } from '../auth/useSpectrumCompany';
import { C } from './settings/atoms';
import ApiMasterSection from './settings/ApiMasterSection';
import { useApiMaster } from './settings/useApiMaster';

interface Props {
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Master data — Spectrum server only (Swagger CRUD under /api/master: save / load-data / search-data / delete).
// ══════════════════════════════════════════════════════════════════════════════

type TabGroup = 'lead' | 'opportunity' | 'general';

const SETTING_TABS = [
  { id: 'sources', group: 'lead', label: 'Lead Sources', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /> },
  { id: 'stages', group: 'lead', label: 'Lead Stages', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /> },
  { id: 'statuses', group: 'lead', label: 'Lead Statuses', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { id: 'priorities', group: 'lead', label: 'Lead Priorities', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" /> },
  { id: 'oppStages', group: 'opportunity', label: 'Opportunity Stages', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
  { id: 'oppStatuses', group: 'opportunity', label: 'Opportunity Statuses', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /> },
  { id: 'products', group: 'opportunity', label: 'Products', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
  { id: 'activityTypes', group: 'general', label: 'Activity Types', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
] as const;

const TAB_GROUPS: { id: TabGroup; label: string }[] = [
  { id: 'lead', label: 'Lead Management' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'general', label: 'General' },
];

type SettingTab = typeof SETTING_TABS[number]['id'];

export default function Settings({ onToast }: Props) {
  const [activeTab, setActiveTab] = useState<SettingTab>('sources');
  const company = useSpectrumCompany();
  // Masters are kept per head office, like every other Spectrum call.
  const apiCompany = company.enabled ? company.headOfficeNo : null;
  const sourcesApi = useApiMaster(masterApis.leadSources, apiCompany);
  const stagesApi = useApiMaster(masterApis.leadStages, apiCompany);
  const statusesApi = useApiMaster(masterApis.leadStatuses, apiCompany);
  const prioritiesApi = useApiMaster(masterApis.leadPriorities, apiCompany);
  const oppStatusesApi = useApiMaster(masterApis.opportunityStatuses, apiCompany);
  const activityTypesApi = useApiMaster(masterApis.leadActivityTypes, apiCompany);
  const productsApi = useApiMaster(masterApis.crmProducts, apiCompany);
  const oppStagesApi = useApiMaster(masterApis.opportunityStages, apiCompany);

  const counts: Record<SettingTab, number> = {
    sources: sourcesApi.rows.length,
    stages: stagesApi.rows.length,
    statuses: statusesApi.rows.length,
    priorities: prioritiesApi.rows.length,
    oppStages: oppStagesApi.rows.length,
    oppStatuses: oppStatusesApi.rows.length,
    products: productsApi.rows.length,
    activityTypes: activityTypesApi.rows.length,
  };

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:flex-row" style={{ background: C.bg }}>
      {/* Left settings nav */}
      <aside className="w-full lg:w-56 flex-shrink-0 flex flex-col"
        style={{ background: '#fff', borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div className="px-4 py-4 lg:py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f0f4fb' }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: C.text }}>Settings</p>
              <p className="text-xs" style={{ color: C.muted }}>Master Data</p>
            </div>
          </div>
        </div>
        <nav className="flex lg:flex-col flex-1 px-2 py-2 lg:py-3 gap-1 lg:space-y-0.5 overflow-x-auto">
          {TAB_GROUPS.map((group, groupIndex) => (
            <div key={group.id} className="contents">
              <p className={`hidden lg:block text-xs font-bold px-3 mb-2.5 tracking-widest ${groupIndex > 0 ? 'mt-4' : ''}`}
                style={{ color: '#94a3b8', fontSize: 9.5 }}>{group.label}</p>
              {SETTING_TABS.filter((tab) => tab.group === group.id).map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all whitespace-nowrap flex-shrink-0 lg:w-full"
                  style={{
                    background: activeTab === tab.id ? C.blueBg : 'transparent',
                    color: activeTab === tab.id ? C.blue : C.sub,
                    border: activeTab === tab.id ? `1px solid ${C.blueBorder}` : '1px solid transparent',
                  }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{tab.icon}</svg>
                  <span className="flex-1">{tab.label}</span>
                  <CountBadge value={counts[tab.id]} tone={activeTab === tab.id ? 'primary' : 'muted'} />
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden lg:block px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-xs" style={{ color: '#c8d2e2' }}>Phase 1 · Lead Management</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="page-gutter min-h-0 min-w-0 flex-1 overflow-y-auto py-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: C.text }}>
              Master Data Configuration
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>
              Manage the lookup values used across all lead management screens.
            </p>
          </div>
          {apiCompany && company.companies.length > 1 ? (
            <div className="w-64 max-w-full">
              <SelectField
                label="Company"
                preserveOrder
                options={company.companies.map((c) => ({ value: String(c.CompanyNo), label: c.CompanyName }))}
                value={String(company.companyNo)}
                onValueChange={(v) => company.setCompanyNo(Number(v))}
              />
            </div>
          ) : null}
        </div>

        {!company.ready ? (
          <div className="flex justify-center py-16"><Spinner label="Loading master data" /></div>
        ) : !apiCompany ? (
          <SpectrumRequiredNotice what="Master data" />
        ) : (
          <>
            {activeTab === 'sources' && (
              <ApiMasterSection api={masterApis.leadSources} state={sourcesApi} title="Lead Sources"
                subtitle="Where your leads originate" noun="Lead Source" namePlaceholder="e.g. LinkedIn" onToast={onToast} />
            )}
            {activeTab === 'stages' && (
              <ApiMasterSection api={masterApis.leadStages} state={stagesApi} title="Lead Stages"
                subtitle="Sales pipeline progression steps" noun="Lead Stage" namePlaceholder="e.g. Proposal Sent" onToast={onToast} />
            )}
            {activeTab === 'statuses' && (
              <ApiMasterSection api={masterApis.leadStatuses} state={statusesApi} title="Lead Statuses"
                subtitle="Disposition states for a lead record" noun="Lead Status" namePlaceholder="e.g. Nurturing" onToast={onToast} />
            )}
            {activeTab === 'priorities' && (
              <ApiMasterSection api={masterApis.leadPriorities} state={prioritiesApi} title="Lead Priorities"
                subtitle="Urgency levels for leads" noun="Lead Priority" namePlaceholder="e.g. High" onToast={onToast} />
            )}
            {activeTab === 'oppStages' && (
              <ApiMasterSection api={masterApis.opportunityStages} state={oppStagesApi} title="Opportunity Stages"
                subtitle="Deal progression and win probability" noun="Opportunity Stage" namePlaceholder="e.g. Negotiation" onToast={onToast} />
            )}
            {activeTab === 'oppStatuses' && (
              <ApiMasterSection api={masterApis.opportunityStatuses} state={oppStatusesApi} title="Opportunity Statuses"
                subtitle="Overall disposition of an opportunity" noun="Opportunity Status" namePlaceholder="e.g. On Hold" onToast={onToast} />
            )}
            {activeTab === 'products' && (
              <ApiMasterSection api={masterApis.crmProducts} state={productsApi} title="Products"
                subtitle="Items that can be quoted on leads and opportunities" noun="Product" namePlaceholder="e.g. Hot Rolled Coils" onToast={onToast} />
            )}
            {activeTab === 'activityTypes' && (
              <ApiMasterSection api={masterApis.leadActivityTypes} state={activityTypesApi} title="Activity Types"
                subtitle="Types of sales activities that can be logged" noun="Activity Type" namePlaceholder="e.g. Demo Call" onToast={onToast} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
