import { useState } from 'react';
import { Contact, contactStatusMeta, initialsAvatar, avatarGradient } from '../data/contacts';
import { Activity, activityTypeMeta, activityStatusMeta, formatDateTime } from '../data/activities';
import { Meeting, meetingModeMeta, meetingStatusMeta, formatMeetingDateTime } from '../data/meetings';
import { Lead, normalizeOrgName } from '../data/leads';
import { CRMDocument, docTypeMeta } from '../data/documents';
import ActivityDrawer from '../components/ActivityDrawer';
import MeetingDrawer from '../components/MeetingDrawer';
import { ToastType } from '../components/Toast';
import { useCrmActions, useCrmSelector } from '../contexts/CrmStoreContext';
import { CountBadge } from '../ui';

type Tab = 'overview' | 'leads' | 'activities' | 'meetings' | 'documents';

interface Props {
  contactId: string;
  onBack: () => void;
  onEdit: (id: string) => void;
  onViewLead?: (id: string) => void;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

export default function ContactDetail({ contactId, onBack, onEdit, onViewLead, onToast }: Props) {
  const contact = useCrmSelector((state) => state.contacts.find((item) => item.id === contactId));
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
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [showMeetingDrawer, setShowMeetingDrawer] = useState(false);

  if (!contact) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: '#7a8494' }}>Contact not found.</p>
        <button type="button" onClick={onBack} className="mt-3 text-sm font-semibold" style={{ color: '#2955a3' }}>Back to list</button>
      </div>
    );
  }

  const entityName = contact.businessEntityName;
  const contactLeads = leads.filter((l) =>
    l.contactPerson === contact.name
    || normalizeOrgName(l.companyName) === normalizeOrgName(entityName),
  );
  const contactActivities = activities.filter((a) => a.leadName === entityName || a.contactPerson === contact.name);
  const contactMeetings = meetings.filter((m) => m.leadName === entityName || m.contactPerson === contact.name);
  const entityLeadIds = contactLeads.map((l) => l.id);
  const contactDocs = documents.filter(
    (d) =>
      (d.relatedId === contact.businessEntityId && d.relatedType === 'entity') ||
      (d.relatedType === 'lead' && entityLeadIds.includes(d.relatedId)),
  );

  const sMeta = contactStatusMeta(contact.status);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'leads', label: 'Leads', count: contactLeads.length },
    { id: 'activities', label: 'Activities', count: contactActivities.length },
    { id: 'meetings', label: 'Meetings', count: contactMeetings.length },
    { id: 'documents', label: 'Documents', count: contactDocs.length },
  ];

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {/* ── Header ── */}
      <div className="page-gutter flex-shrink-0 py-5" style={{ background: '#fff', borderBottom: '1px solid #dce4f2' }}>
        <div className="flex items-start gap-4">
          {/* Back */}
          <button
            onClick={onBack}
            className="mt-1 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ border: '1px solid #dce4f2', color: '#7a8494' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fb')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Avatar */}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: avatarGradient(contact.name) }}
          >
            {initialsAvatar(contact.name)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>{contact.name}</h1>
              {contact.isPrimary && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                  <svg width="9" height="9" fill="currentColor" viewBox="0 0 24 24"><path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  Primary Contact
                </span>
              )}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: sMeta.bg, color: sMeta.color, border: `1px solid ${sMeta.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sMeta.color }} />
                {contact.status}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: '#374151' }}>{contact.designation}</p>
            <div className="flex items-center gap-4 mt-1.5 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: '#2955a3' }}>{contact.businessEntityName}</span>
              <span className="text-xs" style={{ color: '#9aaccc' }}>·</span>
              <span className="text-xs" style={{ color: '#7a8494' }}>{contact.department}</span>
              <span className="text-xs" style={{ color: '#9aaccc' }}>·</span>
              <span className="text-xs" style={{ color: '#7a8494' }}>{contact.locationLabel}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <a href={`tel:${contact.mobile}`} className="text-xs flex items-center gap-1 hover:underline" style={{ color: '#7a8494' }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                {contact.mobile}
              </a>
              <a href={`mailto:${contact.email}`} className="text-xs flex items-center gap-1 hover:underline" style={{ color: '#7a8494' }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {contact.email}
              </a>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <QuickBtn label="Call" color="#2955a3" bg="#eef2fb" onClick={() => {}}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            </QuickBtn>
            <QuickBtn label="Email" color="#6d28d9" bg="#f5f3ff" onClick={() => {}}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </QuickBtn>
            <QuickBtn label="Edit" color="#0f7a50" bg="#edfbf1" onClick={() => onEdit(contact.id)}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </QuickBtn>
            <QuickBtn label="Add Activity" color="#b45309" bg="#fffbeb" onClick={() => setShowActivityDrawer(true)}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </QuickBtn>
            <QuickBtn label="Add Meeting" color="#c41e1e" bg="#fff5f5" onClick={() => setShowMeetingDrawer(true)}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </QuickBtn>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-5 border-b" style={{ borderColor: '#dce4f2', marginBottom: -1 }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors relative"
              style={
                activeTab === t.id
                  ? { color: '#2955a3', borderBottom: '2px solid #2955a3', marginBottom: -1 }
                  : { color: '#7a8494' }
              }
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <CountBadge
                  value={t.count}
                  size="sm"
                  tone={activeTab === t.id ? 'primary-soft' : 'muted'}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="page-gutter flex-1 py-4">
        {activeTab === 'overview' && <OverviewTab contact={contact} />}
        {activeTab === 'leads' && <LeadsTab leads={contactLeads} onViewLead={onViewLead} />}
        {activeTab === 'activities' && <ActivitiesTab activities={contactActivities} onAdd={() => setShowActivityDrawer(true)} />}
        {activeTab === 'meetings' && <MeetingsTab meetings={contactMeetings} onAdd={() => setShowMeetingDrawer(true)} />}
        {activeTab === 'documents' && <DocumentsTab docs={contactDocs} />}
      </div>

      {/* Drawers */}
      {showActivityDrawer && (
        <ActivityDrawer
          preselectedLead={contactLeads.length > 0 ? { id: contactLeads[0].id, name: entityName, contact: contact.name } : null}
          followUpFrom={null}
          onClose={() => setShowActivityDrawer(false)}
          onSave={(a) => { addActivity(a); setShowActivityDrawer(false); setActiveTab('activities'); onToast?.('success', 'Activity Logged', `"${a.subject}" added.`); }}
        />
      )}
      {showMeetingDrawer && (
        <MeetingDrawer
          preselectedLead={contactLeads.length > 0 ? { id: contactLeads[0].id, name: entityName, contact: contact.name } : null}
          onClose={() => setShowMeetingDrawer(false)}
          onSave={(m) => { addMeeting(m); setShowMeetingDrawer(false); setActiveTab('meetings'); onToast?.('success', 'Meeting Scheduled', `"${m.subject}" added.`); }}
        />
      )}
    </div>
  );
}

/* ── Quick action button ── */
function QuickBtn({ children, label, color, bg, onClick }: { children: React.ReactNode; label: string; color: string; bg: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{ background: bg, color, border: `1px solid ${color}22` }}
      onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.95)')}
      onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
    >
      {children} {label}
    </button>
  );
}

/* ── Overview Tab ── */
function OverviewTab({ contact }: { contact: Contact }) {
  const { leads, activities, meetings } = useCrmSelector(
    (state) => ({
      leads: state.leads,
      activities: state.activities,
      meetings: state.meetings,
    }),
    (left, right) =>
      left.leads === right.leads &&
      left.activities === right.activities &&
      left.meetings === right.meetings,
  );
  const entity = contact.businessEntityName;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Left col */}
      <div className="lg:col-span-2 space-y-5">
        {/* Contact details card */}
        <div className="rounded-xl p-5 space-y-4" style={{ background: '#fff', border: '1px solid #dce4f2' }}>
          <h3 className="text-sm font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>Contact Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Full Name', value: contact.name },
              { label: 'Business Entity', value: entity },
              { label: 'Designation', value: contact.designation || '—' },
              { label: 'Department', value: contact.department || '—' },
              { label: 'Mobile', value: contact.mobile || '—' },
              { label: 'Email', value: contact.email || '—' },
              { label: 'Location / Plant', value: contact.locationLabel || '—' },
              { label: 'Primary Contact', value: contact.isPrimary ? 'Yes' : 'No' },
              { label: 'Status', value: contact.status },
              { label: 'Created Date', value: new Date(contact.createdDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
              { label: 'Last Activity', value: contact.lastActivity },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: '#9aaccc' }}>{label}</p>
                <p className="text-sm" style={{ color: '#374151' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Remarks */}
        {contact.remarks && (
          <div className="rounded-xl p-5" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div className="flex items-start gap-2">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#b45309" strokeWidth={2} className="mt-0.5 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-bold mb-1" style={{ color: '#b45309' }}>Notes & Remarks</p>
                <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{contact.remarks}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right col */}
      <div className="space-y-4">
        {/* Stats */}
        {[
          { label: 'Active Leads', value: leads.filter((l) => l.companyName === entity && l.leadStatus === 'Open').length, color: '#2955a3', bg: '#eef2fb' },
          { label: 'Activities', value: activities.filter((a) => a.leadName === entity).length, color: '#b45309', bg: '#fffbeb' },
          { label: 'Meetings', value: meetings.filter((m) => m.leadName === entity).length, color: '#6d28d9', bg: '#f5f3ff' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-0.5" style={{ color: '#7a8494' }}>{s.label}</p>
          </div>
        ))}

        {/* Entity quick info */}
        <div className="rounded-xl p-4" style={{ background: '#fff', border: '1px solid #dce4f2' }}>
          <p className="text-xs font-bold mb-2" style={{ color: '#9aaccc' }}>BUSINESS ENTITY</p>
          <p className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>{entity}</p>
          <p className="text-xs mt-0.5" style={{ color: '#9aaccc' }}>{contact.businessEntityId}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Leads Tab ── */
function LeadsTab({ leads, onViewLead }: { leads: Lead[]; onViewLead?: (id: string) => void }) {
  if (leads.length === 0) return <EmptyState message="No leads linked to this contact's business entity." />;
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #dce4f2' }}>
      <table className="crm-table">
        <thead>
          <tr>
            <th>Lead ID</th>
            <th>Subject</th>
            <th>Stage</th>
            <th>Status</th>
            <th>Value</th>
            <th>Closure Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="hover:bg-blue-50/40 transition-colors">
              <td><span className="text-xs font-mono" style={{ color: '#7a8494' }}>{l.id}</span></td>
              <td><span className="text-sm font-medium" style={{ color: '#0c1a3a' }}>{l.companyName}</span></td>
              <td>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#eef2fb', color: '#2955a3', border: '1px solid #c7d6f0' }}>
                  {l.leadStage}
                </span>
              </td>
              <td>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: l.leadStatus === 'Open' ? '#edfbf1' : '#f1f5f9', color: l.leadStatus === 'Open' ? '#1a8040' : '#64748b', border: `1px solid ${l.leadStatus === 'Open' ? '#bbf0cf' : '#cbd5e1'}` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.leadStatus === 'Open' ? '#1a8040' : '#64748b' }} />
                  {l.leadStatus}
                </span>
              </td>
              <td><span className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>₹{(l.opportunityValue / 10000000).toFixed(2)} Cr</span></td>
              <td><span className="text-sm" style={{ color: '#7a8494' }}>{l.expectedClosureDate}</span></td>
              <td>
                <button
                  onClick={() => onViewLead?.(l.id)}
                  className="text-xs px-3 py-1 rounded-lg font-semibold transition-colors"
                  style={{ color: '#2955a3', background: '#eef2fb', border: '1px solid #c7d6f0' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#dce9fb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#eef2fb')}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Activities Tab ── */
function ActivitiesTab({ activities, onAdd }: { activities: Activity[]; onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: '#0c1a3a' }}>Activities ({activities.length})</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#2955a3,#1a3d7c)' }}
        >
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Activity
        </button>
      </div>
      {activities.length === 0 && <EmptyState message="No activities recorded for this contact." />}
      {activities.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #dce4f2' }}>
          <table className="crm-table">
            <thead>
              <tr><th>Type</th><th>Subject</th><th>Assigned To</th><th>Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              {activities.map((a) => {
                const tMeta = activityTypeMeta(a.type);
                const sMeta = activityStatusMeta(a.status);
                return (
                  <tr key={a.id} className="hover:bg-blue-50/40 transition-colors">
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: tMeta.bg, color: tMeta.color, border: `1px solid ${tMeta.border}` }}>
                        {a.type}
                      </span>
                    </td>
                    <td><span className="text-sm" style={{ color: '#0c1a3a' }}>{a.subject}</span></td>
                    <td><span className="text-sm" style={{ color: '#7a8494' }}>{a.assignedTo}</span></td>
                    <td><span className="text-sm" style={{ color: '#7a8494' }}>{formatDateTime(a.scheduleDate, a.scheduleTime)}</span></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: sMeta.bg, color: sMeta.color, border: `1px solid ${sMeta.border}` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sMeta.color }} />
                        {a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Meetings Tab ── */
function MeetingsTab({ meetings, onAdd }: { meetings: Meeting[]; onAdd: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: '#0c1a3a' }}>Meetings ({meetings.length})</h3>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#2955a3,#1a3d7c)' }}
        >
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Schedule Meeting
        </button>
      </div>
      {meetings.length === 0 && <EmptyState message="No meetings scheduled for this contact." />}
      {meetings.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #dce4f2' }}>
          <table className="crm-table">
            <thead>
              <tr><th>Subject</th><th>Mode</th><th>Date & Time</th><th>Status</th><th>Location</th></tr>
            </thead>
            <tbody>
              {meetings.map((m) => {
                const mMeta = meetingModeMeta(m.mode);
                const sMeta = meetingStatusMeta(m.status);
                return (
                  <tr key={m.id} className="hover:bg-blue-50/40 transition-colors">
                    <td><span className="text-sm font-medium" style={{ color: '#0c1a3a' }}>{m.subject}</span></td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: mMeta.bg, color: mMeta.color, border: `1px solid ${mMeta.border}` }}>
                        {mMeta.icon} {m.mode}
                      </span>
                    </td>
                    <td><span className="text-sm" style={{ color: '#7a8494' }}>{formatMeetingDateTime(m.date, m.time, m.endTime)}</span></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: sMeta.bg, color: sMeta.color, border: `1px solid ${sMeta.border}` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sMeta.color }} />
                        {m.status}
                      </span>
                    </td>
                    <td><span className="text-sm" style={{ color: '#7a8494' }}>{m.location}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Documents Tab ── */
function DocumentsTab({ docs }: { docs: CRMDocument[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: '#0c1a3a' }}>Documents ({docs.length})</h3>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'linear-gradient(135deg,#2955a3,#1a3d7c)' }}
        >
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Upload
        </button>
      </div>
      {docs.length === 0 ? (
        <EmptyState message="No documents linked to this contact's entity or leads." />
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => {
            const ic = docTypeMeta(doc.fileType);
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                style={{ background: '#fff', border: '1px solid #dce4f2' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f8ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: ic.bg, color: ic.color }}
                >
                  {ic.label}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#0c1a3a' }}>{doc.name}</p>
                  <p className="text-xs" style={{ color: '#9aaccc' }}>{doc.size} · {doc.uploadedDate} · {doc.uploadedBy}</p>
                </div>
                <button
                  className="text-xs px-3 py-1 rounded-lg"
                  style={{ color: '#2955a3', background: '#eef2fb', border: '1px solid #c7d6f0' }}
                >
                  Download
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full mb-3 flex items-center justify-center" style={{ background: '#f0f4fb' }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9aaccc" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <p className="text-sm" style={{ color: '#9aaccc' }}>{message}</p>
    </div>
  );
}
