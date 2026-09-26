import { useState } from 'react';
import {
  BusinessEntity, EntityType, EntityStatus,
  ENTITY_STATUSES, TERRITORIES, SALESPERSONS,
  entityTypeMeta, entityStatusMeta,
} from '../data/businessEntities';
import { SkeletonTableRows, EmptyState, NoResults, EmptyIcons } from '../components/CRMStates';
import { RecordRowActions } from '../components/RecordRowActions';
import { useMasterData } from '../contexts/MasterDataContext';
import { api } from '../api/crm';
import { useApiQuery } from '../api/useApiQuery';
import { Button, CountBadge, PageHeader, SortChevrons, sortAlpha, StatPill, StatPillRow } from '../ui';
import { FilterSearch, FilterSelect } from '../components/InlineFilterRow';

interface Props {
  onCreate: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

function TypeBadge({ type }: { type: string }) {
  const m = entityTypeMeta(type);
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = entityStatusMeta(status);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0" style={{ background: m.color }} />
      {status}
    </span>
  );
}

export default function BusinessEntitiesList({ onCreate, onView, onEdit }: Props) {
  const { activeEntityTypeNames } = useMasterData();
  const { data: entityPage, loading } = useApiQuery(() => api.entities.list(), []);
  const entities = entityPage?.items ?? [];
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<EntityType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<EntityStatus | 'All'>('All');
  const [territoryFilter, setTerritoryFilter] = useState('All');
  const [salespersonFilter, setSalespersonFilter] = useState('All');
  const [sortField, setSortField] = useState<'name' | 'createdDate'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSort(field: 'name' | 'createdDate') {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const filtered = entities
    .filter((e) => {
      const q = search.toLowerCase();
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.gstin.toLowerCase().includes(q);
      const matchType = typeFilter === 'All' || e.type === typeFilter;
      const matchStatus = statusFilter === 'All' || e.status === statusFilter;
      const matchTerritory = territoryFilter === 'All' || e.locations.some((l) => l.territory === territoryFilter);
      const matchSp = salespersonFilter === 'All' || e.salesperson === salespersonFilter;
      return matchSearch && matchType && matchStatus && matchTerritory && matchSp;
    })
    .sort((a, b) => {
      const va = sortField === 'name' ? a.name : a.createdDate;
      const vb = sortField === 'name' ? b.name : b.createdDate;
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  }

  function primaryLocation(e: BusinessEntity) {
    return e.locations.find((l) => l.isPrimary) ?? e.locations[0];
  }

  function primaryContact(e: BusinessEntity) {
    return e.contacts.find((c) => c.isPrimary) ?? e.contacts[0];
  }

  const customers = entities.filter((e) => e.status === 'Customer').length;
  const prospects = entities.filter((e) => e.status === 'Prospect').length;

  return (
    <div className="page-gutter space-y-5 py-4">
      <PageHeader
        title="Business Entities"
        subtitle="Companies, customers, dealers and distribution partners"
        actions={
          <Button variant="solid" onClick={onCreate}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Business Entity
          </Button>
        }
      />

      <StatPillRow>
        <StatPill label="Total" value={entities.length} tone="primary" />
        <StatPill label="Customers" value={customers} tone="success" />
        <StatPill label="Prospects" value={prospects} tone="warning" />
        <StatPill label="Inactive" value={entities.filter((e) => e.status === 'Inactive').length} tone="muted" />
      </StatPillRow>

      {/* Filters: search full-width, then equal filter columns */}
      <div className="mb-4 space-y-2">
        <FilterSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by company name or GSTIN…"
          aria-label="Search entities"
        />
        <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            aria-label="Entity type"
            widthClass="w-full"
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
            options={[
              { value: 'All', label: 'All Types' },
              ...sortAlpha(activeEntityTypeNames).map((t) => ({ value: t, label: t })),
            ]}
          />
          <FilterSelect
            aria-label="Entity status"
            widthClass="w-full"
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            options={[
              { value: 'All', label: 'All Statuses' },
              ...sortAlpha(ENTITY_STATUSES).map((s) => ({ value: s, label: s })),
            ]}
          />
          <FilterSelect
            aria-label="Territory"
            widthClass="w-full"
            value={territoryFilter}
            onValueChange={setTerritoryFilter}
            options={[
              { value: 'All', label: 'All Territories' },
              ...sortAlpha(TERRITORIES).map((t) => ({ value: t, label: t })),
            ]}
          />
          <FilterSelect
            aria-label="Salesperson"
            widthClass="w-full"
            value={salespersonFilter}
            onValueChange={setSalespersonFilter}
            options={[
              { value: 'All', label: 'All Salespersons' },
              ...sortAlpha(SALESPERSONS).map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
        {(search || typeFilter !== 'All' || statusFilter !== 'All' || territoryFilter !== 'All' || salespersonFilter !== 'All') ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setTypeFilter('All');
                setStatusFilter('All');
                setTerritoryFilter('All');
                setSalespersonFilter('All');
              }}
              className="h-8 shrink-0 rounded-lg border border-accent/30 bg-accent-soft px-3 text-xs font-semibold text-accent"
            >
              Clear filters
            </button>
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border border-line bg-surface shadow-card">
        <div className="table-scroll relative min-w-0">
          <table className="crm-table w-full" style={{ minWidth: '72rem' }}>
            <thead>
              <tr>
                <th className="sticky-col-check">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll}
                    className="rounded accent-primary" />
                </th>
                <th
                  className="sticky-col-name"
                  style={{ cursor: 'pointer' }}
                  onClick={() => toggleSort('name')}
                >
                  Business Entity Name <SortChevrons active={sortField === 'name'} dir={sortDir} />
                </th>
                <th style={{ minWidth: 110 }}>Entity Type</th>
                <th style={{ minWidth: 140 }}>City / State</th>
                <th style={{ minWidth: 160 }}>Territory / Region</th>
                <th style={{ minWidth: 130 }}>Salesperson</th>
                <th style={{ minWidth: 100 }}>Status</th>
                <th style={{ minWidth: 150 }}>Primary Contact</th>
                <th style={{ minWidth: 90, cursor: 'pointer' }} onClick={() => toggleSort('createdDate')}>
                  Active Leads <SortChevrons active={sortField === 'createdDate'} dir={sortDir} />
                </th>
                <th style={{ minWidth: 120 }}>Last Activity</th>
                <th className="sticky-col-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={11} rows={6} />}
              {!loading && entities.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      icon={EmptyIcons.entities}
                      title="No business entities found"
                      subtitle="Add your first customer, prospect or partner to get started."
                      action={{ label: 'Create Business Entity', onClick: onCreate }}
                    />
                  </td>
                </tr>
              )}
              {!loading && entities.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <NoResults onClear={() => { setSearch(''); setTypeFilter('All'); setStatusFilter('All'); setTerritoryFilter('All'); setSalespersonFilter('All'); }} />
                  </td>
                </tr>
              )}
              {!loading && filtered.map((entity) => {
                const loc = primaryLocation(entity);
                const contact = primaryContact(entity);
                return (
                  <tr key={entity.id}>
                    <td className="sticky-col-check">
                      <input type="checkbox" checked={selected.has(entity.id)}
                        onChange={() => setSelected((s) => { const n = new Set(s); n.has(entity.id) ? n.delete(entity.id) : n.add(entity.id); return n; })}
                        className='accent-primary' />
                    </td>
                    <td className="sticky-col-name">
                      <button onClick={() => onView(entity.id)}
                        className="flex items-center gap-2.5 text-left group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-gradient-to-br from-ink to-primary text-xs text-surface">
                          {entity.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold group-hover:underline text-primary">
                            {entity.name}
                          </p>
                          <p className="text-xs text-ink-faint">{entity.id}</p>
                        </div>
                      </button>
                    </td>
                    <td><TypeBadge type={entity.type} /></td>
                    <td>
                      {loc ? (
                        <div>
                          <p className="text-xs font-semibold text-ink">{loc.city}</p>
                          <p className="text-xs text-ink-faint">{loc.state}</p>
                        </div>
                      ) : <span className="text-line-strong">—</span>}
                    </td>
                    <td className="text-xs text-ink-soft">
                      {loc?.territory || '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 h-6 w-6 bg-primary text-[8px] text-surface">
                          {entity.salesperson.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="text-xs text-ink">{entity.salesperson}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={entity.status} /></td>
                    <td>
                      {contact ? (
                        <div>
                          <p className="text-xs font-semibold text-ink">{contact.name}</p>
                          <p className="text-xs text-ink-faint">{contact.designation}</p>
                        </div>
                      ) : <span className="text-line-strong">—</span>}
                    </td>
                    <td className="text-center">
                      {entity.activeLeads > 0 ? (
                        <CountBadge value={entity.activeLeads} size="md" tone="accent" />
                      ) : (
                        <span className="text-xs text-line-strong">—</span>
                      )}
                    </td>
                    <td className="text-xs text-ink-muted">{entity.lastActivity}</td>
                    <td className="sticky-col-end" onClick={(e) => e.stopPropagation()}>
                      <RecordRowActions
                        onView={() => onView(entity.id)}
                        onEdit={() => onEdit(entity.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between border-t border-line-subtle">
            <p className="text-xs text-ink-faint">
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of{' '}
              <span className="font-semibold text-ink">{entities.length}</span> entities
            </p>
            {selected.size > 0 && (
              <p className="text-xs font-semibold text-primary">
                {selected.size} selected
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
