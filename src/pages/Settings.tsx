import { useState } from 'react';
import type { ToastType } from '../components/Toast';
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice';
import { Select, CountBadge, IconTooltip, PageHeader, Spinner } from '../ui';
import { masterApis } from '../api/masters';
import { FORM_NO, type FormRights } from '../api/formRights';
import { locationMasterApis } from '../api/locationMasters';
import { useSpectrumCompany } from '../auth/useSpectrumCompany';
import { useFormRights } from '../contexts/FormRightsContext';
import { C } from './settings/atoms';
import ApiMasterSection from './settings/ApiMasterSection';
import DashboardSettingsSection from './settings/DashboardSettingsSection';
import LocationMasterSection from './settings/LocationMasterSection';
import { useApiMaster } from './settings/useApiMaster';
import { useLocationMaster } from './settings/useLocationMaster';

interface Props {
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// Master data — Spectrum server only (Swagger CRUD under /api/master: save / load-data / search-data / delete).
// ══════════════════════════════════════════════════════════════════════════════

type TabGroup = 'lead' | 'opportunity' | 'business' | 'general';

const SETTING_TABS = [
  { id: 'sources', group: 'lead', label: 'Lead Sources', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /> },
  { id: 'stages', group: 'lead', label: 'Lead Stages', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /> },
  { id: 'statuses', group: 'lead', label: 'Lead Statuses', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { id: 'priorities', group: 'lead', label: 'Lead Priorities', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" /> },
  { id: 'oppStages', group: 'opportunity', label: 'Opportunity Stages', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
  { id: 'oppStatuses', group: 'opportunity', label: 'Opportunity Statuses', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /> },
  { id: 'products', group: 'opportunity', label: 'Products', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
  { id: 'entityTypes', group: 'business', label: 'Entity Types', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
  { id: 'countries', group: 'business', label: 'Countries', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { id: 'states', group: 'business', label: 'States', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /> },
  { id: 'cities', group: 'business', label: 'Cities', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" /> },
  { id: 'ports', group: 'business', label: 'Ports', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m0 0c-4 0-7-3-7-7m7 7c4 0 7-3 7-7M9 6h6m-3-3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" /> },
  { id: 'activityTypes', group: 'general', label: 'Activity Types', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
  { id: 'dashboard', group: 'general', label: 'Dashboard', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h6v6H4zM14 5h6v4h-6zM14 13h6v6h-6zM4 15h6v4H4z" /> },
] as const;

const TAB_GROUPS: { id: TabGroup; label: string }[] = [
  { id: 'lead', label: 'Lead Management' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'business', label: 'Business Entity' },
  { id: 'general', label: 'General' },
];

type SettingTab = typeof SETTING_TABS[number]['id'];

/** Business entity masters are gated by Spectrum form rights (see formRights.ts). */
const TAB_FORM_NO: Partial<Record<SettingTab, number>> = {
  entityTypes: FORM_NO.businessEntityType,
  countries: FORM_NO.country,
  states: FORM_NO.state,
  cities: FORM_NO.city,
  ports: FORM_NO.port,
};

function sectionRights(rights: FormRights) {
  return { canAdd: rights.isSave, canEdit: rights.isUpdate, canDelete: rights.isDelete };
}

/** Settings menu collapsed to icons (wide screens). */
const NAV_COLLAPSED_KEY = 'crm.settings.navCollapsed';

export default function Settings({ onToast }: Props) {
  // Collapsed to an icon rail on wide screens (as the main left panel); remembered in this browser.
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem(NAV_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  function toggleNav() {
    setNavCollapsed((current) => {
      const next = !current;
      try { localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0'); } catch { /* storage blocked: this visit only */ }
      return next;
    });
  }
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

  const rights: Partial<Record<SettingTab, FormRights>> = {
    entityTypes: useFormRights(FORM_NO.businessEntityType),
    countries: useFormRights(FORM_NO.country),
    states: useFormRights(FORM_NO.state),
    cities: useFormRights(FORM_NO.city),
    ports: useFormRights(FORM_NO.port),
  };
  const visibleTabs = SETTING_TABS.filter((tab) => !TAB_FORM_NO[tab.id] || rights[tab.id]?.isOpen);
  // Entity types and countries are short lists; states, cities and ports load when their tab opens.
  const entityTypesApi = useApiMaster(masterApis.businessEntityTypes, rights.entityTypes?.isOpen ? apiCompany : null);
  const countriesApi = useApiMaster(masterApis.countries, rights.countries?.isOpen ? apiCompany : null);
  const statesApi = useLocationMaster(locationMasterApis.state, apiCompany, activeTab === 'states');
  const citiesApi = useLocationMaster(locationMasterApis.city, apiCompany, activeTab === 'cities');
  const portsApi = useLocationMaster(locationMasterApis.port, apiCompany, activeTab === 'ports');

  const counts: Record<SettingTab, number> = {
    sources: sourcesApi.rows.length,
    stages: stagesApi.rows.length,
    statuses: statusesApi.rows.length,
    priorities: prioritiesApi.rows.length,
    oppStages: oppStagesApi.rows.length,
    oppStatuses: oppStatusesApi.rows.length,
    products: productsApi.rows.length,
    activityTypes: activityTypesApi.rows.length,
    entityTypes: entityTypesApi.rows.length,
    countries: countriesApi.rows.length,
    states: statesApi.rows.length,
    cities: citiesApi.rows.length,
    ports: portsApi.rows.length,
    dashboard: 0,
  };
  /** Tabs with no count badge: settings rather than master lists, and lists not loaded yet. */
  const noCount: SettingTab[] = [
    'dashboard',
    ...(statesApi.loaded ? [] : (['states'] as const)),
    ...(citiesApi.loaded ? [] : (['cities'] as const)),
    ...(portsApi.loaded ? [] : (['ports'] as const)),
  ];

  // In each section's header, before Add New (only when the user has several companies).
  const companyControl = apiCompany && company.companies.length > 1 ? (
    <div className="flex min-w-0 items-center gap-2.5">
      <label htmlFor="settings-company" className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-muted">
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" />
        </svg>
        Company
      </label>
      <Select
        id="settings-company"
        preserveOrder
        size="compact"
        rootClassName="w-56 max-w-full"
        options={company.companies.map((c) => ({ value: String(c.CompanyNo), label: c.CompanyName }))}
        value={String(company.companyNo)}
        onValueChange={(v) => company.setCompanyNo(Number(v))}
      />
    </div>
  ) : null;

  return (
    // bg-canvas: the app's page background, dark in the dark theme (a fixed colour stayed light).
    <div className="flex min-h-0 flex-1 flex-col bg-canvas lg:flex-row">
      {/* Left settings nav */}
      {/* Same line as the app's other panels (border-line); only a right edge on wide screens, and on
          phones (menu above the page) a line under it. */}
      <aside className={`w-full ${navCollapsed ? 'lg:w-14' : 'lg:w-56'} lg:min-h-0 flex-shrink-0 flex flex-col border-b border-line bg-surface transition-[width] duration-200 lg:border-b-0 lg:border-r`}>
        <div className={`border-b border-line py-4 lg:py-5 ${navCollapsed ? 'px-4 lg:px-2' : 'px-4'}`}>
          <div className={`flex items-center gap-2.5 ${navCollapsed ? 'lg:justify-center' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${navCollapsed ? 'lg:hidden' : ''}`} style={{ background: '#f0f4fb' }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className={`min-w-0 flex-1 ${navCollapsed ? 'lg:hidden' : ''}`}>
              <p className="text-sm font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: C.text }}>Settings</p>
              <p className="text-xs" style={{ color: C.muted }}>Master Data</p>
            </div>
            {/* Collapse / expand (wide screens; on phones the menu is a row of tabs). */}
            <IconTooltip label={navCollapsed ? 'Expand settings menu' : 'Collapse settings menu'} side={navCollapsed ? 'right' : 'top'}>
              <button
                type="button"
                onClick={toggleNav}
                aria-label={navCollapsed ? 'Expand settings menu' : 'Collapse settings menu'}
                aria-expanded={!navCollapsed}
                className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-ink-soft transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:inline-flex"
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden
                  className={`transition-transform ${navCollapsed ? 'rotate-180' : ''}`}>
                  <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
                </svg>
              </button>
            </IconTooltip>
          </div>
        </div>
        {/* Scrolls without a visible scrollbar, as the main left panel (.sidebar-scroll). */}
        <nav className={`sidebar-scroll flex lg:flex-col flex-1 py-2 lg:py-3 gap-1 lg:space-y-0.5 overflow-x-auto ${navCollapsed ? 'px-2 lg:px-1.5' : 'px-2'}`}>
          {TAB_GROUPS.map((group, groupIndex) => (
            <div key={group.id} className="contents">
              {navCollapsed ? (
                // Collapsed: a short line between groups instead of their names.
                groupIndex > 0 ? <span aria-hidden className="mx-auto my-2 hidden h-px w-6 bg-line lg:block" /> : null
              ) : (
                <p className={`hidden lg:block text-xs font-bold px-3 mb-2.5 tracking-widest ${groupIndex > 0 ? 'mt-4' : ''}`}
                  style={{ color: '#94a3b8', fontSize: 9.5 }}>{group.label}</p>
              )}
              {visibleTabs.filter((tab) => tab.group === group.id).map((tab) => {
                const button = (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    aria-label={navCollapsed ? tab.label : undefined}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all whitespace-nowrap flex-shrink-0 lg:w-full ${navCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
                    style={{
                      background: activeTab === tab.id ? C.blueBg : 'transparent',
                      color: activeTab === tab.id ? C.blue : C.sub,
                      border: activeTab === tab.id ? `1px solid ${C.blueBorder}` : '1px solid transparent',
                    }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0">{tab.icon}</svg>
                    <span className={`flex-1 ${navCollapsed ? 'lg:hidden' : ''}`}>{tab.label}</span>
                    {noCount.includes(tab.id) ? null : (
                      <span className={navCollapsed ? 'lg:hidden' : ''}>
                        <CountBadge value={counts[tab.id]} tone={activeTab === tab.id ? 'primary' : 'muted'} />
                      </span>
                    )}
                  </button>
                );
                // Collapsed: the name in a tip beside the icon.
                return navCollapsed ? (
                  <IconTooltip key={tab.id} label={tab.label} side="right" className="flex-shrink-0 lg:w-full">
                    {button}
                  </IconTooltip>
                ) : button;
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      {/* Page header on top; a master grid fills the rest (it scrolls inside, pager at the bottom). */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!company.ready ? (
          <div className="flex justify-center py-16"><Spinner label="Loading master data" /></div>
        ) : !apiCompany ? (
          <div className="page-gutter"><SpectrumRequiredNotice what="Master data" /></div>
        ) : (
          <>
            {activeTab === 'sources' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.leadSources} state={sourcesApi} title="Lead Sources"
                subtitle="Where your leads originate" noun="Lead Source" namePlaceholder="e.g. LinkedIn" onToast={onToast} />
            )}
            {activeTab === 'stages' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.leadStages} state={stagesApi} title="Lead Stages"
                subtitle="Sales pipeline progression steps" noun="Lead Stage" namePlaceholder="e.g. Proposal Sent" onToast={onToast} />
            )}
            {activeTab === 'statuses' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.leadStatuses} state={statusesApi} title="Lead Statuses"
                subtitle="Disposition states for a lead record" noun="Lead Status" namePlaceholder="e.g. Nurturing" onToast={onToast} />
            )}
            {activeTab === 'priorities' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.leadPriorities} state={prioritiesApi} title="Lead Priorities"
                subtitle="Urgency levels for leads" noun="Lead Priority" namePlaceholder="e.g. High" onToast={onToast} />
            )}
            {activeTab === 'oppStages' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.opportunityStages} state={oppStagesApi} title="Opportunity Stages"
                subtitle="Deal progression and win probability" noun="Opportunity Stage" namePlaceholder="e.g. Negotiation" onToast={onToast} />
            )}
            {activeTab === 'oppStatuses' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.opportunityStatuses} state={oppStatusesApi} title="Opportunity Statuses"
                subtitle="Overall disposition of an opportunity" noun="Opportunity Status" namePlaceholder="e.g. On Hold" onToast={onToast} />
            )}
            {activeTab === 'products' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.crmProducts} state={productsApi} title="Products"
                subtitle="Items that can be quoted on leads and opportunities" noun="Product" namePlaceholder="e.g. Hot Rolled Coils" onToast={onToast} />
            )}
            {activeTab === 'activityTypes' && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.leadActivityTypes} state={activityTypesApi} title="Activity Types"
                subtitle="Types of sales activities that can be logged" noun="Activity Type" namePlaceholder="e.g. Demo Call" onToast={onToast} />
            )}
            {activeTab === 'entityTypes' && rights.entityTypes?.isOpen && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.businessEntityTypes} state={entityTypesApi} title="Business Entity Types"
                subtitle="How business entities are classified" noun="Business Entity Type" namePlaceholder="e.g. Customer"
                rights={sectionRights(rights.entityTypes)} onToast={onToast} />
            )}
            {activeTab === 'countries' && rights.countries?.isOpen && (
              <ApiMasterSection toolbar={companyControl} api={masterApis.countries} state={countriesApi} title="Countries"
                subtitle="Countries used in addresses and ports" noun="Country" namePlaceholder="e.g. India"
                rights={sectionRights(rights.countries)} onToast={onToast} />
            )}
            {activeTab === 'states' && rights.states?.isOpen && (
              <LocationMasterSection toolbar={companyControl} api={locationMasterApis.state} state={statesApi} title="States"
                subtitle="States and provinces within each country" namePlaceholder="e.g. Maharashtra"
                rights={sectionRights(rights.states)} onToast={onToast} />
            )}
            {activeTab === 'cities' && rights.cities?.isOpen && (
              <LocationMasterSection toolbar={companyControl} api={locationMasterApis.city} state={citiesApi} title="Cities"
                subtitle="Cities within each state" namePlaceholder="e.g. Mumbai"
                rights={sectionRights(rights.cities)} onToast={onToast} />
            )}
            {activeTab === 'ports' && rights.ports?.isOpen && (
              <LocationMasterSection toolbar={companyControl} api={locationMasterApis.port} state={portsApi} title="Ports"
                subtitle="Ports a business entity can prefer" namePlaceholder="e.g. Nhava Sheva"
                rights={sectionRights(rights.ports)} onToast={onToast} />
            )}
            {activeTab === 'dashboard' && (
              <>
                {/* pb-4: no filters row under the title here, so the header's own bottom spacing. */}
                <PageHeader bordered className="pb-4" title="Dashboard" subtitle="Rules for the Requiring Attention sections of the dashboard." actions={companyControl ?? undefined} />
                <div className="page-gutter min-h-0 flex-1 overflow-y-auto py-4">
                  <DashboardSettingsSection onToast={onToast} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
