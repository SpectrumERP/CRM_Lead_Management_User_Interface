/** Shared building blocks for the Settings master-data sections. */
import type { ReactNode } from 'react';
import type { MasterItemStatus } from '../../contexts/MasterDataContext';
import FormDrawer from '../../components/FormDrawer';
import { FilterSearch, FilterSelect } from '../../components/InlineFilterRow';
import { Button, Field, IconTooltip } from '../../ui';

// ─── Brand tokens (match existing design system) ──────────────────────────────
export const C = {
  blue: '#2955a3', deepBlue: '#0c1a3a', red: '#c41e1e',
  blueBg: '#eef3fc', blueBorder: '#c2d3f5',
  border: '#dce4f2', surface: '#fff', bg: '#f2f5fb', muted: '#7a8494',
  text: '#0c1a3a', sub: '#4a5d82',
};

// ─── Shared atoms ─────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: MasterItemStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
      style={status === 'Active'
        ? { background: '#edfbf1', color: '#1a8040', border: '1px solid #bbf0cf' }
        : { background: '#f0f4fb', color: '#94a3b8', border: '1px solid #dce4f2' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: status === 'Active' ? '#1a8040' : '#94a3b8' }} />
      {status}
    </span>
  );
}

export function SectionHeader({ title, subtitle, count, onAdd }: {
  title: string; subtitle: string; count: number; onAdd: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div>
        <h2 className="text-base font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: C.text }}>{title}</h2>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{subtitle} · <span style={{ color: C.blue, fontWeight: 600 }}>{count} configured</span></p>
      </div>
      <button onClick={onAdd}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-white flex-shrink-0 transition-all"
        style={{ background: C.blue, boxShadow: '0 2px 8px rgba(41,85,163,0.25)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3f87')}
        onMouseLeave={(e) => (e.currentTarget.style.background = C.blue)}>
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
        Add New
      </button>
    </div>
  );
}

export function FilterBar({ search, onSearch, statusFilter, onStatus, onClear }: {
  search: string; onSearch: (v: string) => void;
  statusFilter: string; onStatus: (v: string) => void;
  onClear: () => void;
}) {
  const dirty = search || statusFilter !== 'All';
  return (
    <div className="mb-4 w-full min-w-0 overflow-hidden">
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_9rem] items-center gap-2">
        <FilterSearch value={search} onChange={onSearch} placeholder="Search…" />
        <FilterSelect
          aria-label="Status"
          widthClass="w-full"
          value={statusFilter}
          onValueChange={onStatus}
          options={[
            { value: 'All', label: 'All Status' },
            { value: 'Active', label: 'Active' },
            { value: 'Inactive', label: 'Inactive' },
          ]}
        />
      </div>
      {dirty ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 h-8 rounded-lg px-3 text-xs font-semibold transition-colors"
          style={{ background: '#f0f4fb', color: C.sub, border: `1px solid ${C.border}` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e4eaf5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#f0f4fb')}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

export function Th({ children, right, narrow }: { children: ReactNode; right?: boolean; narrow?: boolean }) {
  return (
    <th
      className="px-4 py-2.5 text-left font-bold"
      style={{
        fontSize: 12,
        color: '#94a3b8',
        letterSpacing: 0,
        textAlign: right ? 'right' : 'left',
        width: narrow ? '1%' : undefined,
        whiteSpace: narrow ? 'nowrap' : undefined,
      }}
    >
      {children}
    </th>
  );
}

export function Td({ children, right, narrow }: { children: ReactNode; right?: boolean; narrow?: boolean }) {
  return (
    <td
      className="px-4 py-3"
      style={{
        textAlign: right ? 'right' : 'left',
        width: narrow ? '1%' : undefined,
        whiteSpace: narrow ? 'nowrap' : undefined,
      }}
    >
      {children}
    </td>
  );
}

// ─── Right sheet (matches Note / Lead drawers) ────────────────────────────────
export function Modal({ title, onClose, onSave, children, saving }: {
  title: string; onClose: () => void; onSave: () => void; children: ReactNode; saving?: boolean;
}) {
  const isEdit = title.toLowerCase().startsWith('edit')

  return (
    <FormDrawer
      title={title}
      subtitle={isEdit ? 'Update this master data item' : 'Add a new master data item'}
      onClose={onClose}
      widthClass="w-[26rem]"
      icon={
        isEdit ? (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        ) : (
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        )
      }
      footer={(requestClose) => (
        <>
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button type="button" variant="solid" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">{children}</div>
    </FormDrawer>
  );
}

export function FormField({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: ReactNode;
}) {
  return (
    <Field label={label} required={required} error={error}>
      {children}
    </Field>
  );
}

// ─── Row action buttons ───────────────────────────────────────────────────────
export function RowActions({ onEdit, onToggle, status }: { onEdit: () => void; onToggle: () => void; status: MasterItemStatus }) {
  return (
    <div className="flex items-center gap-1 justify-end">
      <IconTooltip label="Edit">
        <button type="button" onClick={onEdit} aria-label="Edit"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#94a3b8' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.blue; (e.currentTarget as HTMLButtonElement).style.background = C.blueBg; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
      </IconTooltip>
      <IconTooltip label={status === 'Active' ? 'Deactivate' : 'Activate'}>
        <button type="button" onClick={onToggle} aria-label={status === 'Active' ? 'Deactivate' : 'Activate'}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#94a3b8' }}
          onMouseEnter={(e) => {
            const clr = status === 'Active' ? '#b45309' : '#1a8040';
            const bg = status === 'Active' ? '#fffbeb' : '#edfbf1';
            (e.currentTarget as HTMLButtonElement).style.color = clr; (e.currentTarget as HTMLButtonElement).style.background = bg;
          }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
          {status === 'Active'
            ? <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            : <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          }
        </button>
      </IconTooltip>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyRows({ onAdd }: { onAdd: () => void }) {
  return (
    <tr>
      <td colSpan={99} className="py-16 text-center">
        <div className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#eef3fc' }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2955a3" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <p className="text-sm font-bold mb-1" style={{ color: C.text }}>No items found</p>
        <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>Add your first item to get started.</p>
        <button onClick={onAdd} className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: C.blue }}>Add New</button>
      </td>
    </tr>
  );
}

// ─── Table wrapper ────────────────────────────────────────────────────────────
export function MasterTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl" style={{ background: '#fff', border: `1px solid ${C.border}`, boxShadow: '0 1px 4px rgba(12,26,58,0.05)' }}>
      <div className="w-full min-w-0">
        <table className="crm-table crm-table-fit w-full" style={{ tableLayout: 'auto' }}>
          {children}
        </table>
      </div>
    </div>
  );
}

// ─── Confirm toggle helper ────────────────────────────────────────────────────
export interface ToggleConfirm { id: string; name: string; currentStatus: MasterItemStatus }
