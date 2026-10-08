import { useState } from 'react';
import { toApiError } from '../../api/errors';
import { NAME_MAX, needsDetailForEdit, type MasterApi, type MasterRow } from '../../api/masters';
import { clearLeadFillValuesCache } from '../../api/leadFormFillValues';
import { clearOpportunityFillValuesCache } from '../../api/opportunityFormFillValues';
import { clearBusinessEntityFillValuesCache } from '../../api/businessEntityFillValues';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { ToastType } from '../../components/Toast';
import { IconTooltip, Spinner } from '../../ui';
import { C, EmptyRows, FilterBar, FormField, MasterTable, Modal, SectionHeader, StatusBadge, Td, Th } from './atoms';
import type { ApiMasterState } from './useApiMaster';
import { saveConfirm, useConfirm } from '../../contexts/ConfirmContext'
import { formatDate } from '../../utils/dateFormat';

export interface ApiMasterSectionProps {
  api: MasterApi;
  state: ApiMasterState;
  title: string;
  subtitle: string;
  /** Singular noun for toasts and drawer titles, e.g. "Lead Stage". */
  noun: string;
  namePlaceholder: string;
  onToast?: (type: ToastType, title: string, message?: string) => void;
  /** Form rights (see formRights.ts); everything allowed when omitted. */
  rights?: { canAdd: boolean; canEdit: boolean; canDelete: boolean };
}

const FULL_RIGHTS = { canAdd: true, canEdit: true, canDelete: true };

/** Forms opened from now on fetch the changed lists. */
function clearFillValueCaches() {
  clearLeadFillValuesCache();
  clearOpportunityFillValuesCache();
  clearBusinessEntityFillValuesCache();
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

/** Number fields → input text (empty when not set). */
function numbersToText(values?: Record<string, number | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, value === undefined ? '' : String(value)]));
}

/** Default colour for a new lead stage. */
const DEFAULT_COLOR = '#2955A3';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Master backed by the Spectrum Save / Search / Delete APIs. Status is read-only (the API has no toggle). */
export default function ApiMasterSection({ api, state, title, subtitle, noun, namePlaceholder, onToast, rights = FULL_RIGHTS }: ApiMasterSectionProps) {
  const confirm = useConfirm()
  const { rows, loading, error, reload } = state;
  const hasSequence = api.definition.hasSequence;
  const hasDescription = Boolean(api.definition.hasDescription);
  const nameMax = api.definition.nameMax ?? NAME_MAX;
  const hasColor = Boolean(api.definition.hasColor);
  const flagDefs = api.definition.flags ?? [];
  const numberDefs = api.definition.numbers ?? [];
  const listedNumbers = numberDefs.filter((n) => n.inList);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<MasterRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<{
    name: string; sequence: string; description: string; colorCoding: string; flags: Record<string, boolean>; numbers: Record<string, string>
  }>({ name: '', sequence: '', description: '', colorCoding: '', flags: {}, numbers: {} });
  // Editing a master with load-data-only fields (colour, flags): the record is loaded before saving.
  const [loadingDetail, setLoadingDetail] = useState(false);
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
    setForm({ name: '', sequence: hasSequence ? String(next) : '', description: '', colorCoding: hasColor ? DEFAULT_COLOR : '', flags: {}, numbers: {} }); setErrors({});
  }
  async function openEdit(item: MasterRow) {
    setIsNew(false); setEditing(item);
    setForm({
      name: item.name, sequence: item.sequence ? String(item.sequence) : '', description: item.description ?? '',
      colorCoding: '', flags: {}, numbers: numbersToText(item.numbers),
    }); setErrors({});
    if (!needsDetailForEdit(api.definition) || !state.companyNo) return;
    // Colour / flags come only from load-data — without them a save would clear them.
    setLoadingDetail(true);
    try {
      const detail = await api.load(item.no, state.companyNo);
      setForm((prev) => ({
        ...prev,
        name: detail.name || prev.name,
        sequence: detail.sequence ? String(detail.sequence) : prev.sequence,
        colorCoding: detail.colorCoding ?? '',
        flags: detail.flags ?? {},
        numbers: { ...prev.numbers, ...numbersToText(detail.numbers) },
      }));
    } catch (err) {
      onToast?.('error', `Could not load ${noun.toLowerCase()}`, toApiError(err).message);
      setEditing(null);
    } finally {
      setLoadingDetail(false);
    }
  }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); setLoadingDetail(false); }

  function validate() {
    const e: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) e.name = `${noun} name is required`;
    else if (name.length > nameMax) e.name = `Maximum ${nameMax} characters`;
    else if (rows.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.no !== editing?.no))
      e.name = `This ${noun.toLowerCase()} already exists`;
    // `sequence` is a required (non-nullable) number in the save API.
    if (hasSequence) {
      const seq = Number(form.sequence);
      if (!form.sequence.trim()) e.sequence = 'Sequence is required';
      else if (!Number.isInteger(seq) || seq < 1) e.sequence = 'Sequence must be a whole number of at least 1';
    }
    for (const field of numberDefs) {
      const raw = form.numbers[field.key]?.trim() ?? '';
      if (!raw) continue;
      const value = Number(raw);
      const min = field.min ?? 0;
      const max = field.max ?? Number.MAX_SAFE_INTEGER;
      if (!Number.isInteger(value) || value < min || value > max) e[`number:${field.key}`] = `Enter a whole number from ${min} to ${max}`;
    }
    // `colorCoding` is optional; when given it must be a #RRGGBB hex colour.
    if (hasColor && form.colorCoding.trim() && !HEX_COLOR.test(form.colorCoding.trim())) {
      e.colorCoding = 'Use a hex colour like #2955A3';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    if (!(await confirm(saveConfirm(noun, !isNew)))) return;
    setSaving(true);
    try {
      await api.save({
        no: editing?.no ?? null,
        companyNo: state.companyNo,
        name: form.name.trim(),
        sequence: hasSequence ? Number(form.sequence) : undefined,
        description: hasDescription ? form.description : undefined,
        colorCoding: hasColor ? form.colorCoding.trim().toUpperCase() : undefined,
        flags: flagDefs.length ? form.flags : undefined,
        numbers: numberDefs.length
          ? Object.fromEntries(numberDefs.map((n) => {
              const raw = form.numbers[n.key]?.trim() ?? '';
              return [n.key, raw ? Number(raw) : undefined];
            }))
          : undefined,
      });
      clearFillValueCaches();
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
      clearFillValueCaches();
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
      <SectionHeader title={title} subtitle={subtitle} count={rows.length} onAdd={rights.canAdd ? openAdd : undefined} />
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
          <Th narrow>Code</Th><Th>Name</Th>{hasDescription ? <Th>Description</Th> : null}
          {listedNumbers.map((n) => <Th key={n.key} narrow>{n.label}{n.suffix ? ` (${n.suffix})` : ''}</Th>)}
          <Th>Status</Th><Th>Modified</Th><Th right narrow>Actions</Th>
        </tr></thead>
        <tbody>
          {loading && rows.length === 0 ? (
            <tr><td colSpan={99} className="py-16"><div className="flex justify-center"><Spinner label={`Loading ${title}`} /></div></td></tr>
          ) : filtered.length === 0 ? (
            error ? null : <EmptyRows onAdd={rights.canAdd ? openAdd : undefined} />
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
              {hasDescription ? <Td><span className="text-xs" style={{ color: C.sub }}>{item.description || '—'}</span></Td> : null}
              {listedNumbers.map((n) => (
                <Td key={n.key} narrow>
                  <span className="text-xs font-semibold" style={{ color: C.sub }}>
                    {item.numbers?.[n.key] ?? '—'}{item.numbers?.[n.key] !== undefined && n.suffix ? n.suffix : ''}
                  </span>
                </Td>
              ))}
              <Td><StatusBadge status={item.inactive ? 'Inactive' : 'Active'} /></Td>
              <Td>
                <span className="text-xs" style={{ color: '#94a3b8' }}>
                  {formatDate(item.modifiedDate ?? item.createdDate)}
                  {item.modifiedBy || item.createdBy ? ` · ${item.modifiedBy ?? item.createdBy}` : ''}
                </span>
              </Td>
              <Td right narrow>
                <div className="flex items-center gap-1 justify-end">
                  {rights.canEdit ? <EditAction onClick={() => void openEdit(item)} /> : null}
                  {rights.canDelete ? <DeleteAction onClick={() => setConfirmDelete(item)} /> : null}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? `Add ${noun}` : `Edit ${noun}`} onClose={closeModal} onSave={() => void save()} saving={saving || loadingDetail}>
          {loadingDetail ? (
            <div className="flex justify-center py-2"><Spinner label={`Loading ${noun.toLowerCase()}`} /></div>
          ) : null}
          {editing?.code ? (
            <FormField label="Code">
              <input className="form-input" value={editing.code} readOnly disabled />
            </FormField>
          ) : null}
          <FormField label={`${noun} Name`} required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }} maxLength={nameMax}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder={namePlaceholder} />
          </FormField>
          {hasDescription ? (
            <FormField label="Description">
              <textarea className="form-input resize-none" rows={2} maxLength={api.definition.descriptionMax}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
          ) : null}
          {hasSequence ? (
            <FormField label="Sequence" required error={errors.sequence}>
              <input type="number" min={1} className="form-input" style={{ borderColor: errors.sequence ? C.red : undefined }}
                value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} />
            </FormField>
          ) : null}
          {numberDefs.map((field) => (
            <FormField key={field.key} label={`${field.label}${field.suffix ? ` (${field.suffix})` : ''}`} error={errors[`number:${field.key}`]}>
              <input type="number" min={field.min ?? 0} max={field.max} className="form-input"
                style={{ borderColor: errors[`number:${field.key}`] ? C.red : undefined }}
                placeholder={field.hint} aria-label={field.label}
                value={form.numbers[field.key] ?? ''}
                onChange={(e) => setForm({ ...form, numbers: { ...form.numbers, [field.key]: e.target.value } })} />
            </FormField>
          ))}
          {hasColor ? (
            <FormField label="Colour" error={errors.colorCoding}>
              <div className="flex items-center gap-2">
                <input type="color" aria-label="Colour" className="h-9 w-12 cursor-pointer rounded-lg border p-0.5"
                  style={{ borderColor: C.border }}
                  value={HEX_COLOR.test(form.colorCoding.trim()) ? form.colorCoding.trim() : DEFAULT_COLOR}
                  onChange={(e) => setForm({ ...form, colorCoding: e.target.value })} />
                <input className="form-input font-mono" maxLength={7} placeholder="#2955A3" aria-label="Colour code"
                  style={{ borderColor: errors.colorCoding ? C.red : undefined }}
                  value={form.colorCoding} onChange={(e) => setForm({ ...form, colorCoding: e.target.value })} />
              </div>
            </FormField>
          ) : null}
          {flagDefs.length ? (
            <div className="space-y-2">
              {flagDefs.map((flag) => (
                <label key={flag.key} className="flex cursor-pointer items-start gap-2.5 text-xs">
                  <input type="checkbox" className="mt-0.5" checked={form.flags[flag.key] === true}
                    onChange={(e) => setForm({ ...form, flags: { ...form.flags, [flag.key]: e.target.checked } })} />
                  <span>
                    <span className="font-semibold" style={{ color: C.text }}>{flag.label}</span>
                    {flag.hint ? <span className="block" style={{ color: C.muted }}>{flag.hint}</span> : null}
                  </span>
                </label>
              ))}
            </div>
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
