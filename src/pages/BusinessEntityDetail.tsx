import { useState } from 'react';
import { entityTypeMeta, entityStatusMeta } from '../data/businessEntities';
import { activityTypeMeta, activityStatusMeta, formatDateTime } from '../data/activities';
import { meetingModeMeta, meetingStatusMeta, formatMeetingDateTime } from '../data/meetings';
import { formatLeadValue, normalizeOrgName } from '../data/leads';
import { docTypeMeta } from '../data/documents';
import ActivityDrawer from '../components/ActivityDrawer';
import MeetingDrawer from '../components/MeetingDrawer';
import { ToastType } from '../components/Toast';
import { useCrmActions, useCrmSelector } from '../contexts/CrmStoreContext';
import { CountBadge } from '../ui';
import { formatDate, formatDateSmart } from '../utils/dateFormat';

interface Props {
  entityId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  onViewLead?: (id: string) => void;
  onViewActivity?: (id: string) => void;
  onViewMeeting?: (id: string) => void;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

const TABS = ['Overview', 'Contacts', 'Leads', 'Activities', 'Meetings', 'Notes', 'Documents'] as const;
type Tab = typeof TABS[number];

function SummaryPill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="tracking-wider font-bold" style={{ fontSize: 9.5, color: '#7a8494', letterSpacing: '0.07em' }}>{label}</p>
      <p className="font-bold mt-0.5 truncate" style={{ fontSize: 13, color: accent ? '#c41e1e' : '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>{value}</p>
    </div>
  );
}

function CardSection({ title, color, children, action }: { title: string; color: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#fff', border: '1px solid #dce4f2', boxShadow: '0 1px 3px rgba(12,26,58,0.04)' }}>
      <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f4fb' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: color }} />
          <h3 className="text-sm font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: '#0c1a3a' }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function BusinessEntityDetail({ entityId, onBack, onEdit, onViewLead, onToast }: Props) {
  const entity = useCrmSelector((state) => state.entities.find((item) => item.id === entityId));
  const { leads, activities, meetings, documents } = useCrmSelector(
    (state) => ({
      leads: state.leads,
      activities: state.activities,
      meetings: state.meetings,
      documents: state.documents,
    }),
    (left, right) =>
      left.leads === right.leads &&
      left.activities === right.activities &&
      left.meetings === right.meetings &&
      left.documents === right.documents,
  );
  const { addActivity, addMeeting } = useCrmActions();
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [notes, setNotes] = useState<{ id: string; text: string; date: string; by: string }[]>([
    { id: 'N1', text: 'Initial discovery call completed. Key stakeholders are aligned on requirements and project timeline.', date: '10 Sep 2024', by: entity?.salesperson ?? 'Priya Mehta' },
    { id: 'N2', text: 'Follow-up meeting scheduled. Decision-maker has requested detailed product documentation and compliance certificates.', date: '05 Sep 2024', by: entity?.salesperson ?? 'Priya Mehta' },
  ]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showMeetingDrawer, setShowMeetingDrawer] = useState(false);

  if (!entity) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: '#7a8494' }}>Business entity not found.</p>
        <button type="button" onClick={onBack} className="mt-3 text-sm font-semibold" style={{ color: '#2955a3' }}>Back to list</button>
      </div>
    );
  }

  const entityLeads = leads.filter((l) => {
    const a = normalizeOrgName(l.companyName);
    const b = normalizeOrgName(entity.name);
    return a === b || a.startsWith(b) || b.startsWith(a);
  }).slice(0, 5);
  const entityActivities = activities.filter((a) => a.leadName === entity.name).slice(0, 6);
  const entityMeetings = meetings.filter((m) => m.leadName === entity.name).slice(0, 5);
  const entityDocs = documents.filter((d) => d.relatedId === entity.id && d.relatedType === 'entity');

  const primaryContact = entity.contacts.find((c) => c.isPrimary) ?? entity.contacts[0];
  const primaryLocation = entity.locations.find((l) => l.isPrimary) ?? entity.locations[0];

  const typeMeta = entityTypeMeta(entity.type);
  const statusMeta = entityStatusMeta(entity.status);

  function addNote() {
    if (!newNote.trim()) return;
    setNotes((n) => [{ id: `N${Date.now()}`, text: newNote.trim(), date: 'Today', by: 'Priya Mehta' }, ...n]);
    setNewNote('');
    setAddingNote(false);
  }

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-canvas">

      {/* ── Header ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #dce4f2', flexShrink: 0 }}>
        {/* Back */}
        <div className="page-gutter pt-4">
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
        </div>

        {/* Title row */}
        <div className="page-gutter pb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#0c1a3a,#2955a3)' }}>
                {entity.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold" style={{ fontFamily: 'DM Sans, sans-serif', color: '#0c1a3a' }}>
                    {entity.name}
                  </h1>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md"
                    style={{ background: '#f0f4fb', color: '#4a5d82', border: '1px solid #dce4f2' }}>
                    {entity.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.border}` }}>
                    {entity.type}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.border}` }}>
                    <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: statusMeta.color }} />
                    {entity.status}
                  </span>
                  {entity.website && (
                    <>
                      <span style={{ color: '#94a3b8' }}>·</span>
                      <span className="text-xs" style={{ color: '#2955a3' }}>{entity.website}</span>
                    </>
                  )}
                  <span style={{ color: '#94a3b8' }}>·</span>
                  <span className="text-xs" style={{ color: '#7a8494' }}>{entity.salesperson}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => onEdit(entity.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#2955a3', boxShadow: '0 2px 6px rgba(41,85,163,0.25)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1e3f87')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#2955a3')}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              {([
                { label: '+ Activity', color: '#2955a3', bg: '#eef3fc', border: '#c2d3f5', action: () => { setShowActivityDrawer(true); setActiveTab('Activities'); } },
                { label: '+ Meeting', color: '#0f7a50', bg: '#edfbf1', border: '#bbf0cf', action: () => { setShowMeetingDrawer(true); setActiveTab('Meetings'); } },
              ] as const).map(({ label, color, bg, border, action }) => (
                <button key={label} onClick={action}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ color, background: bg, border: `1px solid ${border}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <div className="page-gutter py-3.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3"
          style={{ borderTop: '1px solid #f0f4fb' }}>
          <SummaryPill label="City" value={primaryLocation?.city ?? '—'} />
          <SummaryPill label="State" value={primaryLocation?.state ?? '—'} />
          <SummaryPill label="Territory" value={primaryLocation?.territory?.split(' – ')[1] ?? primaryLocation?.territory ?? '—'} />
          <SummaryPill label="GSTIN" value={entity.gstin || '—'} />
          <SummaryPill label="Active Leads" value={String(entity.activeLeads)} accent={entity.activeLeads > 0} />
          <SummaryPill label="Last Activity" value={formatDate(entity.lastActivity)} />
        </div>
      </div>

      {/* ── Tabs bar ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #dce4f2', flexShrink: 0 }}>
        <div className="page-gutter flex items-center overflow-x-auto">
          {TABS.map((tab) => {
            const count: Record<string, number> = {
              Contacts: entity.contacts.length,
              Leads: entityLeads.length,
              Activities: entityActivities.length,
              Meetings: entityMeetings.length,
              Notes: notes.length,
              Documents: entityDocs.length,
            };
            const tabBadgeColor: Record<string, string> = {
              Contacts: '#edfbf1',
              Leads: '#fff0f0',
              Activities: '#eef3fc',
              Meetings: '#fdf4ff',
              Notes: '#fffbeb',
              Documents: '#f0f4fb',
            };
            const tabBadgeText: Record<string, string> = {
              Contacts: '#1a8040',
              Leads: '#c41e1e',
              Activities: '#2955a3',
              Meetings: '#7c3aed',
              Notes: '#b45309',
              Documents: '#4a5d82',
            };
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="px-4 py-3 text-xs font-semibold transition-all flex-shrink-0"
                style={{ color: activeTab === tab ? '#2955a3' : '#7a8494', borderBottom: `2px solid ${activeTab === tab ? '#2955a3' : 'transparent'}` }}>
                {tab}
                {count[tab] !== undefined && (
                  <CountBadge
                    value={count[tab]}
                    size="sm"
                    className="ml-1.5"
                    style={{
                      background: tabBadgeColor[tab] ?? '#f0f4fb',
                      color: tabBadgeText[tab] ?? '#4a5d82',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="p-6">

        {/* Overview */}
        {activeTab === 'Overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Company info */}
            <CardSection title="Company Details" color="#2955a3">
              <div className="space-y-3">
                {[
                  { label: 'Entity Type', value: entity.type },
                  { label: 'Status', value: entity.status },
                  { label: 'Website', value: entity.website || '—' },
                  { label: 'GSTIN', value: entity.gstin || '—' },
                  { label: 'Salesperson', value: entity.salesperson },
                  { label: 'Products Required', value: entity.products || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-xs font-semibold flex-shrink-0 w-28" style={{ color: '#94a3b8' }}>{label}</span>
                    <span className="text-xs" style={{ color: '#0c1a3a' }}>{value}</span>
                  </div>
                ))}
              </div>
            </CardSection>

            {/* Primary location */}
            <CardSection title="Primary Location" color="#7c3aed">
              {primaryLocation ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: '#fdf4ff' }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-bold" style={{ color: '#7c3aed' }}>{primaryLocation.label}</p>
                  </div>
                  {[
                    { label: 'Address', value: primaryLocation.address },
                    { label: 'City', value: primaryLocation.city },
                    { label: 'State', value: primaryLocation.state },
                    { label: 'Territory', value: primaryLocation.territory },
                    { label: 'Preferred Port', value: primaryLocation.preferredPort || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <span className="text-xs font-semibold flex-shrink-0 w-24" style={{ color: '#94a3b8' }}>{label}</span>
                      <span className="text-xs" style={{ color: '#0c1a3a' }}>{value}</span>
                    </div>
                  ))}
                  {entity.locations.length > 1 && (
                    <button onClick={() => setActiveTab('Overview')}
                      className="text-xs font-semibold mt-1" style={{ color: '#7c3aed' }}>
                      +{entity.locations.length - 1} more location{entity.locations.length > 2 ? 's' : ''}
                    </button>
                  )}
                </div>
              ) : <p className="text-xs" style={{ color: '#94a3b8' }}>No location added</p>}
            </CardSection>

            {/* Primary contact */}
            <CardSection title="Primary Contact" color="#0f7a50">
              {primaryContact ? (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#0f7a50,#1a8040)' }}>
                      {primaryContact.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm" style={{ color: '#0c1a3a' }}>{primaryContact.name}</p>
                      <p className="text-xs font-semibold" style={{ color: '#0f7a50' }}>{primaryContact.designation}</p>
                      <p className="text-xs" style={{ color: '#94a3b8' }}>{primaryContact.department}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />, value: primaryContact.mobile },
                      { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />, value: primaryContact.email },
                    ].map(({ icon, value }, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <svg className="flex-shrink-0" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#7a8494" strokeWidth={2}>{icon}</svg>
                        <span className="text-xs" style={{ color: '#4a5d82' }}>{value || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="text-xs" style={{ color: '#94a3b8' }}>No contact added</p>}
            </CardSection>

            {/* All locations */}
            {entity.locations.length > 1 && (
              <div className="lg:col-span-3">
                <CardSection title={`All Locations (${entity.locations.length})`} color="#7c3aed">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {entity.locations.map((loc) => (
                      <div key={loc.id} className="rounded-xl p-3.5"
                        style={{ background: loc.isPrimary ? '#f8f0ff' : '#f8fafd', border: `1px solid ${loc.isPrimary ? '#e9d5ff' : '#eef2f9'}` }}>
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-bold" style={{ color: '#7c3aed' }}>{loc.label}</p>
                          {loc.isPrimary && (
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: '#e9d5ff', color: '#7c3aed', fontSize: 9 }}>Primary</span>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: '#4a5d82' }}>{loc.address}</p>
                        <p className="text-xs" style={{ color: '#4a5d82' }}>{loc.city}, {loc.state}</p>
                        <p className="text-xs mt-1" style={{ color: '#94a3b8' }}>{loc.territory}</p>
                        {loc.preferredPort && (
                          <p className="text-xs mt-1" style={{ color: '#7c3aed' }}>Port: {loc.preferredPort}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardSection>
              </div>
            )}

            {/* Remarks */}
            {entity.remarks && (
              <div className="lg:col-span-3">
                <CardSection title="General Remarks" color="#b45309">
                  <p className="text-sm leading-relaxed" style={{ color: '#4a5d82' }}>{entity.remarks}</p>
                </CardSection>
              </div>
            )}
          </div>
        )}

        {/* Contacts */}
        {activeTab === 'Contacts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: '#7a8494' }}>{entity.contacts.length} contacts</p>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#7c3aed', boxShadow: '0 2px 6px rgba(124,58,237,0.22)' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Contact
              </button>
            </div>
            {entity.contacts.map((c) => (
              <div key={c.id} className="rounded-xl p-4 flex items-start gap-4"
                style={{ background: '#fff', border: '1px solid #dce4f2' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#2955a3)' }}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm" style={{ color: '#0c1a3a' }}>{c.name}</p>
                    {c.isPrimary && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#edfbf1', color: '#1a8040', border: '1px solid #bbf0cf' }}>Primary</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: '#7c3aed' }}>{c.designation}</p>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>{c.department}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {c.mobile && <span className="text-xs" style={{ color: '#4a5d82' }}>📞 {c.mobile}</span>}
                    {c.email && <span className="text-xs" style={{ color: '#4a5d82' }}>✉️ {c.email}</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {[
                    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />, hc: '#0f7a50', hbg: '#edfbf1' },
                    { icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />, hc: '#2955a3', hbg: '#eef3fc' },
                  ].map(({ icon, hc, hbg }, i) => (
                    <button key={i} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                      style={{ color: '#94a3b8' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = hc; (e.currentTarget as HTMLButtonElement).style.background = hbg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{icon}</svg>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leads */}
        {activeTab === 'Leads' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: '#7a8494' }}>{entityLeads.length} leads</p>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#c41e1e', boxShadow: '0 2px 6px rgba(196,30,30,0.22)' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Lead
              </button>
            </div>
            {entityLeads.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#c8d8f0" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>No leads yet for this entity</p>
              </div>
            ) : entityLeads.map((lead) => (
              <div key={lead.id} className="rounded-xl p-4 flex items-center justify-between gap-4"
                style={{ background: '#fff', border: '1px solid #dce4f2' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <button onClick={() => onViewLead?.(lead.id)}
                      className="text-sm font-bold hover:underline" style={{ color: '#2955a3' }}>
                      {lead.leadSource} — {lead.productsRequired}
                    </button>
                    <span className="font-mono text-xs px-1.5 py-0.5 rounded"
                      style={{ background: '#f0f4fb', color: '#4a5d82' }}>{lead.id}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: '#7a8494' }}>
                    <span>Contact: {lead.contactPerson}</span>
                    <span>Value: <strong style={{ color: '#c41e1e' }}>{formatLeadValue(lead)}</strong></span>
                    <span>Closure: {formatDate(lead.expectedClosureDate)}</span>
                    <span>By: {lead.assignedSalesperson}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="badge" style={{ fontSize: 11, background: '#eef3fc', color: '#2955a3', border: '1px solid #c2d3f5' }}>{lead.leadStage}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Activities */}
        {activeTab === 'Activities' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: '#7a8494' }}>{entityActivities.length} activities</p>
              <button onClick={() => setShowActivityDrawer(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#2955a3', boxShadow: '0 2px 6px rgba(41,85,163,0.22)' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Log Activity
              </button>
            </div>
            {entityActivities.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>No activities logged yet</p>
              </div>
            ) : entityActivities.map((a) => {
              const tb = activityTypeMeta(a.type);
              const sb = activityStatusMeta(a.status);
              return (
                <div key={a.id} className="rounded-xl p-4 flex gap-3.5"
                  style={{ background: '#fff', border: '1px solid #dce4f2' }}>
                  <span className="text-xs font-bold px-2 py-1 rounded-md flex-shrink-0 h-fit"
                    style={{ background: tb.bg, color: tb.color, border: `1px solid ${tb.border}` }}>
                    {a.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <p className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>{a.subject}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: sb.bg, color: sb.color, border: `1px solid ${sb.border}` }}>
                        {a.status}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>
                      {formatDateTime(a.scheduleDate, a.scheduleTime)} · {a.assignedTo}
                    </p>
                    {a.status === 'Completed' && a.outcome && (
                      <p className="text-xs mt-1.5 px-3 py-1.5 rounded-lg"
                        style={{ background: '#edfbf1', color: '#1a8040', borderLeft: '3px solid #1a8040' }}>
                        {a.outcome}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Meetings */}
        {activeTab === 'Meetings' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: '#7a8494' }}>{entityMeetings.length} meetings</p>
              <button onClick={() => setShowMeetingDrawer(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#0f7a50', boxShadow: '0 2px 6px rgba(15,122,80,0.22)' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Schedule Meeting
              </button>
            </div>
            {entityMeetings.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12">
                <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>No meetings scheduled yet</p>
              </div>
            ) : entityMeetings.map((m) => {
              const modeMeta = meetingModeMeta(m.mode);
              const statusMeta = meetingStatusMeta(m.status);
              return (
                <div key={m.id} className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #dce4f2' }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-bold" style={{ color: '#0c1a3a' }}>{m.subject}</p>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: modeMeta.bg, color: modeMeta.color, border: `1px solid ${modeMeta.border}` }}>
                        <span style={{ fontSize: 10 }}>{modeMeta.icon}</span>{m.mode}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.border}` }}>
                        {m.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs mb-1.5" style={{ color: '#94a3b8' }}>
                    {formatMeetingDateTime(m.date, m.time, m.endTime)}
                    {m.location && ` · ${m.location}`}
                  </p>
                  {m.participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.participants.map((p) => (
                        <span key={p} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: '#f0f4fb', color: '#4a5d82', border: '1px solid #dce4f2' }}>{p}</span>
                      ))}
                    </div>
                  )}
                  {m.status === 'Completed' && m.outcome && (
                    <p className="text-xs mt-2 px-3 py-1.5 rounded-lg"
                      style={{ background: '#edfbf1', color: '#1a8040', borderLeft: '3px solid #1a8040' }}>
                      {m.outcome}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        {activeTab === 'Notes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: '#7a8494' }}>{notes.length} notes</p>
              <button onClick={() => setAddingNote(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#b45309', boxShadow: '0 2px 6px rgba(180,83,9,0.22)' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Note
              </button>
            </div>

            {addingNote && (
              <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #fde68a' }}>
                <textarea className="form-input resize-none w-full mb-3" rows={3} value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  autoFocus placeholder="Type your note here…" />
                <div className="flex gap-2">
                  <button onClick={() => { setAddingNote(false); setNewNote(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: '#f0f4fb', color: '#4a5d82', border: '1px solid #dce4f2' }}>
                    Cancel
                  </button>
                  <button onClick={addNote}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: '#b45309' }}>
                    Save Note
                  </button>
                </div>
              </div>
            )}

            {notes.map((n) => (
              <div key={n.id} className="rounded-xl p-4"
                style={{ background: '#fff', border: '1px solid #dce4f2', borderLeft: '3px solid #b45309' }}>
                <p className="text-sm leading-relaxed mb-2" style={{ color: '#0c1a3a' }}>{n.text}</p>
                <p className="text-xs" style={{ color: '#94a3b8' }}>By {n.by} · {formatDateSmart(n.date)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Documents */}
        {activeTab === 'Documents' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold" style={{ color: '#7a8494' }}>{entityDocs.length} document{entityDocs.length !== 1 ? 's' : ''}</p>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: '#2955a3', boxShadow: '0 2px 6px rgba(41,85,163,0.22)' }}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Document
              </button>
            </div>
            {entityDocs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#c8d8f0" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-semibold" style={{ color: '#94a3b8' }}>No documents uploaded for this entity</p>
                <p className="text-xs" style={{ color: '#c8d4e8' }}>Use "Upload Document" to attach files</p>
              </div>
            )}
            {entityDocs.map((d) => {
              const ic = docTypeMeta(d.fileType);
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: '#fff', border: '1px solid #dce4f2' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: ic.bg, color: ic.color }}>{ic.label}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#0c1a3a' }}>{d.name}</p>
                    <p className="text-xs" style={{ color: '#94a3b8' }}>{d.size} · Uploaded {formatDate(d.uploadedDate)} by {d.uploadedBy}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {[
                      { title: 'Download', path: <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />, hc: '#2955a3', hbg: '#eef3fc' },
                      { title: 'Delete', path: <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />, hc: '#c41e1e', hbg: '#fff0f0' },
                    ].map(({ title, path, hc, hbg }) => (
                      <button key={title} title={title}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: '#94a3b8' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = hc; (e.currentTarget as HTMLButtonElement).style.background = hbg; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{path}</svg>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showActivityDrawer && (
        <ActivityDrawer
          preselectedLead={entityLeads.length > 0 ? { id: entityLeads[0].id, name: entity.name, contact: entityLeads[0].contactPerson } : null}
          followUpFrom={null}
          onClose={() => setShowActivityDrawer(false)}
          onSave={(a) => { addActivity(a); setShowActivityDrawer(false); onToast?.('success', 'Activity Logged', `"${a.subject}" added to ${entity.name}.`); }}
        />
      )}
      {showMeetingDrawer && (
        <MeetingDrawer
          preselectedLead={entityLeads.length > 0 ? { id: entityLeads[0].id, name: entity.name, contact: entityLeads[0].contactPerson } : null}
          onClose={() => setShowMeetingDrawer(false)}
          onSave={(m) => { addMeeting(m); setShowMeetingDrawer(false); onToast?.('success', 'Meeting Scheduled', `"${m.subject}" added to ${entity.name}.`); }}
        />
      )}
    </div>
  );
}
