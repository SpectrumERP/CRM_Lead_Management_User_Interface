import { useState } from 'react';
import { toApiError } from '../../api/errors';
import { NAME_MAX, type MasterApi, type MasterRow } from '../../api/masters';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { ToastType } from '../../components/Toast';
import { IconTooltip, Spinner } from '../../ui';
import { C, EmptyRows, FilterBar, FormField, MasterTable, Modal, SectionHeader, StatusBadge, Td, Th } from './atoms';
import type { ApiMasterState } from './useApiMaster';

export interface ApiMasterSectionProps {
  api: MasterApi;
  state: ApiMasterState;
  title: string;
  subtitle: string;
  /** Singular noun for toasts and drawer titles, e.g. "Lead Stage". */
  noun: string;
  namePlaceholder: string;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DeleteAction({ onClick }: { onClick: () => void }) {
  return (
    <IconTooltip label="Delete">
      <button type="button" onClick={onClick} aria-label="Delete"
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#94a3b8' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = '#fdf0f0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}>
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </IconTooltip>
  );
}

function EditAction({ onClick }: { onClick: () => void }) {
  return (
    <IconTooltip label="Edit">
      <button type="button" onClick={onClick} aria-label="Edit"
        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#94a3b8' }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.blue; e.currentTarget.style.background = C.blueBg; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}>
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
    </IconTooltip>
  );
}

/** Master backed by the Spectrum Save / Search / Delete APIs. Status is read-only (the API has no toggle). */
export default function ApiMasterSection({ api, state, title, subtitle, noun, namePlaceholder, onToast }: ApiMasterSectionProps) {
  const { rows, loading, error, reload } = state;
  const hasSequence = api.definition.hasSequence;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<MasterRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: '', sequence: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MasterRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const query = search.trim().toLowerCase();
  const filtered = rows
    .filter((x) => {
      if (query && !x.name.toLowerCase().includes(query) && !x.code.toLowerCase().includes(query)) return false;
      if (statusFilter === 'Active' && x.inactive) return false;
      if (statusFilter === 'Inactive' && !x.inactive) return false;
      return true;
    })
    .sort((a, b) => (hasSequence ? (a.sequence ?? 0) - (b.sequence ?? 0) : a.name.localeCompare(b.name)));

  function openAdd() {
    const next = Math.max(0, ...rows.map((x) => x.sequence ?? 0)) + 1;
    setIsNew(true); setEditing(null);
    setForm({ name: '', sequence: hasSequence ? String(next) : '' }); setErrors({});
  }
  function openEdit(item: MasterRow) {
    setIsNew(false); setEditing(item);
    setForm({ name: item.name, sequence: item.sequence ? String(item.sequence) : '' }); setErrors({});
  }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) e.name = `${noun} name is required`;
    else if (name.length > NAME_MAX) e.name = `Maximum ${NAME_MAX} characters`;
    else if (rows.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.no !== editing?.no))
      e.name = `This ${noun.toLowerCase()} already exists`;
    if (hasSequence && form.sequence) {
      const seq = Number(form.sequence);
      if (!Number.isInteger(seq) || seq < 1) e.sequence = 'Sequence must be at least 1';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.save({
        no: editing?.no ?? null,
        name: form.name.trim(),
        sequence: hasSequence && form.sequence ? Number(form.sequence) : undefined,
      });
      onToast?.('success', isNew ? `${noun} Added` : `${noun} Updated`, `"${form.name.trim()}" saved successfully.`);
      closeModal();
      await reload();
    } catch (err) {
      const apiError = toApiError(err);
      onToast?.('error', `Could not save ${noun.toLowerCase()}`, apiError.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: MasterRow) {
    setDeleting(true);
    try {
      await api.remove(item.no);
      onToast?.('info', `${noun} Deleted`, `"${item.name}" has been deleted.`);
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      onToast?.('error', `Could not delete ${noun.toLowerCase()}`, toApiError(err).message);
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <SectionHeader title={title} subtitle={subtitle} count={rows.length} onAdd={openAdd} />
      <FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter}
        onClear={() => { setSearch(''); setStatusFilter('All'); }} />

      {error ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs" role="alert"
          style={{ background: '#fdf0f0', border: '1px solid #f5c2c2', color: C.red }}>
          <span>Could not load {title.toLowerCase()}: {error.message}</span>
          <button type="button" onClick={() => void reload()} className="font-bold underline">Retry</button>
        </div>
      ) : null}

      <MasterTable>
        <thead><tr>
          {hasSequence ? <Th narrow>Order</Th> : null}
          <Th narrow>Code</Th><Th>Name</Th><Th>Status</Th><Th>Modified</Th><Th right narrow>Actions</Th>
        </tr></thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr><td colSpan={99} className="py-16"><div className="flex justify-center"><Spinner label={`Loading ${title}`} /></div></td></tr>
          ) : filtered.length === 0 ? (
            error ? null : <EmptyRows onAdd={openAdd} />
          ) : filtered.map((item) => (
            <tr key={item.no} style={{ opacity: item.inactive ? 0.6 : 1 }}>
              {hasSequence ? (
                <Td narrow>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold" style={{ background: C.blueBg, color: C.blue }}>
                    {item.sequence ?? '—'}
                  </div>
                </Td>
              ) : null}
              <Td narrow><span className="font-mono text-xs" style={{ color: C.sub }}>{item.code || '—'}</span></Td>
              <Td><span className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</span></Td>
              <Td><StatusBadge status={item.inactive ? 'Inactive' : 'Active'} /></Td>
              <Td>
                <span className="text-xs" style={{ color: '#94a3b8' }}>
                  {formatDate(item.modifiedDate ?? item.createdDate)}
                  {item.modifiedBy || item.createdBy ? ` · ${item.modifiedBy ?? item.createdBy}` : ''}
                </span>
              </Td>
              <Td right narrow>
                <div className="flex items-center gap-1 justify-end">
                  <EditAction onClick={() => openEdit(item)} />
                  <DeleteAction onClick={() => setConfirmDelete(item)} />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? `Add ${noun}` : `Edit ${noun}`} onClose={closeModal} onSave={() => void save()} saving={saving}>
          {editing?.code ? (
            <FormField label="Code">
              <input className="form-input" value={editing.code} readOnly disabled />
            </FormField>
          ) : null}
          <FormField label={`${noun} Name`} required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }} maxLength={NAME_MAX}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder={namePlaceholder} />
          </FormField>
          {hasSequence ? (
            <FormField label="Sequence" error={errors.sequence}>
              <input type="number" min={1} className="form-input" style={{ borderColor: errors.sequence ? C.red : undefined }}
                value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} />
            </FormField>
          ) : null}
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${noun}`}
          message={`Delete "${confirmDelete.name}"? This cannot be undone. The server will refuse if it is still in use.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          danger
          onConfirm={() => { if (!deleting) void remove(confirmDelete); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
