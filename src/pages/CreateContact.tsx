import { useState } from 'react';
import { Contact, DEPARTMENTS, CONTACT_STATUSES } from '../data/contacts';
import { useCrmActions, useCrmSelector } from '../contexts/CrmStoreContext';
import { ChoiceField, FormGrid, SearchSelectField, SelectField, TextAreaField, TextField } from '../ui';

interface Props {
  existing?: Contact | null;
  onBack: () => void;
  onSuccess: () => void;
  embedded?: boolean;
  prefillEntityId?: string;
  onCreated?: (contact: Contact) => void;
}

function SectionWrapper({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #dce4f2' }}>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: '#f8faff', borderBottom: '1px solid #dce4f2' }}>
        <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: color }} />
        <h3 className="text-sm font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>{title}</h3>
      </div>
      <div className="p-5 bg-white">{children}</div>
    </div>
  );
}

export default function CreateContact({ existing, onBack, onSuccess, embedded, prefillEntityId, onCreated }: Props) {
  const isEdit = !!existing;
  const { addContact } = useCrmActions();
  const entities = useCrmSelector((state) => state.entities);
  const prefillEntity = entities.find((e) => e.id === (existing?.businessEntityId || prefillEntityId));

  // Form state
  const [name, setName] = useState(existing?.name ?? '');
  const [entityId, setEntityId] = useState(existing?.businessEntityId ?? prefillEntity?.id ?? '');
  const [entityName, setEntityName] = useState(existing?.businessEntityName ?? prefillEntity?.name ?? '');

  const [designation, setDesignation] = useState(existing?.designation ?? '');
  const [department, setDepartment] = useState(existing?.department ?? '');
  const [mobile, setMobile] = useState(existing?.mobile ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [locationLabel, setLocationLabel] = useState(existing?.locationLabel ?? '');
  const [isPrimary, setIsPrimary] = useState<boolean>(existing?.isPrimary ?? false);
  const [remarks, setRemarks] = useState(existing?.remarks ?? '');
  const [status, setStatus] = useState<'Active' | 'Inactive'>(existing?.status ?? 'Active');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedEntity = entities.find((be) => be.id === entityId) ?? null;

  function selectEntity(id: string, n: string) {
    setEntityId(id);
    setEntityName(n);
    // Pre-fill location from entity primary location
    const be = entities.find((b) => b.id === id);
    if (be && !locationLabel) {
      const primary = be.locations.find((l) => l.isPrimary) ?? be.locations[0];
      if (primary) setLocationLabel(`${primary.label}, ${primary.city}`);
    }
    setErrors((prev) => { const n2 = { ...prev }; delete n2.entity; return n2; });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Contact name is required';
    if (!entityId) e.entity = 'Business entity is required';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
    if (!isEdit) {
      const created = {
        id: `CON-${Date.now()}`,
        name: name.trim(),
        businessEntityId: entityId,
        businessEntityName: entityName,
        designation,
        department,
        mobile,
        email,
        locationLabel,
        isPrimary,
        status,
        remarks,
        createdDate: new Date().toISOString().slice(0, 10),
        lastActivity: 'Just now',
      };
      onCreated?.(created);
      addContact(created);
    }
    setSaved(true);
    setTimeout(() => {
      onSuccess();
    }, embedded ? 700 : 1400);
  }

  if (saved) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: '#edfbf1' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1a8040" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>
              Contact {isEdit ? 'Updated' : 'Created'}
            </p>
            <p className="text-sm mt-1" style={{ color: '#7a8494' }}>{name} has been saved successfully.</p>
          </div>
          <div className="w-48 mx-auto h-1.5 rounded-full overflow-hidden" style={{ background: '#dce4f2' }}>
            <div className="h-full rounded-full animate-[grow_1.3s_ease_forwards]" style={{ background: '#2955a3', width: 0 }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-gutter space-y-5 py-4">
      {/* Header */}
      <div className={`flex items-center gap-3 ${embedded ? 'hidden' : ''}`}>
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ border: '1px solid #dce4f2', color: '#7a8494' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>
            {isEdit ? 'Edit Contact' : 'Add Contact'}
          </h1>
          <p className="text-xs" style={{ color: '#7a8494' }}>
            {isEdit ? `Editing ${existing!.name}` : 'Add a new contact to the CRM'}
          </p>
        </div>
      </div>

      {/* Contact Info section */}
      <SectionWrapper title="Contact Information" color="#2955a3">
        <FormGrid className="gap-x-6 gap-y-4">
          <TextField
            label="Contact Name"
            required
            error={errors.name}
            value={name}
            onValueChange={(v) => { setName(v); setErrors((p) => { const n = { ...p }; delete n.name; return n; }); }}
            placeholder="e.g. Rajesh Sharma"
          />
          <SearchSelectField
            label="Business Entity"
            required
            error={errors.entity}
            options={entities}
            value={selectedEntity}
            onChange={(be) => {
              if (!be) {
                setEntityId('')
                setEntityName('')
                return
              }
              selectEntity(be.id, be.name)
            }}
            getKey={(be) => be.id}
            getLabel={(be) => be.name}
            placeholder="Search business entity…"
            renderOption={(be) => (
              <div>
                <p className="text-xs font-semibold text-ink">{be.name}</p>
                <p className="text-xs text-ink-faint">{be.id} · {be.type}</p>
              </div>
            )}
          />
          <TextField label="Designation" value={designation} onValueChange={setDesignation} placeholder="e.g. Chief Technology Officer" />
          <SelectField label="Department" options={DEPARTMENTS} placeholder="Select department" value={department} onValueChange={setDepartment} />
          <TextField label="Mobile / Phone" value={mobile} onValueChange={setMobile} placeholder="+91 98XXX XXXXX" />
          <TextField
            label="Email"
            type="email"
            error={errors.email}
            value={email}
            onValueChange={(v) => { setEmail(v); setErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
            placeholder="name@company.com"
          />
          <TextField label="Location / Plant" value={locationLabel} onValueChange={setLocationLabel} placeholder="e.g. Head Office, Mumbai" />
          <ChoiceField
            label="Primary Contact"
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
            value={isPrimary ? 'yes' : 'no'}
            onChange={(v) => setIsPrimary(v === 'yes')}
          />
        </FormGrid>
      </SectionWrapper>

      {/* Additional Info */}
      <SectionWrapper title="Additional Information" color="#6d28d9">
        <FormGrid className="gap-x-6 gap-y-4">
          <TextAreaField fieldClassName="lg:col-span-2" label="Remarks" rows={3} value={remarks} onValueChange={setRemarks} placeholder="Notes about this contact — key concerns, preferred meeting times, context…" />
          <ChoiceField
            label="Status"
            options={[...CONTACT_STATUSES]}
            value={status}
            onChange={setStatus}
          />
        </FormGrid>
      </SectionWrapper>

      {/* Bottom actions */}
      <div
        className="page-gutter sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl py-4"
        style={{ background: '#fff', border: '1px solid #dce4f2' }}
      >
        <button
          onClick={onBack}
          className="px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ color: '#7a8494', border: '1px solid #dce4f2' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fb')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 rounded-lg text-sm font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#2955a3,#1a3d7c)', boxShadow: '0 2px 8px rgba(41,85,163,0.25)' }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 14px rgba(41,85,163,0.4)')}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(41,85,163,0.25)')}
        >
          {isEdit ? 'Save Changes' : 'Add Contact'}
        </button>
      </div>
    </div>
  );
}
