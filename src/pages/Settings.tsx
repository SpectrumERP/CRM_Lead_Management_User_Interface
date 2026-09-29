import { useState, useRef } from 'react';
import {
  useMasterData,
  LeadSourceItem, LeadStageItem, LeadStatusItem, EntityTypeItem, ActivityTypeItem,
  MasterItemStatus,
} from '../contexts/MasterDataContext';
import ConfirmDialog from '../components/ConfirmDialog';
import { ToastType } from '../components/Toast';
import { SelectField, CountBadge } from '../ui';
import {
  C, StatusBadge, SectionHeader, FilterBar, Th, Td, Modal, FormField, RowActions, EmptyRows, MasterTable,
  type ToggleConfirm,
} from './settings/atoms';
import ApiMasterSection from './settings/ApiMasterSection';
import LocalMasterSection from './settings/LocalMasterSection';
import { useApiMaster } from './settings/useApiMaster';
import { masterApis } from '../api/masters';
import { useSpectrumCompany } from '../auth/useSpectrumCompany';

interface Props {
  onToast?: (type: ToastType, title: string, message?: string) => void;
}


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Lead Sources
// ══════════════════════════════════════════════════════════════════════════════
function LeadSourcesSection({ onToast }: { onToast?: Props['onToast'] }) {
  const { data, setLeadSources } = useMasterData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<LeadSourceItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'Active' as MasterItemStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmToggle, setConfirmToggle] = useState<ToggleConfirm | null>(null);
  const idRef = useRef(100);

  const filtered = data.leadSources.filter((x) => {
    if (search && !x.name.toLowerCase().includes(search.toLowerCase()) && !x.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'All' && x.status !== statusFilter) return false;
    return true;
  });

  function openAdd() {
    setIsNew(true); setEditing(null);
    setForm({ name: '', description: '', status: 'Active' }); setErrors({});
  }
  function openEdit(item: LeadSourceItem) {
    setIsNew(false); setEditing(item);
    setForm({ name: item.name, description: item.description, status: item.status }); setErrors({});
  }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Source name is required';
    else if (data.leadSources.some((x) => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== editing?.id))
      e.name = 'This source name already exists';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (isNew) {
      const newItem: LeadSourceItem = {
        id: `LS_${++idRef.current}`, name: form.name.trim(),
        description: form.description.trim(), status: form.status,
        createdDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      };
      setLeadSources([...data.leadSources, newItem]);
      onToast?.('success', 'Lead Source Added', `"${newItem.name}" has been created.`);
    } else if (editing) {
      setLeadSources(data.leadSources.map((x) => x.id === editing.id ? { ...x, ...form, name: form.name.trim(), description: form.description.trim() } : x));
      onToast?.('success', 'Lead Source Updated', `"${form.name.trim()}" saved successfully.`);
    }
    closeModal();
  }

  function toggle(id: string, currentStatus: MasterItemStatus) {
    const next: MasterItemStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setLeadSources(data.leadSources.map((x) => x.id === id ? { ...x, status: next } : x));
    onToast?.('info', `Source ${next}`, `Lead source has been ${next.toLowerCase()}.`);
    setConfirmToggle(null);
  }

  return (
    <div>
      <SectionHeader title="Lead Sources" subtitle="Where your leads originate" count={data.leadSources.length} onAdd={openAdd} />
      <FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter}
        onClear={() => { setSearch(''); setStatusFilter('All'); }} />
      <MasterTable>
        <thead><tr>
          <Th>Source Name</Th><Th>Description</Th><Th>Status</Th><Th>Created</Th><Th right>Actions</Th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? <EmptyRows onAdd={openAdd} /> : filtered.map((item) => (
            <tr key={item.id} style={{ opacity: item.status === 'Inactive' ? 0.6 : 1 }}>
              <Td><span className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</span></Td>
              <Td><span className="text-xs" style={{ color: C.sub }}>{item.description || '—'}</span></Td>
              <Td><StatusBadge status={item.status} /></Td>
              <Td><span className="text-xs" style={{ color: '#94a3b8' }}>{item.createdDate}</span></Td>
              <Td right><RowActions onEdit={() => openEdit(item)} onToggle={() => setConfirmToggle({ id: item.id, name: item.name, currentStatus: item.status })} status={item.status} /></Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? 'Add Lead Source' : 'Edit Lead Source'} onClose={closeModal} onSave={save}>
          <FormField label="Source Name" required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="e.g. LinkedIn" />
          </FormField>
          <FormField label="Description">
            <textarea className="form-input resize-none" rows={2}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this source" />
          </FormField>
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
          title={confirmToggle.currentStatus === 'Active' ? 'Deactivate Lead Source' : 'Activate Lead Source'}
          message={confirmToggle.currentStatus === 'Active'
            ? `Deactivating "${confirmToggle.name}" will hide it from all lead forms. Existing leads will be unaffected.`
            : `Activating "${confirmToggle.name}" will make it available in all lead forms again.`}
          confirmLabel={confirmToggle.currentStatus === 'Active' ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.currentStatus === 'Active'}
          onConfirm={() => toggle(confirmToggle.id, confirmToggle.currentStatus)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Lead Stages
// ══════════════════════════════════════════════════════════════════════════════
function LeadStagesSection({ onToast }: { onToast?: Props['onToast'] }) {
  const { data, setLeadStages } = useMasterData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<LeadStageItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: '', displayOrder: 1, status: 'Active' as MasterItemStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmToggle, setConfirmToggle] = useState<ToggleConfirm | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const idRef = useRef(100);

  const filtered = data.leadStages
    .filter((x) => {
      if (search && !x.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'All' && x.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);

  function openAdd() {
    const nextOrder = Math.max(...data.leadStages.map((x) => x.displayOrder), 0) + 1;
    setIsNew(true); setEditing(null);
    setForm({ name: '', displayOrder: nextOrder, status: 'Active' }); setErrors({});
  }
  function openEdit(item: LeadStageItem) {
    setIsNew(false); setEditing(item);
    setForm({ name: item.name, displayOrder: item.displayOrder, status: item.status }); setErrors({});
  }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Stage name is required';
    else if (data.leadStages.some((x) => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== editing?.id))
      e.name = 'This stage name already exists';
    if (!form.displayOrder || form.displayOrder < 1) e.order = 'Order must be at least 1';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (isNew) {
      const newItem: LeadStageItem = { id: `LST_${++idRef.current}`, name: form.name.trim(), displayOrder: form.displayOrder, status: form.status };
      setLeadStages([...data.leadStages, newItem]);
      onToast?.('success', 'Lead Stage Added', `"${newItem.name}" has been created.`);
    } else if (editing) {
      setLeadStages(data.leadStages.map((x) => x.id === editing.id ? { ...x, name: form.name.trim(), displayOrder: form.displayOrder, status: form.status } : x));
      onToast?.('success', 'Lead Stage Updated', `"${form.name.trim()}" saved successfully.`);
    }
    closeModal();
  }

  function reorderStage(fromId: string, toId: string) {
    if (fromId === toId) return;
    const sorted = [...data.leadStages].sort((a, b) => a.displayOrder - b.displayOrder);
    const fromIdx = sorted.findIndex((x) => x.id === fromId);
    const toIdx = sorted.findIndex((x) => x.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...sorted];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLeadStages(next.map((item, index) => ({ ...item, displayOrder: index + 1 })));
  }

  function toggle(id: string, currentStatus: MasterItemStatus) {
    const next: MasterItemStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setLeadStages(data.leadStages.map((x) => x.id === id ? { ...x, status: next } : x));
    onToast?.('info', `Stage ${next}`, `Lead stage has been ${next.toLowerCase()}.`);
    setConfirmToggle(null);
  }

  return (
    <div>
      <SectionHeader title="Lead Stages" subtitle="Sales pipeline progression steps" count={data.leadStages.length} onAdd={openAdd} />
      <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309' }}>
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Drag rows to reorder stages. Display order determines the pipeline progression sequence.
      </div>
      <FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter}
        onClear={() => { setSearch(''); setStatusFilter('All'); }} />
      <MasterTable>
        <thead>
          <tr>
            <Th narrow>Order</Th>
            <Th>Stage Name</Th>
            <Th>Status</Th>
            <Th right narrow>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? <EmptyRows onAdd={openAdd} /> : filtered.map((item) => {
            const dragging = dragId === item.id;
            const dropTarget = overId === item.id && dragId !== item.id;
            return (
              <tr
                key={item.id}
                draggable
                onDragStart={(event) => {
                  const target = event.target as HTMLElement
                  if (target.closest('button, a, input, select')) {
                    event.preventDefault()
                    return
                  }
                  setDragId(item.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', item.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (overId !== item.id) setOverId(item.id);
                }}
                onDragLeave={() => {
                  if (overId === item.id) setOverId(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromId = event.dataTransfer.getData('text/plain') || dragId;
                  if (fromId) reorderStage(fromId, item.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className="cursor-move"
                style={{
                  opacity: item.status === 'Inactive' ? 0.6 : dragging ? 0.55 : 1,
                  background: dropTarget ? C.blueBg : dragging ? '#f0f4fb' : undefined,
                  boxShadow: dropTarget ? `inset 0 2px 0 0 ${C.blue}` : undefined,
                }}
              >
                <Td narrow>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-faint" aria-hidden="true" title="Drag to reorder">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                      </svg>
                    </span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold" style={{ background: C.blueBg, color: C.blue }}>
                      {item.displayOrder}
                    </div>
                  </div>
                </Td>
                <Td><span className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</span></Td>
                <Td><StatusBadge status={item.status} /></Td>
                <Td right narrow>
                  <RowActions
                    onEdit={() => openEdit(item)}
                    onToggle={() => setConfirmToggle({ id: item.id, name: item.name, currentStatus: item.status })}
                    status={item.status}
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? 'Add Lead Stage' : 'Edit Lead Stage'} onClose={closeModal} onSave={save}>
          <FormField label="Stage Name" required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="e.g. Proposal Sent" />
          </FormField>
          <FormField label="Display Order" required error={errors.order}>
            <input type="number" min={1} className="form-input" style={{ borderColor: errors.order ? C.red : undefined }}
              value={form.displayOrder} onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 1 })} />
          </FormField>
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
          title={confirmToggle.currentStatus === 'Active' ? 'Deactivate Lead Stage' : 'Activate Lead Stage'}
          message={confirmToggle.currentStatus === 'Active'
            ? `Deactivating "${confirmToggle.name}" will remove it from the pipeline. Existing leads at this stage will retain their current value.`
            : `Activating "${confirmToggle.name}" will add it back to the pipeline.`}
          confirmLabel={confirmToggle.currentStatus === 'Active' ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.currentStatus === 'Active'}
          onConfirm={() => toggle(confirmToggle.id, confirmToggle.currentStatus)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Lead Statuses
// ══════════════════════════════════════════════════════════════════════════════
function LeadStatusesSection({ onToast }: { onToast?: Props['onToast'] }) {
  const { data, setLeadStatuses } = useMasterData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<LeadStatusItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: 'Active' as MasterItemStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmToggle, setConfirmToggle] = useState<ToggleConfirm | null>(null);
  const idRef = useRef(100);

  const filtered = data.leadStatuses.filter((x) => {
    if (search && !x.name.toLowerCase().includes(search.toLowerCase()) && !x.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'All' && x.status !== statusFilter) return false;
    return true;
  });

  function openAdd() { setIsNew(true); setEditing(null); setForm({ name: '', description: '', status: 'Active' }); setErrors({}); }
  function openEdit(item: LeadStatusItem) { setIsNew(false); setEditing(item); setForm({ name: item.name, description: item.description, status: item.status }); setErrors({}); }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Status name is required';
    else if (data.leadStatuses.some((x) => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== editing?.id))
      e.name = 'This status name already exists';
    setErrors(e); return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (isNew) {
      const newItem: LeadStatusItem = { id: `LSTS_${++idRef.current}`, name: form.name.trim(), description: form.description.trim(), status: form.status };
      setLeadStatuses([...data.leadStatuses, newItem]);
      onToast?.('success', 'Lead Status Added', `"${newItem.name}" has been created.`);
    } else if (editing) {
      setLeadStatuses(data.leadStatuses.map((x) => x.id === editing.id ? { ...x, name: form.name.trim(), description: form.description.trim(), status: form.status } : x));
      onToast?.('success', 'Lead Status Updated', `"${form.name.trim()}" saved successfully.`);
    }
    closeModal();
  }

  function toggle(id: string, currentStatus: MasterItemStatus) {
    const next: MasterItemStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setLeadStatuses(data.leadStatuses.map((x) => x.id === id ? { ...x, status: next } : x));
    onToast?.('info', `Status ${next}`, `Lead status has been ${next.toLowerCase()}.`);
    setConfirmToggle(null);
  }

  return (
    <div>
      <SectionHeader title="Lead Statuses" subtitle="Disposition states for a lead record" count={data.leadStatuses.length} onAdd={openAdd} />
      <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: C.blueBg, border: `1px solid ${C.blueBorder}`, color: C.sub }}>
        <strong style={{ color: C.blue }}>Note:</strong> Lead Status is different from Lead Stage. Stage tracks pipeline progression; Status tracks the overall disposition of the lead.
      </div>
      <FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter}
        onClear={() => { setSearch(''); setStatusFilter('All'); }} />
      <MasterTable>
        <thead><tr>
          <Th>Status Name</Th><Th>Description</Th><Th>Status</Th><Th right>Actions</Th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? <EmptyRows onAdd={openAdd} /> : filtered.map((item) => (
            <tr key={item.id} style={{ opacity: item.status === 'Inactive' ? 0.6 : 1 }}>
              <Td><span className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</span></Td>
              <Td><span className="text-xs" style={{ color: C.sub }}>{item.description || '—'}</span></Td>
              <Td><StatusBadge status={item.status} /></Td>
              <Td right><RowActions onEdit={() => openEdit(item)} onToggle={() => setConfirmToggle({ id: item.id, name: item.name, currentStatus: item.status })} status={item.status} /></Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? 'Add Lead Status' : 'Edit Lead Status'} onClose={closeModal} onSave={save}>
          <FormField label="Status Name" required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="e.g. Nurturing" />
          </FormField>
          <FormField label="Description">
            <textarea className="form-input resize-none" rows={2}
              value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of this status" />
          </FormField>
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
          title={confirmToggle.currentStatus === 'Active' ? 'Deactivate Lead Status' : 'Activate Lead Status'}
          message={confirmToggle.currentStatus === 'Active'
            ? `Deactivating "${confirmToggle.name}" will hide it from lead forms. Leads with this status will retain their current value.`
            : `Activating "${confirmToggle.name}" will make it available in lead forms again.`}
          confirmLabel={confirmToggle.currentStatus === 'Active' ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.currentStatus === 'Active'}
          onConfirm={() => toggle(confirmToggle.id, confirmToggle.currentStatus)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Business Entity Types
// ══════════════════════════════════════════════════════════════════════════════
function EntityTypesSection({ onToast }: { onToast?: Props['onToast'] }) {
  const { data, setEntityTypes } = useMasterData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<EntityTypeItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: '', status: 'Active' as MasterItemStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmToggle, setConfirmToggle] = useState<ToggleConfirm | null>(null);
  const idRef = useRef(100);

  const filtered = data.entityTypes.filter((x) => {
    if (search && !x.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'All' && x.status !== statusFilter) return false;
    return true;
  });

  function openAdd() { setIsNew(true); setEditing(null); setForm({ name: '', status: 'Active' }); setErrors({}); }
  function openEdit(item: EntityTypeItem) { setIsNew(false); setEditing(item); setForm({ name: item.name, status: item.status }); setErrors({}); }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Entity type name is required';
    else if (data.entityTypes.some((x) => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== editing?.id))
      e.name = 'This entity type already exists';
    setErrors(e); return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (isNew) {
      const newItem: EntityTypeItem = { id: `ET_${++idRef.current}`, name: form.name.trim(), status: form.status };
      setEntityTypes([...data.entityTypes, newItem]);
      onToast?.('success', 'Entity Type Added', `"${newItem.name}" has been created.`);
    } else if (editing) {
      setEntityTypes(data.entityTypes.map((x) => x.id === editing.id ? { ...x, name: form.name.trim(), status: form.status } : x));
      onToast?.('success', 'Entity Type Updated', `"${form.name.trim()}" saved successfully.`);
    }
    closeModal();
  }

  function toggle(id: string, currentStatus: MasterItemStatus) {
    const next: MasterItemStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setEntityTypes(data.entityTypes.map((x) => x.id === id ? { ...x, status: next } : x));
    onToast?.('info', `Entity Type ${next}`, `Entity type has been ${next.toLowerCase()}.`);
    setConfirmToggle(null);
  }

  return (
    <div>
      <SectionHeader title="Business Entity Types" subtitle="Classification for companies and organisations" count={data.entityTypes.length} onAdd={openAdd} />
      <FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter}
        onClear={() => { setSearch(''); setStatusFilter('All'); }} />
      <MasterTable>
        <thead><tr>
          <Th>Entity Type</Th><Th>Status</Th><Th right>Actions</Th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? <EmptyRows onAdd={openAdd} /> : filtered.map((item) => (
            <tr key={item.id} style={{ opacity: item.status === 'Inactive' ? 0.6 : 1 }}>
              <Td><span className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</span></Td>
              <Td><StatusBadge status={item.status} /></Td>
              <Td right><RowActions onEdit={() => openEdit(item)} onToggle={() => setConfirmToggle({ id: item.id, name: item.name, currentStatus: item.status })} status={item.status} /></Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? 'Add Entity Type' : 'Edit Entity Type'} onClose={closeModal} onSave={save}>
          <FormField label="Entity Type Name" required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="e.g. Reseller" />
          </FormField>
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
          title={confirmToggle.currentStatus === 'Active' ? 'Deactivate Entity Type' : 'Activate Entity Type'}
          message={confirmToggle.currentStatus === 'Active'
            ? `Deactivating "${confirmToggle.name}" will hide it from entity forms. Existing entities retain their current type.`
            : `Activating "${confirmToggle.name}" will make it available in entity forms.`}
          confirmLabel={confirmToggle.currentStatus === 'Active' ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.currentStatus === 'Active'}
          onConfirm={() => toggle(confirmToggle.id, confirmToggle.currentStatus)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Activity Types
// ══════════════════════════════════════════════════════════════════════════════
function ActivityTypesSection({ onToast }: { onToast?: Props['onToast'] }) {
  const { data, setActivityTypes } = useMasterData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editing, setEditing] = useState<ActivityTypeItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ name: '', status: 'Active' as MasterItemStatus });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmToggle, setConfirmToggle] = useState<ToggleConfirm | null>(null);
  const idRef = useRef(100);

  const filtered = data.activityTypes.filter((x) => {
    if (search && !x.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'All' && x.status !== statusFilter) return false;
    return true;
  });

  function openAdd() { setIsNew(true); setEditing(null); setForm({ name: '', status: 'Active' }); setErrors({}); }
  function openEdit(item: ActivityTypeItem) { setIsNew(false); setEditing(item); setForm({ name: item.name, status: item.status }); setErrors({}); }
  function closeModal() { setEditing(null); setIsNew(false); setErrors({}); }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Activity type name is required';
    else if (data.activityTypes.some((x) => x.name.toLowerCase() === form.name.trim().toLowerCase() && x.id !== editing?.id))
      e.name = 'This activity type already exists';
    setErrors(e); return Object.keys(e).length === 0;
  }

  function save() {
    if (!validate()) return;
    if (isNew) {
      const newItem: ActivityTypeItem = { id: `AT_${++idRef.current}`, name: form.name.trim(), status: form.status };
      setActivityTypes([...data.activityTypes, newItem]);
      onToast?.('success', 'Activity Type Added', `"${newItem.name}" has been created.`);
    } else if (editing) {
      setActivityTypes(data.activityTypes.map((x) => x.id === editing.id ? { ...x, name: form.name.trim(), status: form.status } : x));
      onToast?.('success', 'Activity Type Updated', `"${form.name.trim()}" saved successfully.`);
    }
    closeModal();
  }

  function toggle(id: string, currentStatus: MasterItemStatus) {
    const next: MasterItemStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    setActivityTypes(data.activityTypes.map((x) => x.id === id ? { ...x, status: next } : x));
    onToast?.('info', `Activity Type ${next}`, `Activity type has been ${next.toLowerCase()}.`);
    setConfirmToggle(null);
  }

  return (
    <div>
      <SectionHeader title="Activity Types" subtitle="Types of sales activities that can be logged" count={data.activityTypes.length} onAdd={openAdd} />
      <FilterBar search={search} onSearch={setSearch} statusFilter={statusFilter} onStatus={setStatusFilter}
        onClear={() => { setSearch(''); setStatusFilter('All'); }} />
      <MasterTable>
        <thead><tr>
          <Th>Activity Type</Th><Th>Status</Th><Th right>Actions</Th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? <EmptyRows onAdd={openAdd} /> : filtered.map((item) => (
            <tr key={item.id} style={{ opacity: item.status === 'Inactive' ? 0.6 : 1 }}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: C.blueBg, color: C.blue }}>
                    {item.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: C.text }}>{item.name}</span>
                </div>
              </Td>
              <Td><StatusBadge status={item.status} /></Td>
              <Td right><RowActions onEdit={() => openEdit(item)} onToggle={() => setConfirmToggle({ id: item.id, name: item.name, currentStatus: item.status })} status={item.status} /></Td>
            </tr>
          ))}
        </tbody>
      </MasterTable>

      {(isNew || editing) && (
        <Modal title={isNew ? 'Add Activity Type' : 'Edit Activity Type'} onClose={closeModal} onSave={save}>
          <FormField label="Activity Type Name" required error={errors.name}>
            <input className="form-input" style={{ borderColor: errors.name ? C.red : undefined }}
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="e.g. Demo Call" />
          </FormField>
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
          title={confirmToggle.currentStatus === 'Active' ? 'Deactivate Activity Type' : 'Activate Activity Type'}
          message={confirmToggle.currentStatus === 'Active'
            ? `Deactivating "${confirmToggle.name}" will remove it from activity forms. Existing activities retain their type.`
            : `Activating "${confirmToggle.name}" will make it selectable in activity forms.`}
          confirmLabel={confirmToggle.currentStatus === 'Active' ? 'Deactivate' : 'Activate'}
          danger={confirmToggle.currentStatus === 'Active'}
          onConfirm={() => toggle(confirmToggle.id, confirmToggle.currentStatus)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN Settings Page
// ══════════════════════════════════════════════════════════════════════════════

type TabGroup = 'lead' | 'opportunity' | 'general';

const SETTING_TABS = [
  { id: 'sources', group: 'lead', label: 'Lead Sources', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /> },
  { id: 'stages', group: 'lead', label: 'Lead Stages', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /> },
  { id: 'statuses', group: 'lead', label: 'Lead Statuses', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { id: 'priorities', group: 'lead', label: 'Lead Priorities', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" /> },
  { id: 'oppStages', group: 'opportunity', label: 'Opportunity Stages', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /> },
  { id: 'oppStatuses', group: 'opportunity', label: 'Opportunity Statuses', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /> },
  { id: 'products', group: 'opportunity', label: 'Products', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> },
  { id: 'activityTypes', group: 'general', label: 'Activity Types', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
  { id: 'entityTypes', group: 'general', label: 'Entity Types', icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V7l6-4v18M9 11H3v10M15 21V11h6v10" /> },
] as const;

const TAB_GROUPS: { id: TabGroup; label: string }[] = [
  { id: 'lead', label: 'Lead Management' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'general', label: 'General' },
];

type SettingTab = typeof SETTING_TABS[number]['id'];

const LOCAL_ONLY_NOTE = 'Stored in this app for now; it will move to the server once its API is available.';

export default function Settings({ onToast }: Props) {
  const [activeTab, setActiveTab] = useState<SettingTab>('sources');
  const { data, setLeadPriorities, setOpportunityStages, setOpportunityStatuses, setProducts } = useMasterData();
  const company = useSpectrumCompany();
  // Spectrum login → the documented masters come from the API; demo login → unchanged local data.
  const apiCompany = company.enabled ? company.companyNo : null;
  const sourcesApi = useApiMaster(masterApis.leadSources, apiCompany);
  const stagesApi = useApiMaster(masterApis.leadStages, apiCompany);
  const prioritiesApi = useApiMaster(masterApis.leadPriorities, apiCompany);
  const activityTypesApi = useApiMaster(masterApis.leadActivityTypes, apiCompany);
  const useApi = apiCompany !== null;

  const counts: Record<SettingTab, number> = {
    sources: useApi ? sourcesApi.rows.length : data.leadSources.length,
    stages: useApi ? stagesApi.rows.length : data.leadStages.length,
    statuses: data.leadStatuses.length,
    priorities: useApi ? prioritiesApi.rows.length : data.leadPriorities.length,
    oppStages: data.opportunityStages.length,
    oppStatuses: data.opportunityStatuses.length,
    products: data.products.length,
    activityTypes: useApi ? activityTypesApi.rows.length : data.activityTypes.length,
    entityTypes: data.entityTypes.length,
  };

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:flex-row" style={{ background: C.bg }}>
      {/* Left settings nav */}
      <aside className="w-full lg:w-56 flex-shrink-0 flex flex-col"
        style={{ background: '#fff', borderRight: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div className="px-4 py-4 lg:py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f0f4fb' }}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={C.blue} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: C.text }}>Settings</p>
              <p className="text-xs" style={{ color: C.muted }}>Master Data</p>
            </div>
          </div>
        </div>
        <nav className="flex lg:flex-col flex-1 px-2 py-2 lg:py-3 gap-1 lg:space-y-0.5 overflow-x-auto">
          {TAB_GROUPS.map((group, groupIndex) => (
            <div key={group.id} className="contents">
              <p className={`hidden lg:block text-xs font-bold px-3 mb-2.5 uppercase tracking-widest ${groupIndex > 0 ? 'mt-4' : ''}`}
                style={{ color: '#94a3b8', fontSize: 9.5 }}>{group.label}</p>
              {SETTING_TABS.filter((tab) => tab.group === group.id).map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all whitespace-nowrap flex-shrink-0 lg:w-full"
                  style={{
                    background: activeTab === tab.id ? C.blueBg : 'transparent',
                    color: activeTab === tab.id ? C.blue : C.sub,
                    border: activeTab === tab.id ? `1px solid ${C.blueBorder}` : '1px solid transparent',
                  }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{tab.icon}</svg>
                  <span className="flex-1">{tab.label}</span>
                  <CountBadge
                    value={counts[tab.id]}
                    tone={activeTab === tab.id ? 'primary' : 'muted'}
                  />
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="hidden lg:block px-4 py-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-xs" style={{ color: '#c8d2e2' }}>Phase 1 · Lead Management</p>
        </div>
      </aside>

      {/* Main content */}
      <div className="page-gutter min-h-0 min-w-0 flex-1 overflow-y-auto py-4">
        {/* Page title */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: C.text }}>
              Master Data Configuration
            </h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>
              Manage the lookup values used across all lead management screens.
            </p>
          </div>
          {useApi && company.companies.length > 1 ? (
            <div className="w-64 max-w-full">
              <SelectField
                label="Company"
                preserveOrder
                options={company.companies.map((c) => ({ value: String(c.CompanyNo), label: c.CompanyName }))}
                value={String(company.companyNo)}
                onValueChange={(v) => company.setCompanyNo(Number(v))}
              />
            </div>
          ) : null}
        </div>

        {/* Tab content */}
        {activeTab === 'sources' && (useApi
          ? <ApiMasterSection api={masterApis.leadSources} state={sourcesApi} title="Lead Sources" subtitle="Where your leads originate"
              noun="Lead Source" namePlaceholder="e.g. LinkedIn" onToast={onToast} />
          : <LeadSourcesSection onToast={onToast} />)}
        {activeTab === 'stages' && (useApi
          ? <ApiMasterSection api={masterApis.leadStages} state={stagesApi} title="Lead Stages" subtitle="Sales pipeline progression steps"
              noun="Lead Stage" namePlaceholder="e.g. Proposal Sent" onToast={onToast} />
          : <LeadStagesSection onToast={onToast} />)}
        {activeTab === 'statuses' && <LeadStatusesSection onToast={onToast} />}
        {activeTab === 'priorities' && (useApi
          ? <ApiMasterSection api={masterApis.leadPriorities} state={prioritiesApi} title="Lead Priorities" subtitle="Urgency levels for leads"
              noun="Lead Priority" namePlaceholder="e.g. High" onToast={onToast} />
          : <LocalMasterSection items={data.leadPriorities} onChange={setLeadPriorities} title="Lead Priorities" subtitle="Urgency levels for leads"
              noun="Lead Priority" idPrefix="LP" namePlaceholder="e.g. High" fields={{ order: true }} onToast={onToast} />)}
        {activeTab === 'oppStages' && (
          <LocalMasterSection items={data.opportunityStages} onChange={setOpportunityStages} title="Opportunity Stages"
            subtitle="Deal progression and win probability" noun="Opportunity Stage" idPrefix="OST" namePlaceholder="e.g. Proposal"
            fields={{ order: true, weight: true }} note={LOCAL_ONLY_NOTE} onToast={onToast} />
        )}
        {activeTab === 'oppStatuses' && (
          <LocalMasterSection items={data.opportunityStatuses} onChange={setOpportunityStatuses} title="Opportunity Statuses"
            subtitle="Overall disposition of an opportunity" noun="Opportunity Status" idPrefix="OSTS" namePlaceholder="e.g. On Hold"
            fields={{ description: true }} note={LOCAL_ONLY_NOTE} onToast={onToast} />
        )}
        {activeTab === 'products' && (
          <LocalMasterSection items={data.products} onChange={setProducts} title="Products"
            subtitle="Items that can be quoted on leads and opportunities" noun="Product" idPrefix="PRD" namePlaceholder="e.g. Steel Channel 100mm"
            fields={{ code: true, description: true }} note={LOCAL_ONLY_NOTE} onToast={onToast} />
        )}
        {activeTab === 'activityTypes' && (useApi
          ? <ApiMasterSection api={masterApis.leadActivityTypes} state={activityTypesApi} title="Activity Types"
              subtitle="Types of sales activities that can be logged" noun="Activity Type" namePlaceholder="e.g. Demo Call" onToast={onToast} />
          : <ActivityTypesSection onToast={onToast} />)}
        {activeTab === 'entityTypes' && <EntityTypesSection onToast={onToast} />}
      </div>
    </div>
  );
}
