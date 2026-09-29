import { useRef, useState } from 'react';
import type { MasterItemStatus, SimpleMasterItem } from '../../contexts/MasterDataContext';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { ToastType } from '../../components/Toast';
import { SelectField } from '../../ui';
import {
  C, EmptyRows, FilterBar, FormField, MasterTable, Modal, RowActions, SectionHeader, StatusBadge, Td, Th,
  type ToggleConfirm,
} from './atoms';

export interface LocalMasterSectionProps {
  items: SimpleMasterItem[];
  onChange: (next: SimpleMasterItem[]) => void;
  title: string;
  subtitle: string;
  /** Singular noun for toasts and drawer titles, e.g. "Opportunity Stage". */
  noun: string;
  idPrefix: string;
  namePlaceholder: string;
  /** Optional columns / form fields. */
  fields: { code?: boolean; description?: boolean; order?: boolean; weight?: boolean };
  /** Shown under the header, e.g. "no API yet" notes. */
  note?: string;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

interface FormState {
  name: string;
  code: string;
  description: string;
  displayOrder: number;
  weight: number;
  status: MasterItemStatus;
}

/** In-app master (no Spectrum API yet): same add / edit / activate flow as the other local sections. */
export default function LocalMasterSection({
  items, onChange, title, subtitle, noun, idPrefix, namePlaceholder, fields, note, onToast,
}: LocalMasterSectionProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<SimpleMasterItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', code: '', description: '', displayOrder: 1, weight: 0, status: 'Active' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmToggle, setConfirmToggle] = useState<ToggleConfirm | null>(null);
  const idRef = useRef(100);

  const query = search.trim().toLowerCase();
  const filtered = items
    .filter((x) => {
      if (query && ![x.name, x.code, x.description].some((v) => v?.toLowerCase().includes(query))) return false;
      if (statusFilter !== 'All' && x.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => (fields.order ? (a.displayOrder ?? 0) - (b.displayOrder ?? 0) : 0));

  function openAdd() {
    const nextOrder = Math.max(0, ...items.map((x) => x.displayOrder ?? 0)) + 1;
    setIsNew(true); setEditing(null);
    setForm({ name: '', code: '', description: '', displayOrder: nextOrder, weight: 0, status: 'Active' }); setErrors({});
  }
  function openEdit(item: SimpleMasterItem) {
    setIsNew(false); setEditing(item);
    setForm({
      name: item.name, code: item.code ?? '', description: item.description ?? '',
      displayOrder: item.displayOrder ?? 1, weight: item.weight ?? 0, status: item.status,
    });
    setErrors({});
  }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = `${noun} name is required`;
    else if (items.some((x) => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== editing?.id))
      e.name = `This ${noun.toLowerCase()} already exists`;
    if (fields.code && form.code.trim() && items.some((x) => x.code?.toLowerCase() === form.code.trim().toLowerCase() && x.id !== editing?.id))
      e.code = 'This code already exists';
    if (fields.order && (!form.displayOrder || form.displayOrder < 1)) e.order = 'Order must be at least 1';
    if (fields.weight && (form.weight < 0 || form.weight > 100)) e.weight = 'Weight must be between 0 and 100';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function toItem(base: Partial<SimpleMasterItem>): SimpleMasterItem {
    return {
      id: base.id ?? `${idPrefix}_${++idRef.current}`,
      name: form.name.trim(),
      status: form.status,
      ...(fields.code ? { code: form.code.trim() } : {}),
      ...(fields.description ? { description: form.description.trim() } : {}),
      ...(fields.order ? { displayOrder: form.displayOrder } : {}),
      ...(fields.weight ? { weight: form.weight } : {}),
    };
  }

  function save() {
    if (!validate()) return;
    if (isNew) {
      const next = toItem({});
      onChange([...items, next]);
      onToast?.('success', `${noun} Added`, `"${next.name}" has been created.`);
    } else if (editing) {
      onChange(items.map((x) => (x.id === editing.id ? { ...x, ...toItem(x) } : x)));
      onToast?.('success', `${noun} Updated`, `"${form.name.trim()}" saved successfully.`);
    }
    closeModal();
  }

  function toggle(id: string, currentStatus: MasterItemStatus) {
    const next: MasterItemStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    onChange(items.map((x) => (x.id === id ? { ...x, status: next } : x)));
    onToast?.('info', `${noun} ${next}`, `${noun} has been ${next.toLowerCase()}.`);
    setConfirmToggle(null);
  }

  return (
    <div>
      <SectionHeader title={title} subtitle={subtitle} count={items.length} onAdd={openAdd} />
      {note ? (
        <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.sub }}>
          {note}
        </div>
      ) : null}
      <FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter}
        onClear={() => { setSearch(''); setStatusFilter('All'); }} />
      <MasterTable>
        <thead><tr>
          {fields.order ? <Th narrow>Order</Th> : null}
          {fields.code ? <Th narrow>Code</Th> : null}
          <Th>Name</Th>
          {fields.weight ? <Th narrow>Weight</Th> : null}
          {fields.description ? <Th>Description</Th> : null}
          <Th>Status</Th>
          <Th right narrow>Actions</Th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? <EmptyRows onAdd={openAdd} /> : filtered.map((item) => (
            <tr key={item.id} style={{ opacity: item.status === 'Inactive' ? 0.6 : 1 }}>
              {fields.order ? (
                <Td narrow>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold" style={{ background: C.blueBg, color: C.blue }}>
                    {item.displayOrder ?? '—'}
                  </div>
                </Td>
              ) : null}
              {fields.code ? <Td narrow><span className="font-mono text-xs" style={{ color: C.sub }}>{item.code || '—'}</span></Td> : null}
              <Td><span className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</span></Td>
              {fields.weight ? <Td narrow><span className="text-xs font-semibold" style={{ color: C.sub }}>{item.weight ?? 0}%</span></Td> : null}
              {fields.description ? <Td><span className="text-xs" style={{ color: C.sub }}>{item.description || '—'}</span></Td> : null}
              <Td><StatusBadge status={item.status} /></Td>
              <Td right narrow>
                <RowActions onEdit={() => openEdit(item)} status={item.status}
                  onToggle={() => setConfirmToggle({ id: item.id, name: item.name, currentStatus: item.status })} />
              </Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? `Add ${noun}` : `Edit ${noun}`} onClose={closeModal} onSave={save}>
          <FormField label={`${noun} Name`} required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder={namePlaceholder} />
          </FormField>
          {fields.code ? (
            <FormField label="Code" error={errors.code}>
              <input className="form-input" style={{ borderColor: errors.code ? C.red : undefined }}
                value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </FormField>
          ) : null}
          {fields.order ? (
            <FormField label="Display Order" required error={errors.order}>
              <input type="number" min={1} className="form-input" style={{ borderColor: errors.order ? C.red : undefined }}
                value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 1 })} />
            </FormField>
          ) : null}
          {fields.weight ? (
            <FormField label="Weight (%)" error={errors.weight}>
              <input type="number" min={0} max={100} className="form-input" style={{ borderColor: errors.weight ? C.red : undefined }}
                value={form.weight} onChange={(e) => setForm({ ...form, weight: parseInt(e.target.value) || 0 })} />
            </FormField>
          ) : null}
          {fields.description ? (
            <FormField label="Description">
              <textarea className="form-input resize-none" rows={2}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </FormField>
          ) : null}
          <SelectField
            label="Status"
            options={['Active', 'Inactive']}
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as MasterItemStatus })}
          />
        </Modal>
      )}

      {confirmToggle && (
        <ConfirmDialog
          title={confirmToggle.currentStatus === 'Active' ? `Deactivate ${noun}` : `Activate ${noun}`}
          message={confirmToggle.currentStatus === 'Active'
            ? `Deactivating "${confirmToggle.name}" will hide it from forms. Existing records keep their current value.`
            : `Activating "${confirmToggle.name}" will make it available in forms again.`}
          confirmLabel={confirmToggle.currentStatus === 'Active' ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.currentStatus === 'Active'}
          onConfirm={() => toggle(confirmToggle.id, confirmToggle.currentStatus)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  );
}
