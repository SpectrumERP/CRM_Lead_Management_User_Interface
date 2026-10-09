/** Shared building blocks for the Settings master-data sections. */
import { useState, type ReactNode } from 'react';
import type { MasterItemStatus } from '../../contexts/MasterDataContext';
import FormDrawer from '../../components/FormDrawer';
import { FilterSelect, GridSearch } from '../../components/InlineFilterRow';
import { Button, Field, IconTooltip, PageHeader, SortChevrons, nextSort, type SortState } from '../../ui';

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

/**
 * A section's header, as on the leads and business entities pages (PageHeader `bordered`): "Lead Sources - 8"
 * with its description, the page controls (`toolbar`, e.g. the company) and Add New on the right, and the
 * search / filters row under it.
 */
export function SectionHeader({ title, subtitle, count, onAdd, toolbar, children }: {
  title: string; subtitle: string; count: number;
  /** Omit to hide Add New (no rights to add). */
  onAdd?: () => void;
  /** Controls before Add New (the Settings page passes its company picker). */
  toolbar?: ReactNode;
  /** The section's filters row (search, status). */
  children?: ReactNode;
}) {
  return (
    <PageHeader
      bordered
      title={`${title} - ${count}`}
      subtitle={subtitle}
      actions={
        toolbar || onAdd ? (
          <>
            {toolbar}
            {onAdd ? (
              <Button variant="solid" onClick={onAdd}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add New
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      {children ? <div className="flex w-full flex-wrap items-center gap-2.5 pb-3">{children}</div> : null}
    </PageHeader>
  );
}

/** The grid search, shared with the leads page. */
export { GridSearch };

export function FilterBar({ search, onSearch, statusFilter, onStatus, onClear, placeholder = 'Search…' }: {
  search: string; onSearch: (v: string) => void;
  statusFilter: string; onStatus: (v: string) => void;
  onClear: () => void;
  placeholder?: string;
}) {
  const dirty = search || statusFilter !== 'All';
  return (
    <>
      <GridSearch value={search} onChange={onSearch} placeholder={placeholder} />
      <FilterSelect
        aria-label="Status"
        widthClass="w-36"
        value={statusFilter}
        onValueChange={onStatus}
        options={[
          { value: 'All', label: 'All Status' },
          { value: 'Active', label: 'Active' },
          { value: 'Inactive', label: 'Inactive' },
        ]}
      />
      {dirty ? (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Clear
        </button>
      ) : null}
    </>
  );
}

/** A header cell's sorting (from `useColumnSort().th(key)`). */
export interface ThSort {
  sortKey: string;
  sort: SortState<string>;
  onSort: (key: string) => void;
}

/** Header cell in the leads grid's style (.crm-table th); sortable when given `useColumnSort().th(key)`. */
export function Th({ children, right, narrow, sortKey, sort, onSort }: { children: ReactNode; right?: boolean; narrow?: boolean } & Partial<ThSort>) {
  const sortable = Boolean(sortKey && sort && onSort);
  const active = sortable && sort!.field === sortKey;
  return (
    <th
      className={sortable ? 'cursor-pointer select-none' : undefined}
      onClick={sortable ? () => onSort!(sortKey!) : undefined}
      aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      style={{
        textAlign: right ? 'right' : 'left',
        width: narrow ? '1%' : undefined,
        whiteSpace: narrow ? 'nowrap' : undefined,
      }}
    >
      {sortable ? (
        // Label left, sort icon at the right edge of the cell (as in the leads grid).
        <span className="flex w-full items-center justify-between gap-2">
          {children}
          <SortChevrons active={active} dir={sort!.dir} />
        </span>
      ) : (
        children
      )}
    </th>
  );
}

/**
 * Column sorting for the Settings grids, as in the leads grid: a header click sorts asc, then desc, then
 * back to the section's own order. `th(key)` goes on a header cell; `apply` sorts rows by the value the
 * column shows (numbers as numbers, text A–Z ignoring case, numbers inside text in numeric order).
 */
export function useColumnSort<Row>(values: Record<string, (row: Row) => string | number | null | undefined>, onChange?: () => void) {
  const [sort, setSort] = useState<SortState<string>>({ field: '', dir: 'asc' });
  const onSort = (key: string) => {
    setSort((current) => nextSort(current, key, { field: '', dir: 'asc' }));
    onChange?.();
  };
  const th = (sortKey: string): ThSort => ({ sortKey, sort, onSort });
  const apply = (rows: Row[]): Row[] => {
    const value = sort.field ? values[sort.field] : undefined;
    if (!value) return rows;
    const sign = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = value(a) ?? '';
      const bv = value(b) ?? '';
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sign * cmp;
    });
  };
  return { sort, th, apply };
}

export function Td({ children, right, narrow }: { children: ReactNode; right?: boolean; narrow?: boolean }) {
  return (
    <td
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
export function EmptyRows({ onAdd }: { onAdd?: () => void }) {
  return (
    <tr>
      <td colSpan={99} className="py-16 text-center">
        <div className="w-10 h-10 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#eef3fc' }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2955a3" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <p className="text-sm font-bold mb-1" style={{ color: C.text }}>No items found</p>
        {onAdd ? (
          <>
            <p className="text-xs mb-3" style={{ color: '#94a3b8' }}>Add your first item to get started.</p>
            <button onClick={onAdd} className="px-4 py-2 rounded-lg text-xs font-bold text-white" style={{ background: C.blue }}>Add New</button>
          </>
        ) : null}
      </td>
    </tr>
  );
}

// ─── Table wrapper ────────────────────────────────────────────────────────────
/** The grid as on the leads page: it fills the room it is given and scrolls inside (header row stays on top). */
export function MasterTable({ children }: { children: ReactNode }) {
  return (
    <div className="table-scroll relative min-h-0 min-w-0 flex-1">
      <table className="crm-table crm-table-fit">
        {children}
      </table>
    </div>
  );
}

// ─── Confirm toggle helper ────────────────────────────────────────────────────
export interface ToggleConfirm { id: string; name: string; currentStatus: MasterItemStatus }
