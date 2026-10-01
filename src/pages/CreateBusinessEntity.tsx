import { useState, useRef, type ReactNode } from 'react';
import {
  BusinessEntity, EntityType, EntityStatus, EntityLocation, EntityContact,
  ENTITY_STATUSES, TERRITORIES, INDIAN_STATES,
} from '../data/businessEntities';
import { useMasterData } from '../contexts/MasterDataContext';
import { useCrmActions } from '../contexts/CrmStoreContext';
import { Card, FormGrid, IconTooltip, SelectField, TextAreaField, TextField } from '../ui';
import { UserSelectField } from '../components/UserSelect';
import { saveConfirm, useConfirm } from '../contexts/ConfirmContext'

interface Props {
  existing?: BusinessEntity | null;
  onBack: () => void;
  onSuccess: () => void;
  embedded?: boolean;
  onCreated?: (entity: BusinessEntity) => void;
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-surface"
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

const SECTION_ICONS = {
  basic: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  locations: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  contacts: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  business: (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
} as const

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <SectionIcon>{icon}</SectionIcon>
          <h2 className="font-display text-sm font-bold text-ink">{title}</h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  )
}

const EMPTY_LOCATION: Omit<EntityLocation, 'id'> = {
  label: '', address: '', city: '', state: 'Maharashtra', country: 'India',
  territory: 'West India – Maharashtra', preferredPort: '', isPrimary: false,
};

const EMPTY_CONTACT: Omit<EntityContact, 'id'> = {
  name: '', designation: '', department: '', mobile: '', email: '', isPrimary: false,
};

export default function CreateBusinessEntity({ existing, onBack, onSuccess, embedded, onCreated }: Props) {
  const confirm = useConfirm()
  const { activeEntityTypeNames } = useMasterData();
  const { addEntity } = useCrmActions();
  const isEdit = !!existing;

  // Basic Info
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<EntityType>(existing?.type ?? 'Prospect');
  const [website, setWebsite] = useState(existing?.website ?? '');
  const [gstin, setGstin] = useState(existing?.gstin ?? '');
  const [status, setStatus] = useState<EntityStatus>(existing?.status ?? 'Prospect');
  const [salesperson, setSalesperson] = useState(existing?.salesperson ?? 'Priya Mehta');

  // Locations
  const [locations, setLocations] = useState<EntityLocation[]>(
    existing?.locations ?? [{ id: 'new-loc-1', ...EMPTY_LOCATION, isPrimary: true }]
  );

  // Contacts
  const [contacts, setContacts] = useState<EntityContact[]>(
    existing?.contacts ?? [{ id: 'new-con-1', ...EMPTY_CONTACT, isPrimary: true }]
  );

  // Business info
  const [products, setProducts] = useState(existing?.products ?? '');
  const [remarks, setRemarks] = useState(existing?.remarks ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateLocation(idx: number, k: keyof EntityLocation, v: string | boolean) {
    setLocations((ls) => ls.map((l, i) => i === idx ? { ...l, [k]: v } : l));
  }

  function addLocation() {
    setLocations((ls) => [...ls, { id: `new-loc-${Date.now()}`, ...EMPTY_LOCATION }]);
  }

  function removeLocation(idx: number) {
    setLocations((ls) => ls.filter((_, i) => i !== idx));
  }

  function setPrimaryLocation(idx: number) {
    setLocations((ls) => ls.map((l, i) => ({ ...l, isPrimary: i === idx })));
  }

  function updateContact(idx: number, k: keyof EntityContact, v: string | boolean) {
    setContacts((cs) => cs.map((c, i) => i === idx ? { ...c, [k]: v } : c));
  }

  function addContact() {
    setContacts((cs) => [...cs, { id: `new-con-${Date.now()}`, ...EMPTY_CONTACT }]);
  }

  function removeContact(idx: number) {
    setContacts((cs) => cs.filter((_, i) => i !== idx));
  }

  function setPrimaryContact(idx: number) {
    setContacts((cs) => cs.map((c, i) => ({ ...c, isPrimary: i === idx })));
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Business entity name is required';
    if (!type) errs.type = 'Entity type is required';
    contacts.forEach((c, i) => {
      if (!c.name.trim()) errs[`contact_${i}_name`] = `Contact ${i + 1}: Name is required`;
    });
    return errs;
  }

  async function handleSave() {
    if (saving) return;
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!(await confirm(saveConfirm('Business Entity', isEdit)))) return;
    setSaving(true);
    if (!isEdit) {
      const created = {
        id: `BE-${Date.now()}`,
        name: name.trim(),
        type,
        website,
        gstin,
        status,
        locations,
        contacts,
        products,
        remarks,
        salesperson,
        createdDate: new Date().toISOString().slice(0, 10),
        activeLeads: 0,
        lastActivity: 'Just now',
      };
      onCreated?.(created);
      addEntity(created);
    }
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(onSuccess, embedded ? 700 : 1200); }, 500);
  }

  if (saved) {
    return (
      <div className="flex-1 flex items-center justify-center p-10" style={{ background: '#f2f5fb' }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#1a8040,#0f7a50)' }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'DM Sans, sans-serif', color: '#0c1a3a' }}>
            {isEdit ? 'Entity Updated' : 'Entity Created'}
          </h2>
          <p className="text-sm" style={{ color: '#7a8494' }}>
            <strong>{name}</strong> has been {isEdit ? 'updated' : 'added'} successfully.
          </p>
          <div className="w-full rounded-full h-1 mt-6" style={{ background: '#e2e8f0' }}>
            <div className="h-1 rounded-full animate-pulse" style={{ width: '80%', background: 'linear-gradient(90deg,#2955a3,#c41e1e)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-canvas">
      {/* Header */}
      {!embedded && (
      <div className="page-gutter pt-5 pb-4 flex-shrink-0" style={{ background: '#fff', borderBottom: '1px solid #dce4f2' }}>
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium mb-3 transition-colors"
          style={{ color: '#7a8494' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#2955a3')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#7a8494')}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Business Entities
        </button>
        <h1 className="text-lg font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: '#0c1a3a' }}>
          {isEdit ? `Edit: ${existing?.name}` : 'Create Business Entity'}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#7a8494' }}>
          {isEdit ? 'Update entity details, contacts and locations' : 'Add a new company to your CRM'}
        </p>
      </div>
      )}

      {/* Form body */}
      <div className="page-gutter flex-1 space-y-5 py-4">

        {/* Error summary */}
        {Object.keys(errors).length > 0 && (
          <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
            style={{ background: '#fff0f0', border: '1px solid #fca5a5' }}>
            <svg className="flex-shrink-0 mt-0.5" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#c41e1e" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
            </svg>
            <div>
              <p className="text-sm font-bold mb-1" style={{ color: '#c41e1e' }}>Please fix the following:</p>
              {Object.values(errors).map((e, i) => <p key={i} className="text-sm" style={{ color: '#c41e1e' }}>• {e}</p>)}
            </div>
          </div>
        )}

        {/* ── Section 1: Basic Information ── */}
        <Section title="Basic Information" icon={SECTION_ICONS.basic}>
          <FormGrid cols={3} className="mb-4">
            <TextField label="Business Entity Name" required error={errors.name} value={name} onValueChange={setName} placeholder="e.g. Tata Consultancy Services Ltd." />
            <SelectField label="Entity Type" required options={activeEntityTypeNames} value={type} onValueChange={(v) => setType(v as EntityType)} />
            <SelectField label="Status" options={[...ENTITY_STATUSES]} value={status} onValueChange={(v) => setStatus(v as EntityStatus)} />
          </FormGrid>
          <FormGrid cols={3} className="mb-4">
            <TextField label="Website" value={website} onValueChange={setWebsite} placeholder="www.example.com" />
            <TextField label="GST / Tax Registration No." value={gstin} onValueChange={setGstin} placeholder="e.g. 27AABCT1332L000" className="font-mono tracking-wide" />
            <UserSelectField label="Assigned Salesperson" placeholder="Select salesperson" value={salesperson} onValueChange={setSalesperson} />
          </FormGrid>
        </Section>

        {/* ── Section 2: Locations ── */}
        <Section title="Locations / Branches / Offices / Plants" icon={SECTION_ICONS.locations}>
          <div className="space-y-4">
            {locations.map((loc, idx) => (
              <div key={loc.id} className="rounded-xl p-4 relative"
                style={{ background: '#f8fafd', border: `1px solid ${loc.isPrimary ? '#c2d3f5' : '#eef2f9'}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: '#7c3aed' }}>
                      {idx + 1}
                    </div>
                    <input value={loc.label} onChange={(e) => updateLocation(idx, 'label', e.target.value)}
                      className="text-sm font-bold bg-transparent outline-none border-b border-transparent hover:border-purple-300 focus:border-purple-400"
                      style={{ color: '#0c1a3a', minWidth: 120 }}
                      placeholder="e.g. Head Office" />
                    {loc.isPrimary && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#eef3fc', color: '#2955a3', border: '1px solid #c2d3f5' }}>
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!loc.isPrimary && (
                      <button type="button" onClick={() => setPrimaryLocation(idx)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                        style={{ color: '#2955a3', background: '#eef3fc', border: '1px solid #c2d3f5' }}>
                        Set Primary
                      </button>
                    )}
                    {locations.length > 1 && (
                      <IconTooltip label="Remove location">
                        <button type="button" aria-label="Remove location" onClick={() => removeLocation(idx)}
                          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                          style={{ color: '#94a3b8' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#c41e1e'; (e.currentTarget as HTMLButtonElement).style.background = '#fff0f0'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </IconTooltip>
                    )}
                  </div>
                </div>
                <FormGrid cols={3} className="gap-3">
                  <TextField fieldClassName="lg:col-span-3" label="Address" value={loc.address} onValueChange={(v) => updateLocation(idx, 'address', v)} placeholder="Street, building, floor" />
                  <TextField label="City" value={loc.city} onValueChange={(v) => updateLocation(idx, 'city', v)} placeholder="Mumbai" />
                  <SelectField label="State" options={INDIAN_STATES} value={loc.state} onValueChange={(v) => updateLocation(idx, 'state', v)} />
                  <TextField label="Country" value={loc.country} onValueChange={(v) => updateLocation(idx, 'country', v)} />
                  <SelectField label="Territory / Region" options={TERRITORIES} value={loc.territory} onValueChange={(v) => updateLocation(idx, 'territory', v)} />
                  <TextField fieldClassName="lg:col-span-2" label="Preferred Port / Delivery Location" value={loc.preferredPort} onValueChange={(v) => updateLocation(idx, 'preferredPort', v)} placeholder="e.g. JNPT, Nhava Sheva" />
                </FormGrid>
              </div>
            ))}
            <button type="button" onClick={addLocation}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl w-full justify-center transition-colors"
              style={{ background: '#f8fafd', color: '#7c3aed', border: '1.5px dashed #c4b5fd' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#fdf4ff'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c3aed'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafd'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c4b5fd'; }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Another Location
            </button>
          </div>
        </Section>

        {/* ── Section 3: Contacts ── */}
        <Section title="Contact Persons" icon={SECTION_ICONS.contacts}>
          <div className="space-y-4">
            {contacts.map((con, idx) => (
              <div key={con.id} className="rounded-xl p-4"
                style={{ background: '#f8fafd', border: `1px solid ${con.isPrimary ? '#bbf0cf' : '#eef2f9'}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ background: '#0f7a50' }}>
                      {idx + 1}
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#0c1a3a' }}>
                      {con.name || `Contact ${idx + 1}`}
                    </p>
                    {con.isPrimary && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#edfbf1', color: '#1a8040', border: '1px solid #bbf0cf' }}>
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!con.isPrimary && (
                      <button type="button" onClick={() => setPrimaryContact(idx)}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ color: '#1a8040', background: '#edfbf1', border: '1px solid #bbf0cf' }}>
                        Set Primary
                      </button>
                    )}
                    {contacts.length > 1 && (
                      <IconTooltip label="Remove contact">
                        <button type="button" aria-label="Remove contact" onClick={() => removeContact(idx)}
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ color: '#94a3b8' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#c41e1e'; (e.currentTarget as HTMLButtonElement).style.background = '#fff0f0'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </IconTooltip>
                    )}
                  </div>
                </div>
                <FormGrid cols={3} className="gap-3">
                  <TextField label="Full Name" required error={errors[`contact_${idx}_name`]} value={con.name} onValueChange={(v) => updateContact(idx, 'name', v)} placeholder="e.g. Rajesh Sharma" />
                  <TextField label="Designation" value={con.designation} onValueChange={(v) => updateContact(idx, 'designation', v)} placeholder="Chief Technology Officer" />
                  <TextField label="Department" value={con.department} onValueChange={(v) => updateContact(idx, 'department', v)} placeholder="IT / Technology" />
                  <TextField label="Mobile" type="tel" value={con.mobile} onValueChange={(v) => updateContact(idx, 'mobile', v)} placeholder="+91 98000 00000" />
                  <TextField fieldClassName="lg:col-span-2" label="Email" type="email" value={con.email} onValueChange={(v) => updateContact(idx, 'email', v)} placeholder="name@company.com" />
                </FormGrid>
              </div>
            ))}
            <button type="button" onClick={addContact}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl w-full justify-center transition-colors"
              style={{ background: '#f8fafd', color: '#0f7a50', border: '1.5px dashed #86efac' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#edfbf1'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#0f7a50'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafd'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#86efac'; }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Another Contact
            </button>
          </div>
        </Section>

        {/* ── Section 4: Business Information ── */}
        <Section title="Business Information" icon={SECTION_ICONS.business}>
          <div className="space-y-4">
            <TextField label="Products / Items Regularly Required" value={products} onValueChange={setProducts} placeholder="e.g. ERP Suite, Analytics Module, CRM Platform" />
            <TextAreaField label="General Remarks" rows={4} value={remarks} onValueChange={setRemarks} placeholder="Internal notes, key observations, decision-making process, stakeholder details…" />
          </div>
        </Section>
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 page-gutter py-4 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: '#fff', borderTop: '1px solid #dce4f2', boxShadow: '0 -2px 12px rgba(12,26,58,0.06)' }}>
        <button onClick={onBack}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          style={{ background: '#f0f4fb', color: '#4a5d82', border: '1px solid #dce4f2' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#f0f4fb')}>
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            <span style={{ color: '#c41e1e' }}>*</span> Required fields
          </p>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-colors"
            style={{ background: saving ? '#7c9fd1' : '#2955a3', boxShadow: saving ? 'none' : '0 2px 8px rgba(41,85,163,0.28)', cursor: saving ? 'not-allowed' : undefined }}
            onMouseEnter={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#1e3f87'; }}
            onMouseLeave={(e) => { if (!saving) (e.currentTarget as HTMLButtonElement).style.background = '#2955a3'; }}>
            {saving && (
              <svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {saving ? 'Saving…' : isEdit ? 'Update Entity' : 'Create Entity'}
          </button>
        </div>
      </div>
    </div>
  );
}
