import { nextSort } from '../ui';
import { useState, useMemo, useDeferredValue, useEffect, memo } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import ActivityDrawer from '../components/ActivityDrawer';
import NoteDrawer from '../components/NoteDrawer';
import EmailDrawer from '../components/EmailDrawer';
import { RowQuickMenu } from '../components/RowQuickMenu';
import { RecordRowActions } from '../components/RecordRowActions';
import { Lead, displayLeadName, formatAuditStamp, formatLeadDate, formatLeadValue, formatMoneyTotals, isLeadLocked, leadDeleteBlockedReason, leadLockedReason, leadTouchedToday, leadStageClass, leadStagePalette, leadStatusClass, secondaryLeadContacts } from '../data/leads';
import { Contact } from '../data/contacts';
import { ToastType } from '../components/Toast';
import { SkeletonTableRows, EmptyState, NoResults, SkeletonKanbanCard, EmptyIcons } from '../components/CRMStates';
import { useCrmActions } from '../contexts/CrmStoreContext';
import { api } from '../api/crm';
import { useApiQuery } from '../api/useApiQuery';
import { bySequence } from '../api/fillValues';
import { useServerLeadSync } from '../components/useServerLeadSync';
import { useLeadFormFillValues } from '../components/useLeadFormFillValues';
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice';
import { prefetchPage } from '../app/prefetch';
import { SecondaryContactsMore } from '../components/SecondaryContactsMore';
import { Button, IconTooltip, PageHeader, PageLoader, Select, SortChevrons } from '../ui';
import { findContactForLead, LeadPrimaryContactCard } from '../components/PersonContactCard';
import { matchesAny } from '../utils/text';
import { stopBubbleProps } from '../utils/events';
import { PAGE_COPY } from '../constants/messages';
import { ColumnVisibilityMenu, useColumnVisibility, type GridColumn } from '../components/ColumnVisibility';

type ViewMode = 'list' | 'kanban';
type DateFilter = 'all' | 'today';

type LeadColumnKey =
  | 'code' | 'leadName' | 'entity' | 'primaryContact' | 'secondaryContact' | 'products' | 'value'
  | 'stage' | 'status' | 'owner' | 'source' | 'lastActivityOn' | 'createdBy' | 'createdOn' | 'modifiedBy' | 'modifiedOn' | 'actions';

/** Grid columns in order; `sort` = sortable field. Code and Actions cannot be hidden. */
const LEAD_COLUMNS: (GridColumn<LeadColumnKey> & { sort?: keyof Lead })[] = [
  { key: 'code', label: 'Lead Code', sort: 'id', locked: true },
  { key: 'leadName', label: 'Lead Name', sort: 'leadName' },
  { key: 'entity', label: 'Business Entity Name', sort: 'companyName' },
  { key: 'primaryContact', label: 'Primary Contact', sort: 'contactPerson' },
  { key: 'secondaryContact', label: 'Secondary Contact' },
  { key: 'products', label: 'Products Required', sort: 'productsRequired' },
  { key: 'value', label: 'Lead Value', sort: 'opportunityValue' },
  { key: 'stage', label: 'Lead Stage', sort: 'leadStage' },
  { key: 'status', label: 'Lead Status', sort: 'leadStatus' },
  { key: 'owner', label: 'Lead Owner', sort: 'assignedSalesperson' },
  { key: 'source', label: 'Lead Source', sort: 'leadSource' },
  { key: 'lastActivityOn', label: 'Last Activity On', sort: 'lastActivityAt' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdOn', label: 'Created On' },
  { key: 'modifiedBy', label: 'Modified By' },
  { key: 'modifiedOn', label: 'Modified On' },
  { key: 'actions', label: 'Actions', locked: true },
];
const PAGE_SIZE = 10;

interface LeadsListProps {
  onCreateLead: () => void;
  onViewLead: (id: string) => void;
  onEditLead: (id: string) => void;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

const SecondaryContactCell = memo(function SecondaryContactCell({
  lead,
  contacts,
}: {
  lead: Lead
  contacts: Contact[]
}) {
  const items = secondaryLeadContacts(lead).map((item) => {
    const catalog = findContactForLead(contacts, {
      name: item.name,
      email: item.email,
      companyName: lead.companyName,
    })
    return {
      name: catalog?.name ?? item.name,
      email: catalog?.email || item.email,
      phone: catalog?.mobile || item.phones[0],
      company: catalog?.businessEntityName ?? lead.companyName,
      designation: catalog?.designation,
    }
  })
  return <SecondaryContactsMore items={items} />
});

const KanbanCard = memo(function KanbanCard({
  lead,
  contacts,
  onClick,
}: {
  lead: Lead
  contacts: Contact[]
  onClick: () => void
}) {
  return (
    <div
      className="cursor-pointer rounded-xl border border-line bg-surface p-3 shadow-card transition-[box-shadow,border-color] hover:border-primary"
      onClick={onClick}
      onPointerEnter={() => prefetchPage('lead-detail')}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-xs font-bold leading-tight text-ink">{lead.companyName}</p>
        <span className={`badge ${leadStatusClass(lead.leadStatus)}`} style={{ fontSize: 10 }}>
          {lead.leadStatus}
        </span>
      </div>
      <div className="mb-1" {...stopBubbleProps}>
        <LeadPrimaryContactCard lead={lead} contacts={contacts} />
      </div>
      <IconTooltip label={lead.productsRequired} overflowOnly className="mb-2 w-full">
        <p className="truncate text-xs text-ink-faint">{lead.productsRequired}</p>
      </IconTooltip>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-accent">{formatLeadValue(lead)}</span>
        <span className="truncate text-xs text-ink-faint">{lead.assignedSalesperson.split(' ')[0]}</span>
      </div>
    </div>
  )
})

export default function LeadsList({ onCreateLead, onViewLead, onEditLead, onToast }: LeadsListProps) {
  const { addActivity, addNote, addEmail, removeLead } = useCrmActions();
  const { data: leadPage, loading: localLoading } = useApiQuery(() => api.leads.list(), []);
  // Server leads only (synced into the store from search-data) — the in-app sample leads are never shown.
  const serverSync = useServerLeadSync();
  const { values: fill } = useLeadFormFillValues();
  const allLeads = leadPage?.items ?? [];
  const leads = useMemo(() => allLeads.filter((l) => l.spectrum), [allLeads]);
  const loading = localLoading || serverSync.loading;
  const activeLeadStageNames = fill ? bySequence(fill.leadStages).map((x) => x.leadStageName) : [];
  const activeLeadStatusNames = fill ? fill.leadStatuses.map((x) => x.leadStatusName) : [];
  const activeLeadSourceNames = fill ? fill.leadSources.map((x) => x.leadSourceName) : [];
  // No in-app contact catalogue: contact cards show only what the lead itself carries.
  const contacts: Contact[] = [];
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  // Dashboard pipeline links open the list as `?stage=…&status=…`.
  const [searchParams] = useSearchParams();
  const [stageFilter, setStageFilter] = useState(() => searchParams.get('stage') ?? '');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortField, setSortField] = useState<keyof Lead | ''>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Show / hide grid columns (Actions header menu); remembered in this browser.
  const columns = useColumnVisibility('crm.leads.hiddenColumns', LEAD_COLUMNS);
  const show = columns.isVisible;
  // Checkbox column + visible columns.
  const gridColSpan = columns.visibleColumns.length + 1;
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Lead | null>(null);
  const [activityLead, setActivityLead] = useState<Lead | null>(null);
  const [noteLead, setNoteLead] = useState<Lead | null>(null);
  const [emailLead, setEmailLead] = useState<Lead | null>(null);

  const filtered = useMemo(() => {
    let data = [...leads];
    if (dateFilter === 'today') {
      // Created or modified today (local time).
      data = data.filter((l) => leadTouchedToday(l));
    }
    if (deferredSearch) {
      const q = deferredSearch
      data = data.filter(
        (l) =>
          matchesAny(
            [
              l.companyName,
              displayLeadName(l),
              l.contactPerson,
              l.email,
              l.phone,
              l.assignedSalesperson,
              l.productsRequired,
              l.id,
            ],
            q,
          ) ||
          secondaryLeadContacts(l).some((item) => matchesAny([item.name, item.email], q)),
      )
    }
    if (stageFilter) data = data.filter((l) => l.leadStage === stageFilter);
    if (statusFilter) data = data.filter((l) => l.leadStatus === statusFilter);
    if (sourceFilter) data = data.filter((l) => l.leadSource === sourceFilter);
    if (sortField) {
      data.sort((a, b) => {
        // Missing values (e.g. no last activity) sort as empty; ISO dates sort correctly as text.
        const av = sortField === 'leadName' ? displayLeadName(a) : ((a[sortField as keyof Lead] ?? '') as string | number);
        const bv = sortField === 'leadName' ? displayLeadName(b) : ((b[sortField as keyof Lead] ?? '') as string | number);
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return data;
  }, [leads, dateFilter, deferredSearch, stageFilter, statusFilter, sourceFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [dateFilter, deferredSearch, stageFilter, statusFilter, sourceFilter, sortField, sortDir]);

  useEffect(() => {
    if (!pageLoading) return;
    const timer = window.setTimeout(() => setPageLoading(false), 380);
    return () => window.clearTimeout(timer);
  }, [pageLoading, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );
  const listBusy = loading || pageLoading;

  function handlePageChange(next: number) {
    if (next === currentPage || pageLoading) return;
    setPageLoading(true);
    setPage(next);
  }

  function handleFilterChange(current: string, next: string, apply: (value: string) => void) {
    if (next === current || pageLoading) return;
    setPageLoading(true);
    apply(next);
  }

  const hasFilters = Boolean(stageFilter || statusFilter || sourceFilter || search || dateFilter !== 'all');

  function clearFilters() {
    if (!hasFilters || pageLoading) return;
    setPageLoading(true);
    setStageFilter('');
    setStatusFilter('');
    setSourceFilter('');
    setSearch('');
    setDateFilter('all');
  }

  function toggleSort(field: keyof Lead) {
    const next = nextSort({ field: sortField, dir: sortDir }, field, { field: '', dir: 'asc' });
    setSortField(next.field);
    setSortDir(next.dir);
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    const pageIds = paged.map((l) => l.id);
    const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    setSelected((s) => {
      const next = new Set(s);
      if (allOnPage) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function SortIcon({ field }: { field: keyof Lead }) {
    return <SortChevrons active={sortField === field} dir={sortDir} />;
  }

  // Per currency — a $ lead is not added into the ₹ total.
  const totalValue = formatMoneyTotals(filtered.map((l) => ({ value: l.opportunityValue, currency: l.valueCurrency })));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        bordered
        title={`Lead${filtered.length !== 1 ? 's' : ''} - ${filtered.length}`}
        actions={
          <Button variant="solid" onClick={onCreateLead}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Lead
          </Button>
        }
      >
        {/* Toolbar */}
        <div className="flex w-full flex-wrap items-center gap-2.5 pb-3">
          {/* Date tabs */}
          <div className="flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
            {(['all', 'today'] as DateFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                  dateFilter === f ? 'bg-primary text-surface' : 'bg-surface text-ink-soft hover:bg-surface-hover'
                }`}
              >
                {f === 'all' ? 'All' : 'Today'}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative min-w-48 max-w-72 flex-1">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
              width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search leads…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-hover py-1.5 pl-8 pr-3 text-xs text-ink outline-none transition-colors focus:border-primary focus:bg-surface focus-visible:shadow-[var(--shadow-focus)]"
            />
          </div>

          {/* Filters */}
          {[
            { value: stageFilter, onChange: setStageFilter, all: 'All Stages', options: activeLeadStageNames },
            { value: statusFilter, onChange: setStatusFilter, all: 'All Statuses', options: activeLeadStatusNames },
            { value: sourceFilter, onChange: setSourceFilter, all: 'All Sources', options: activeLeadSourceNames },
          ].map(({ value, onChange, all, options }) => (
            <Select
              key={all}
              size="compact"
              aria-label={all}
              value={value}
              disabled={pageLoading}
              onValueChange={(next) => handleFilterChange(value, next, onChange)}
              options={[{ value: '', label: all }, ...options.map((item) => ({ value: item, label: item }))]}
            />
          ))}
          {hasFilters && (
            <Button
              variant="secondary"
              className="!min-h-8 !px-3 !py-1.5 text-xs text-accent"
              disabled={pageLoading}
              onClick={clearFilters}
            >
              {PAGE_COPY.clearFilters}
            </Button>
          )}

          {/* View toggle */}
          <div className="ml-auto flex items-center overflow-hidden rounded-lg border border-line">
            <IconTooltip label="List view">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                  viewMode === 'list' ? 'bg-primary text-surface' : 'bg-surface text-ink-soft hover:bg-surface-hover'
                }`}
                aria-label="List view"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </IconTooltip>
            <IconTooltip label="Kanban view">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                  viewMode === 'kanban' ? 'bg-primary text-surface' : 'bg-surface text-ink-soft hover:bg-surface-hover'
                }`}
                aria-label="Kanban view"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <rect x="3" y="3" width="5" height="18" rx="1" /><rect x="10" y="3" width="5" height="12" rx="1" /><rect x="17" y="3" width="5" height="15" rx="1" />
                </svg>
              </button>
            </IconTooltip>
          </div>
        </div>
      </PageHeader>
      <div className="page-gutter pt-3 empty:hidden">
        <SpectrumRequiredNotice what="Leads" />
      </div>
      {serverSync.error ? (
        <div className="page-gutter pt-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent" role="alert">
            <span>Could not load leads from the server: {serverSync.error}</span>
            <button type="button" className="font-bold underline" onClick={() => void serverSync.retry()}>Retry</button>
          </div>
        </div>
      ) : null}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="page-gutter flex items-center gap-3 border-b border-line-strong bg-primary-soft py-2 text-xs">
          <span className="font-bold text-primary">{selected.size} selected</span>
          <button type="button" className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Assign</button>
          <button type="button" className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Change Stage</button>
          <button type="button" className="ml-auto font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Delete</button>
        </div>
      )}

      {/* Content */}
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <div className="page-gutter flex h-full min-w-0 flex-col">
          <div className="table-scroll relative min-h-0 min-w-0 flex-1" aria-busy={listBusy}>
            {pageLoading && <PageLoader label={PAGE_COPY.pageLoading} />}
            <table className="crm-table crm-table-leads">
              <thead>
                <tr>
                  <th className="sticky-col-check" style={{ padding: '10px 12px' }}>
                    <input
                      type="checkbox"
                      checked={paged.length > 0 && paged.every((l) => selected.has(l.id))}
                      onChange={toggleAll}
                    />
                  </th>
                  {columns.visibleColumns.map((column) => {
                    const field = column.sort
                    const sticky = column.key === 'actions' ? 'sticky-col-end' : column.key === 'code' ? 'sticky-col-id' : ''
                    return (
                      <th
                        key={column.key}
                        onClick={field ? () => toggleSort(field) : undefined}
                        className={`${field ? 'cursor-pointer select-none' : ''} ${sticky}`.trim()}
                      >
                        {column.key === 'actions' ? (
                          <span className="inline-flex items-center gap-1.5">
                            {column.label}
                            <ColumnVisibilityMenu
                              columns={LEAD_COLUMNS}
                              isVisible={columns.isVisible}
                              onToggle={columns.toggle}
                              onShowAll={columns.showAll}
                              hiddenCount={columns.hiddenCount}
                            />
                          </span>
                        ) : (
                          <span className="flex items-center justify-between gap-2">
                            {column.label}
                            {field && <SortIcon field={field} />}
                          </span>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonTableRows cols={gridColSpan} rows={7} />}
                {!loading && leads.length === 0 && (
                  <tr>
                    <td colSpan={gridColSpan} className="table-empty-td">
                      <EmptyState
                        icon={EmptyIcons.leads}
                        title="No leads found"
                        subtitle="Your pipeline is empty. Create your first lead to get started."
                        action={{ label: 'Create Lead', onClick: onCreateLead }}
                      />
                    </td>
                  </tr>
                )}
                {!loading && leads.length > 0 && filtered.length === 0 && (
                  <tr>
                    <td colSpan={gridColSpan} className="table-empty-td">
                      <NoResults onClear={clearFilters} />
                    </td>
                  </tr>
                )}
                {!loading && paged.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`cursor-pointer ${selected.has(lead.id) ? 'is-selected' : ''}`}
                    onPointerEnter={() => prefetchPage('lead-detail')}
                    onClick={() => onViewLead(lead.id)}
                  >
                    <td className="sticky-col-check" style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                      />
                    </td>
                    <td className="sticky-col-id">
                      <button
                        type="button"
                        className="font-mono text-xs font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewLead(lead.id)
                        }}
                      >
                        {lead.id}
                      </button>
                    </td>
                    {show('leadName') && (
                      <td>
                        <IconTooltip label={displayLeadName(lead)} overflowOnly className="max-w-52">
                          <span className="block truncate text-xs font-bold text-ink">
                            {displayLeadName(lead)}
                          </span>
                        </IconTooltip>
                      </td>
                    )}
                    {show('entity') && (
                      <td>
                        <IconTooltip label={lead.companyName} overflowOnly className="max-w-44">
                          <span className="block truncate text-xs font-semibold text-ink-soft">
                            {lead.companyName}
                          </span>
                        </IconTooltip>
                      </td>
                    )}
                    {show('primaryContact') && (
                      <td className="whitespace-normal" onClick={(e) => e.stopPropagation()}>
                        <LeadPrimaryContactCard lead={lead} contacts={contacts} />
                      </td>
                    )}
                    {show('secondaryContact') && (
                      <td className="whitespace-normal" onClick={(e) => e.stopPropagation()}>
                        <SecondaryContactCell lead={lead} contacts={contacts} />
                      </td>
                    )}
                    {show('products') && (
                      <td>
                        <IconTooltip label={lead.productsRequired} overflowOnly className="max-w-32">
                          <span className="block truncate text-xs" style={{ color: '#4a5d82' }}>
                          {lead.productsRequired}
                        </span>
                        </IconTooltip>
                      </td>
                    )}
                    {show('value') && (
                      <td>
                        <span className="text-xs font-bold" style={{ color: '#c41e1e' }}>{formatLeadValue(lead)}</span>
                      </td>
                    )}
                    {show('stage') && (
                      <td><span className={`badge ${leadStageClass(lead.leadStage)}`}>{lead.leadStage}</span></td>
                    )}
                    {show('status') && (
                      <td><span className={`badge ${leadStatusClass(lead.leadStatus)}`}>{lead.leadStatus}</span></td>
                    )}
                    {show('owner') && (
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ background: '#7c3aed' }}
                          >
                            {lead.assignedSalesperson.charAt(0)}
                          </div>
                          <IconTooltip label={lead.assignedSalesperson} overflowOnly className="min-w-0 max-w-24">
                            <span className="block truncate text-xs" style={{ color: '#4a5d82' }}>{lead.assignedSalesperson}</span>
                          </IconTooltip>
                        </div>
                      </td>
                    )}
                    {show('source') && (
                      <td><span className="badge source-badge">{lead.leadSource}</span></td>
                    )}
                    {/* search-data `lastActivityDate` */}
                    {show('lastActivityOn') && (
                      <td className="whitespace-nowrap text-xs text-ink-soft">
                        {lead.lastActivityAt ? formatAuditStamp(lead.lastActivityAt) : '—'}
                      </td>
                    )}
                    {/* Server leads: who / when from search-data. In-app leads only know their dates. */}
                    {show('createdBy') && (
                      <td className="whitespace-nowrap text-xs text-ink-soft">{lead.audit?.createdBy || '—'}</td>
                    )}
                    {show('createdOn') && (
                      <td className="whitespace-nowrap text-xs" style={{ color: '#94a3b8' }}>
                        {lead.audit ? formatAuditStamp(lead.audit.createdAt) : formatLeadDate(lead.createdAt)}
                      </td>
                    )}
                    {show('modifiedBy') && (
                      <td className="whitespace-nowrap text-xs text-ink-soft">{lead.audit?.modifiedBy || '—'}</td>
                    )}
                    {show('modifiedOn') && (
                      <td className="whitespace-nowrap text-xs" style={{ color: '#94a3b8' }}>
                        {lead.audit ? formatAuditStamp(lead.audit.modifiedAt) : lead.lastActivity}
                      </td>
                    )}
                    <td className="sticky-col-end" onClick={(e) => e.stopPropagation()}>
                      <RecordRowActions
                        viewLabel="View Lead"
                        editLabel="Edit Lead"
                        deleteLabel="Delete Lead"
                        onView={() => onViewLead(lead.id)}
                        onEdit={() => onEditLead(lead.id)}
                        editDisabledReason={isLeadLocked(lead) ? leadLockedReason(lead) : undefined}
                        onDelete={() => setConfirmDelete(lead)}
                        deleteDisabledReason={leadDeleteBlockedReason(lead)}
                      >
                        {/* Locked leads take no new activities or notes. */}
                        {isLeadLocked(lead) ? null : (
                          <RowQuickMenu
                            onAddActivity={() => setActivityLead(lead)}
                            onAddNote={() => setNoteLead(lead)}
                            onSendEmail={() => setEmailLead(lead)}
                          />
                        )}
                      </RecordRowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        ) : (
          /* Kanban */
          // Breathing room above the columns (toolbar line) and below them (horizontal scrollbar).
          <div className="page-gutter h-full min-w-0 overflow-hidden pt-3 pb-2">
          <div className="relative flex h-full min-h-0 min-w-0 gap-3 overflow-x-auto overflow-y-hidden pb-3" aria-busy={listBusy}>
            {pageLoading && <PageLoader label={PAGE_COPY.pageLoading} />}
            {activeLeadStageNames.map((stage) => {
              const stageLeads = filtered.filter((l) => l.leadStage === stage);
              const stageVal = formatMoneyTotals(stageLeads.map((l) => ({ value: l.opportunityValue, currency: l.valueCurrency })));
              const c = leadStagePalette(stage);
              return (
                <div key={stage} className="flex h-full min-h-0 w-64 min-w-64 shrink-0 flex-col">
                  <div
                    className="flex shrink-0 items-center justify-between rounded-t-xl px-3 py-2.5"
                    style={{ background: c.bg, border: `1px solid ${c.border}`, borderBottom: 'none' }}
                  >
                    <div>
                      <p className="text-xs font-bold" style={{ color: c.text }}>{stage}</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: c.text, opacity: 0.7 }}>
                        {stageVal}
                      </p>
                    </div>
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: c.text, fontSize: 10 }}
                    >
                      {stageLeads.length}
                    </span>
                  </div>
                  <div
                    className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-b-xl p-2"
                    style={{ background: '#f0f4fb', border: `1px solid ${c.border}` }}
                  >
                    {loading
                    ? [0, 1].map((i) => <SkeletonKanbanCard key={i} />)
                    : stageLeads.map((l) => (
                        <KanbanCard
                          key={l.id}
                          lead={l}
                          contacts={contacts}
                          onClick={() => onViewLead(l.id)}
                        />
                      ))
                  }
                    {!loading && stageLeads.length === 0 && (
                      <p className="text-center text-xs py-6" style={{ color: '#94a3b8' }}>No leads</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="page-gutter w-full border-t border-line bg-surface py-2.5 text-ink-muted">
        {viewMode === 'list' ? (
          <Pagination
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={handlePageChange}
            disabled={pageLoading}
          />
        ) : (
          <div className="grid w-full grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-3">
            <span className="justify-self-center text-xs leading-7 sm:justify-self-start">
              Showing {filtered.length} of {leads.length} leads
            </span>
            <span className="justify-self-center text-xs leading-7 sm:col-start-3 sm:justify-self-end">
              Total pipeline:&nbsp;
              <strong className="text-accent">{totalValue}</strong>
            </span>
          </div>
        )}
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete Lead"
          message={`Are you sure you want to delete lead ${confirmDelete.id}? This action cannot be undone.`}
          confirmLabel="Delete Lead"
          danger
          onConfirm={() => {
            removeLead(confirmDelete.id)
            onToast?.('success', 'Lead Deleted', `${displayLeadName(confirmDelete)} has been removed.`)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
      {activityLead ? (
        <ActivityDrawer
          preselectedLead={{
            id: activityLead.id,
            name: activityLead.companyName,
            contact: activityLead.contactPerson,
          }}
          onClose={() => setActivityLead(null)}
          onSave={(activity) => {
            addActivity(activity)
            onToast?.('success', 'Activity Logged', `"${activity.subject}" has been added.`)
          }}
        />
      ) : null}
      {noteLead ? (
        <NoteDrawer
          preselectedLead={{ id: noteLead.id, name: noteLead.companyName }}
          onClose={() => setNoteLead(null)}
          onSave={async (note) => {
            // Toast only once saved; a failed save shows the error instead.
            if (!(await addNote(note))) return
            onToast?.('success', 'Note Added', 'The note has been saved on this lead.')
          }}
        />
      ) : null}
      {emailLead ? (
        <EmailDrawer
          preselectedLead={{
            id: emailLead.id,
            name: emailLead.companyName,
            contact: emailLead.contactPerson,
            email: emailLead.email,
          }}
          onClose={() => setEmailLead(null)}
          onSave={(mail) => {
            addEmail(mail)
            onToast?.('success', 'Email Sent', `"${mail.subject}" opened in your mail app.`)
          }}
        />
      ) : null}
    </div>
  );
}
