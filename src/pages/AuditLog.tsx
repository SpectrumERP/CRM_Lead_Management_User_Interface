import { useState, useMemo, useEffect, useRef } from 'react';
import { useSheetClose } from '../components/useSheetClose';
import {
  AuditEntry, AuditModule, AuditAction,
  AUDIT_USERS,
} from '../data/auditLog';
import { useCrmSelector } from '../contexts/CrmStoreContext';
import Pagination from '../components/Pagination';
import { Select, sortAlpha } from '../ui';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Props {
  onViewLead: (id: string) => void;
  onViewContact: (id: string) => void;
  onViewEntity: (id: string) => void;
  onViewActivity: () => void;
  onViewMeeting: () => void;
  onViewOpportunity: (id: string) => void;
}

type SortDir = 'desc' | 'asc';
type PageState = 'loading' | 'error' | 'done';

const MODULES: AuditModule[] = [
  'Lead', 'Contact', 'Business Entity', 'Activity', 'Meeting', 'Document', 'Opportunity',
];
const ACTIONS: AuditAction[] = [
  'Created', 'Updated', 'Deleted', 'Stage Changed', 'Status Changed',
  'Assigned', 'Document Uploaded', 'Activity Completed', 'Meeting Scheduled', 'Meeting Completed',
];
const PAGE_SIZE = 15;

// ── Colour helpers ────────────────────────────────────────────────────────────
const MODULE_COLOR: Record<string, { bg: string; color: string }> = {
  Lead:              { bg: '#eef2fb', color: '#2955a3' },
  Contact:           { bg: '#f5f3ff', color: '#7c3aed' },
  'Business Entity': { bg: '#edfbf1', color: '#1a8040' },
  Activity:          { bg: '#fffbeb', color: '#b45309' },
  Meeting:           { bg: '#fff0f0', color: '#c41e1e' },
  Document:          { bg: '#f0f4fb', color: '#4a5d82' },
  Opportunity:       { bg: '#eef3fc', color: '#2955a3' },
};

const ACTION_COLOR: Record<string, { bg: string; color: string }> = {
  'Created':            { bg: '#edfbf1', color: '#1a8040' },
  'Updated':            { bg: '#eff6ff', color: '#2955a3' },
  'Deleted':            { bg: '#fef2f2', color: '#c41e1e' },
  'Stage Changed':      { bg: '#faf5ff', color: '#7e22ce' },
  'Status Changed':     { bg: '#fff7ed', color: '#c2610c' },
  'Assigned':           { bg: '#f0fdf4', color: '#166534' },
  'Document Uploaded':  { bg: '#f0f4fb', color: '#4a5d82' },
  'Activity Completed': { bg: '#edfbf1', color: '#1a8040' },
  'Meeting Scheduled':  { bg: '#eef2fb', color: '#2955a3' },
  'Meeting Completed':  { bg: '#edfbf1', color: '#166534' },
};

function ModuleBadge({ module }: { module: AuditModule }) {
  const c = MODULE_COLOR[module] ?? { bg: '#f0f4fb', color: '#4a5d82' };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
      {module}
    </span>
  );
}

function ActionBadge({ action }: { action: AuditAction }) {
  const c = ACTION_COLOR[action] ?? { bg: '#f0f4fb', color: '#4a5d82' };
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: c.bg, color: c.color }}>
      {action}
    </span>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name === 'System' ? 'SYS'
    : name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const isSystem = name === 'System';
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
      style={{
        background: isSystem ? '#94a3b8' : 'linear-gradient(135deg,#2955a3,#c41e1e)',
        fontSize: 9,
        fontWeight: 700,
      }}
    >
      {initials}
    </div>
  );
}

function ValueCell({ value }: { value?: string }) {
  if (!value) return <span style={{ color: '#c8d4e8' }}>—</span>;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded font-mono"
      style={{ background: '#f8faff', color: '#4a5d82', border: '1px solid #edf1fa', maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      title={value}
    >
      {value}
    </span>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({
  entry,
  onClose,
  onNavigate,
}: {
  entry: AuditEntry;
  onClose: () => void;
  onNavigate: (e: AuditEntry) => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const { closing, requestClose } = useSheetClose(onClose);

  const mc = MODULE_COLOR[entry.module] ?? { bg: '#f0f4fb', color: '#4a5d82' };
  const ac = ACTION_COLOR[entry.action] ?? { bg: '#f0f4fb', color: '#4a5d82' };

  const canNavigate = Boolean(entry.navigateId);

  function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #f0f4fb' }}>
        <span className="text-xs font-semibold w-32 flex-shrink-0 pt-0.5" style={{ color: '#9aaccc' }}>{label}</span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    );
  }

  return (
    <div className={closing ? 'is-sheet-closing' : undefined}>
      {/* Backdrop */}
      <div
        className="crm-sheet-scrim fixed inset-0 z-40"
        style={{ background: 'rgba(12,26,58,0.35)' }}
        onClick={requestClose}
      />
      {/* Panel */}
      <div
        ref={drawerRef}
        className="crm-sheet fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden"
        style={{
          width: 480,
          background: '#fff',
          borderLeft: '1px solid #dce4f2',
          boxShadow: '-8px 0 40px rgba(12,26,58,0.12)',
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #dce4f2' }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#9aaccc', letterSpacing: '0.1em' }}>
              Audit Entry · {entry.id}
            </p>
            <h2 className="text-base font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>
              Change Details
            </h2>
          </div>
          <button
            onClick={requestClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: '#7a8494' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action banner */}
        <div className="px-6 py-3 flex items-center gap-3" style={{ background: ac.bg, borderBottom: '1px solid #edf1fa' }}>
          <span className="text-sm font-bold" style={{ color: ac.color }}>{entry.action}</span>
          <span className="text-xs" style={{ color: ac.color, opacity: 0.7 }}>on {entry.module}</span>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <Row label="Record">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>{entry.recordName}</span>
              <ModuleBadge module={entry.module} />
            </div>
            <p className="text-xs mt-0.5" style={{ color: '#9aaccc' }}>{entry.recordId}</p>
          </Row>

          <Row label="Date & Time">
            <p className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>
              {fmtDateTime(entry.dateTime)}
            </p>
          </Row>

          <Row label="User">
            <div className="flex items-center gap-2">
              <UserAvatar name={entry.user} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>{entry.user}</p>
                <p className="text-xs" style={{ color: '#9aaccc' }}>{entry.userRole}</p>
              </div>
            </div>
          </Row>

          <Row label="Action">
            <ActionBadge action={entry.action} />
          </Row>

          {entry.field && (
            <Row label="Field Changed">
              <span className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>{entry.field}</span>
            </Row>
          )}

          {(entry.previousValue !== undefined && entry.previousValue !== '') && (
            <Row label="Previous Value">
              <div
                className="text-sm px-3 py-2 rounded-lg font-mono"
                style={{ background: '#fef2f2', color: '#c41e1e', border: '1px solid #fecaca', wordBreak: 'break-all' }}
              >
                {entry.previousValue || '—'}
              </div>
            </Row>
          )}

          {(entry.newValue !== undefined && entry.newValue !== '') && (
            <Row label="New Value">
              <div
                className="text-sm px-3 py-2 rounded-lg font-mono"
                style={{ background: '#edfbf1', color: '#1a8040', border: '1px solid #bbf0cf', wordBreak: 'break-all' }}
              >
                {entry.newValue || '—'}
              </div>
            </Row>
          )}

          <Row label="Details">
            <p className="text-sm leading-relaxed" style={{ color: '#4a5d82' }}>{entry.details}</p>
          </Row>

          <Row label="Audit ID">
            <span className="text-xs font-mono" style={{ color: '#9aaccc' }}>{entry.id}</span>
          </Row>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3 flex-shrink-0" style={{ borderTop: '1px solid #dce4f2' }}>
          {canNavigate && (
            <button
              onClick={() => { onNavigate(entry); requestClose(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: '#2955a3', boxShadow: '0 2px 8px rgba(41,85,163,0.25)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3f87')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#2955a3')}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open {entry.module} Record
            </button>
          )}
          <button
            onClick={requestClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: '#f0f4fb', color: '#4a5d82' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#dce4f2')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#f0f4fb')}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDateTime(dt: string) {
  const [d, t] = dt.split(' ');
  const [y, m, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[+m - 1]} ${y}${t ? ', ' + t : ''}`;
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
      style={{ color: '#9aaccc', letterSpacing: '0.07em', background: '#f8faff', textAlign: right ? 'right' : 'left' }}
    >
      {children}
    </th>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuditLog({
  onViewLead, onViewContact, onViewEntity, onViewActivity, onViewMeeting, onViewOpportunity,
}: Props) {
  const audit = useCrmSelector((state) => state.audit);
  const [pageState, setPageState] = useState<PageState>('done');
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState<AuditModule | ''>('');
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const filtered = useMemo(() => {
    let list = [...audit];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.recordName.toLowerCase().includes(q) ||
          e.user.toLowerCase().includes(q) ||
          e.details.toLowerCase().includes(q) ||
          e.field?.toLowerCase().includes(q) ||
          e.previousValue?.toLowerCase().includes(q) ||
          e.newValue?.toLowerCase().includes(q) ||
          e.recordId.toLowerCase().includes(q),
      );
    }
    if (filterModule) list = list.filter((e) => e.module === filterModule);
    if (filterAction) list = list.filter((e) => e.action === filterAction);
    if (filterUser) list = list.filter((e) => e.user === filterUser);
    if (filterDateFrom) list = list.filter((e) => e.dateTime.slice(0, 10) >= filterDateFrom);
    if (filterDateTo) list = list.filter((e) => e.dateTime.slice(0, 10) <= filterDateTo);

    list.sort((a, b) =>
      sortDir === 'desc'
        ? b.dateTime.localeCompare(a.dateTime)
        : a.dateTime.localeCompare(b.dateTime),
    );

    return list;
  }, [audit, search, filterModule, filterAction, filterUser, filterDateFrom, filterDateTo, sortDir]);

  const pageEntries = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = Boolean(search || filterModule || filterAction || filterUser || filterDateFrom || filterDateTo);

  function clearFilters() {
    setSearch(''); setFilterModule(''); setFilterAction('');
    setFilterUser(''); setFilterDateFrom(''); setFilterDateTo('');
    setPage(1);
  }

  function handleNavigate(entry: AuditEntry) {
    switch (entry.navigateType) {
      case 'lead': onViewLead(entry.navigateId!); break;
      case 'contact': onViewContact(entry.navigateId!); break;
      case 'entity': onViewEntity(entry.navigateId!); break;
      case 'activity': onViewActivity(); break;
      case 'meeting': onViewMeeting(); break;
      case 'opportunity': onViewOpportunity(entry.navigateId!); break;
    }
  }

  function handleExport() {
    const header = 'Date & Time,User,Module,Record,Action,Field Changed,Previous Value,New Value,Details';
    const rows = filtered.map((e) =>
      [
        e.dateTime, e.user, e.module, `"${e.recordName}"`, e.action,
        e.field ?? '', e.previousValue ?? '', e.newValue ?? '', `"${e.details}"`,
      ].join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit_log.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      {/* ── Page header ── */}
      <div className="page-gutter py-5 flex-shrink-0" style={{ background: '#fff', borderBottom: '1px solid #dce4f2' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>
              Audit Log
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#7a8494' }}>
              Complete change history across all CRM modules · Read-only
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Read-only badge */}
            <span
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: '#f0f4fb', color: '#4a5d82', border: '1px solid #dce4f2' }}
            >
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Admin · Read Only
            </span>
            {/* Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{ background: '#f0f4fb', color: '#2955a3', border: '1px solid #dce4f2' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#dce9fb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#f0f4fb')}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {/* Search */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-1 min-w-56"
            style={{ background: '#f8faff', border: '1px solid #dce4f2' }}
          >
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#a0aab8', flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="flex-1 text-xs bg-transparent outline-none"
              style={{ color: '#0c1a3a' }}
              placeholder="Search records, users, changes…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }} style={{ color: '#a0aab8' }}>
                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Date from */}
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="text-xs rounded-lg px-3 py-1.5 outline-none"
            style={{ background: '#f8faff', border: '1px solid #dce4f2', color: filterDateFrom ? '#0c1a3a' : '#a0aab8' }}
            title="Date from"
          />
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="text-xs rounded-lg px-3 py-1.5 outline-none"
            style={{ background: '#f8faff', border: '1px solid #dce4f2', color: filterDateTo ? '#0c1a3a' : '#a0aab8' }}
            title="Date to"
          />

          {/* Module */}
          <Select
            size="compact"
            aria-label="Module"
            className="min-w-36"
            value={filterModule}
            onValueChange={(v) => { setFilterModule(v as AuditModule | ''); setPage(1); }}
            options={[
              { value: '', label: 'All Modules' },
              ...sortAlpha(MODULES).map((m) => ({ value: m, label: m })),
            ]}
          />

          {/* Action */}
          <Select
            size="compact"
            aria-label="Action"
            className="min-w-32"
            value={filterAction}
            onValueChange={(v) => { setFilterAction(v as AuditAction | ''); setPage(1); }}
            options={[
              { value: '', label: 'All Actions' },
              ...sortAlpha(ACTIONS).map((a) => ({ value: a, label: a })),
            ]}
          />

          {/* User */}
          <Select
            size="compact"
            aria-label="User"
            className="min-w-36"
            value={filterUser}
            onValueChange={(v) => { setFilterUser(v); setPage(1); }}
            options={[
              { value: '', label: 'All Users' },
              ...sortAlpha(AUDIT_USERS).map((u) => ({ value: u, label: u })),
            ]}
          />

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ color: '#c41e1e', background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear Filters
            </button>
          )}

          <span className="ml-auto text-xs font-semibold" style={{ color: '#9aaccc' }}>
            {pageState === 'done' && `${filtered.length} entr${filtered.length !== 1 ? 'ies' : 'y'}`}
          </span>
        </div>
      </div>

      {/* ── Table area ── */}
      <div className="flex-1 page-gutter py-5">

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-24">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent mb-4"
              style={{ borderColor: '#dce4f2', borderTopColor: '#2955a3', animation: 'spin 0.8s linear infinite' }}
            />
            <p className="text-sm font-medium" style={{ color: '#0c1a3a' }}>Loading audit records…</p>
            <p className="text-xs mt-1" style={{ color: '#9aaccc' }}>Fetching change history from all modules</p>
            <div className="w-full max-w-3xl mt-8 space-y-2.5">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="h-12 rounded-xl" style={{ background: 'linear-gradient(90deg,#f0f4fb 25%,#e8edf8 50%,#f0f4fb 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center" style={{ background: '#fef2f2' }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#c41e1e" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-base font-bold mb-2" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>Failed to Load Audit Log</h2>
            <p className="text-sm mb-5" style={{ color: '#7a8494', maxWidth: 360 }}>
              An error occurred while fetching the audit history. Please retry or contact your administrator.
            </p>
            <button
              onClick={() => { setPageState('loading'); setTimeout(() => setPageState('done'), 600); }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#2955a3' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty (no records at all — shouldn't happen with seed data) */}
        {pageState === 'done' && audit.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-full mb-4 flex items-center justify-center" style={{ background: '#f0f4fb' }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#c8d4e8" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>No audit records yet</p>
            <p className="text-xs mt-1" style={{ color: '#9aaccc' }}>Changes to CRM records will appear here.</p>
          </div>
        )}

        {/* No results from filters */}
        {pageState === 'done' && audit.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full mb-4 flex items-center justify-center" style={{ background: '#f0f4fb' }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#9aaccc" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#0c1a3a' }}>No results match your filters</p>
            <p className="text-xs" style={{ color: '#9aaccc' }}>Try adjusting the search term, date range, module, or action filters.</p>
            <button onClick={clearFilters} className="mt-4 text-xs font-semibold" style={{ color: '#2955a3' }}>
              Clear all filters
            </button>
          </div>
        )}

        {/* Table */}
        {pageState === 'done' && filtered.length > 0 && (
          <>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #dce4f2' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 980 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #dce4f2' }}>
                      <Th>
                        <button
                          className="flex items-center gap-1 transition-colors"
                          style={{ color: '#9aaccc' }}
                          onClick={() => setSortDir((d) => d === 'desc' ? 'asc' : 'desc')}
                        >
                          Date & Time
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            {sortDir === 'desc'
                              ? <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              : <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            }
                          </svg>
                        </button>
                      </Th>
                      <Th>User</Th>
                      <Th>Module</Th>
                      <Th>Record</Th>
                      <Th>Action</Th>
                      <Th>Field Changed</Th>
                      <Th>Previous Value</Th>
                      <Th>New Value</Th>
                      <Th right>Details</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.map((entry, idx) => (
                      <tr
                        key={entry.id}
                        style={{
                          borderBottom: '1px solid #f5f7fc',
                          background: idx % 2 === 0 ? '#fff' : '#fafbfe',
                          cursor: 'pointer',
                        }}
                        onClick={() => setSelectedEntry(entry)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfe')}
                      >
                        {/* Date & Time */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-xs font-semibold" style={{ color: '#0c1a3a' }}>
                            {entry.dateTime.slice(0, 10).split('-').reverse().join(' ').replace(/(\d+) (\d+) /, (_, d, m) => `${d} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} `)}
                          </p>
                          <p className="text-xs" style={{ color: '#9aaccc' }}>{entry.dateTime.slice(11)}</p>
                        </td>

                        {/* User */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <UserAvatar name={entry.user} />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: '#0c1a3a', maxWidth: 100 }}>{entry.user}</p>
                              <p className="text-xs truncate" style={{ color: '#9aaccc', maxWidth: 100 }}>{entry.userRole}</p>
                            </div>
                          </div>
                        </td>

                        {/* Module */}
                        <td className="px-4 py-3">
                          <ModuleBadge module={entry.module} />
                        </td>

                        {/* Record */}
                        <td className="px-4 py-3" style={{ maxWidth: 180 }}>
                          <p className="text-xs font-semibold truncate" style={{ color: '#0c1a3a' }} title={entry.recordName}>
                            {entry.recordName}
                          </p>
                          <p className="text-xs" style={{ color: '#9aaccc' }}>{entry.recordId}</p>
                        </td>

                        {/* Action */}
                        <td className="px-4 py-3">
                          <ActionBadge action={entry.action} />
                        </td>

                        {/* Field Changed */}
                        <td className="px-4 py-3">
                          {entry.field
                            ? <span className="text-xs font-medium" style={{ color: '#4a5d82' }}>{entry.field}</span>
                            : <span style={{ color: '#dce4f2' }}>—</span>}
                        </td>

                        {/* Previous Value */}
                        <td className="px-4 py-3">
                          <ValueCell value={entry.previousValue} />
                        </td>

                        {/* New Value */}
                        <td className="px-4 py-3">
                          <ValueCell value={entry.newValue} />
                        </td>

                        {/* Details */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                            style={{ color: '#2955a3', background: '#eef2fb' }}
                            onMouseEnter={(ev) => (ev.currentTarget.style.background = '#dce9fb')}
                            onMouseLeave={(ev) => (ev.currentTarget.style.background = '#eef2fb')}
                          >
                            View
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4">
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedEntry && (
        <DetailDrawer
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onNavigate={handleNavigate}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
