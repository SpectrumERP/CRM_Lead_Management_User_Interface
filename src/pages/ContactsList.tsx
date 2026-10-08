import { nextSort } from '../ui';
import { useState } from 'react';
import { Contact, contactStatusMeta, initialsAvatar, avatarGradient, DEPARTMENTS } from '../data/contacts';
import { SkeletonTableRows, EmptyState, NoResults, EmptyIcons } from '../components/CRMStates';
import { api } from '../api/crm';
import { useApiQuery } from '../api/useApiQuery';
import { Button, compareAlpha, IconTooltip, PageHeader, SortChevrons, sortAlpha, StatPill, StatPillRow } from '../ui';
import { FilterSearch, FilterSelect, InlineFilterRow } from '../components/InlineFilterRow';
import { matchesAny } from '../utils/text';
import { stopPropagation } from '../utils/events';
import { formatDate } from '../utils/dateFormat';

type SortField = 'name' | 'businessEntityName' | 'createdDate';
interface Props {
  onCreate: () => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

export default function ContactsList({ onCreate, onView, onEdit }: Props) {
  const { data: contactPage, loading } = useApiQuery(() => api.contacts.list(), []);
  const { data: entityPage } = useApiQuery(() => api.entities.list(), []);
  const contacts = contactPage?.items ?? [];
  const entityOptions = entityPage?.items ?? [];
  const DESIGNATIONS = sortAlpha(Array.from(new Set(contacts.map((c) => c.designation))));
  const sortedEntities = [...entityOptions].sort((a, b) => compareAlpha(a.name, b.name));
  const [search, setSearch] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDesig, setFilterDesig] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  function toggleSort(field: SortField) {
    const next = nextSort({ field: sortField, dir: sortDir }, field, { field: 'name', dir: 'asc' });
    setSortField(next.field);
    setSortDir(next.dir);
  }

  const filtered = contacts.filter((c) => {
    if (search && !matchesAny([c.name, c.businessEntityName, c.mobile, c.email], search)) return false;
    if (filterEntity && c.businessEntityId !== filterEntity) return false;
    if (filterDept && c.department !== filterDept) return false;
    if (filterDesig && c.designation !== filterDesig) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => {
    let av = a[sortField] as string;
    let bv = b[sortField] as string;
    if (sortField === 'createdDate') { av = a.createdDate; bv = b.createdDate; }
    const cmp = av.localeCompare(bv);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const total = contacts.length;
  const active = contacts.filter((c) => c.status === 'Active').length;
  const primary = contacts.filter((c) => c.isPrimary).length;
  const entities = new Set(contacts.map((c) => c.businessEntityId)).size;

  function SortIcon({ field }: { field: SortField }) {
    return <SortChevrons active={sortField === field} dir={sortDir} />;
  }

  return (
    <div className="page-gutter space-y-5 py-4">
      <PageHeader
        title="Contacts"
        subtitle="Individual contacts across all your business entities"
        actions={
          <Button variant="solid" onClick={onCreate}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Contact
          </Button>
        }
      />

      <StatPillRow>
        <StatPill label="Total" value={total} tone="primary" />
        <StatPill label="Active" value={active} tone="success" />
        <StatPill label="Primary Contacts" value={primary} tone="warning" />
        <StatPill label="Business Entities" value={entities} tone="purple" />
      </StatPillRow>

      {/* Filters row */}
      <InlineFilterRow>
        <FilterSearch
          value={search}
          onChange={setSearch}
          placeholder="Search by name, company, mobile or email…"
          aria-label="Search contacts"
        />
        <FilterSelect
          aria-label="Business entity"
          widthClass="w-44"
          value={filterEntity}
          onValueChange={setFilterEntity}
          options={[
            { value: '', label: 'All Business Entities' },
            ...sortedEntities.map((be) => ({ value: be.id, label: be.name })),
          ]}
        />
        <FilterSelect
          aria-label="Department"
          widthClass="w-40"
          value={filterDept}
          onValueChange={setFilterDept}
          options={[
            { value: '', label: 'All Departments' },
            ...sortAlpha(DEPARTMENTS).map((d) => ({ value: d, label: d })),
          ]}
        />
        <FilterSelect
          aria-label="Designation"
          widthClass="w-40"
          value={filterDesig}
          onValueChange={setFilterDesig}
          options={[
            { value: '', label: 'All Designations' },
            ...DESIGNATIONS.map((d) => ({ value: d, label: d })),
          ]}
        />
        <FilterSelect
          aria-label="Status"
          value={filterStatus}
          onValueChange={setFilterStatus}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
          ]}
        />
        {(filterEntity || filterDept || filterDesig || filterStatus || search) ? (
          <button
            type="button"
            onClick={() => { setSearch(''); setFilterEntity(''); setFilterDept(''); setFilterDesig(''); setFilterStatus(''); }}
            className="h-8 shrink-0 rounded-lg border border-accent/30 bg-accent-soft px-3 text-xs font-semibold text-accent"
          >
            Clear filters
          </button>
        ) : null}
        <span className="ml-auto shrink-0 text-xs text-ink-faint">
          {filtered.length} of {total} contacts
        </span>
      </InlineFilterRow>

      {/* Table */}
      <div className="rounded-xl overflow-hidden border border-line">
        <div className="table-scroll">
          <table className="crm-table">
            <thead>
              <tr>
                <th>
                  <button className="flex w-full items-center justify-between gap-2" onClick={() => toggleSort('name')}>
                    Contact Name <SortIcon field="name" />
                  </button>
                </th>
                <th>
                  <button className="flex w-full items-center justify-between gap-2" onClick={() => toggleSort('businessEntityName')}>
                    Business Entity <SortIcon field="businessEntityName" />
                  </button>
                </th>
                <th>Designation</th>
                <th>Department</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Location / Plant</th>
                <th>Primary</th>
                <th>Status</th>
                <th>
                  <button className="flex w-full items-center justify-between gap-2" onClick={() => toggleSort('createdDate')}>
                    Last Activity <SortIcon field="createdDate" />
                  </button>
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={11} rows={7} />}
              {!loading && contacts.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty-td">
                    <EmptyState
                      icon={EmptyIcons.contacts}
                      title="No contacts found"
                      subtitle="Add your first contact linked to a business entity."
                      action={{ label: 'Add Contact', onClick: onCreate }}
                    />
                  </td>
                </tr>
              )}
              {!loading && contacts.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty-td">
                    <NoResults onClear={() => { setSearch(''); setFilterEntity(''); setFilterDept(''); setFilterDesig(''); setFilterStatus(''); }} />
                  </td>
                </tr>
              )}
              {!loading && filtered.map((c) => {
                const sMeta = contactStatusMeta(c.status);
                const isHovered = hoveredRow === c.id;
                return (
                  <tr
                    key={c.id}
                    className={`cursor-pointer ${isHovered ? 'bg-primary-soft/40' : 'bg-surface'}`}
                    onMouseEnter={() => setHoveredRow(c.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => onView(c.id)}
                  >
                    {/* Contact Name */}
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: avatarGradient(c.name) }}
                        >
                          {initialsAvatar(c.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-ink">{c.name}</p>
                          <p className="text-xs text-ink-faint">{c.id}</p>
                        </div>
                      </div>
                    </td>
                    {/* Business Entity */}
                    <td>
                      <span className="text-xs font-medium text-primary">{c.businessEntityName}</span>
                    </td>
                    {/* Designation */}
                    <td>
                      <span className="text-xs text-ink-soft">{c.designation}</span>
                    </td>
                    {/* Department */}
                    <td>
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-line bg-surface-hover text-primary"
                      >
                        {c.department}
                      </span>
                    </td>
                    {/* Mobile */}
                    <td>
                      <a
                        href={`tel:${c.mobile}`}
                        onClick={stopPropagation}
                        className="text-xs flex items-center gap-1 hover:underline text-ink-soft"
                      >
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-ink-faint">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {c.mobile}
                      </a>
                    </td>
                    {/* Email */}
                    <td>
                      <a
                        href={`mailto:${c.email}`}
                        onClick={stopPropagation}
                        className="text-xs hover:underline truncate max-w-40 block text-ink-soft"
                      >
                        {c.email}
                      </a>
                    </td>
                    {/* Location */}
                    <td>
                      <span className="text-xs text-ink-soft">{c.locationLabel}</span>
                    </td>
                    {/* Primary */}
                    <td>
                      {c.isPrimary ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border border-warning-line bg-warning-soft text-warning">
                          <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                          Primary
                        </span>
                      ) : (
                        null
                      )}
                    </td>
                    {/* Status */}
                    <td>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: sMeta.bg, color: sMeta.color, border: `1px solid ${sMeta.border}` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sMeta.color }} />
                        {c.status}
                      </span>
                    </td>
                    {/* Last Activity */}
                    <td>
                      <span className="text-xs text-ink-muted">{formatDate(c.lastActivity, '')}</span>
                    </td>
                    {/* Actions */}
                    <td onClick={stopPropagation}>
                      <div className="flex items-center gap-1">
                        <ActionBtn title="Call" onClick={() => {}} color="#2955a3">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        </ActionBtn>
                        <ActionBtn title="Edit" onClick={() => onEdit(c.id)} color="#6d28d9">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </ActionBtn>
                        <ActionBtn title="View" onClick={() => onView(c.id)} color="#0f7a50">
                          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Footer */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-line bg-surface-muted">
          <span className="text-xs text-ink-faint">Showing {filtered.length} contact{filtered.length !== 1 ? 's' : ''}</span>
          <span className="text-xs text-ink-faint">Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick, title, color }: { children: React.ReactNode; onClick: () => void; title: string; color: string }) {
  return (
    <IconTooltip label={title}>
      <button
        type="button"
        onClick={onClick}
        aria-label={title}
        className="w-7 h-7 rounded-md flex items-center justify-center transition-all"
        style={{ color: '#9aaccc', border: '1px solid #e8eef7' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f4fb'; e.currentTarget.style.color = color; e.currentTarget.style.borderColor = color; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9aaccc'; e.currentTarget.style.borderColor = '#e8eef7'; }}
      >
        {children}
      </button>
    </IconTooltip>
  );
}
