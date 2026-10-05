import React, { useState } from 'react';
import {
  Meeting, MeetingMode, MeetingStatus,
  MEETING_MODES, MEETING_STATUSES,
  meetingModeMeta, meetingStatusMeta, formatMeetingDateTime,
} from '../data/meetings';
import MeetingDrawer from '../components/MeetingDrawer';
import ActivityDrawer from '../components/ActivityDrawer';
import OutcomeDialog from '../components/OutcomeDialog';
import { FilterSearch, FilterSelect, InlineFilterRow } from '../components/InlineFilterRow';
import { SkeletonTableRows, EmptyState, NoResults, EmptyIcons } from '../components/CRMStates';
import { ToastType } from '../components/Toast';
import { useCrmActions } from '../contexts/CrmStoreContext';
import { api } from '../api/crm';
import { useApiQuery } from '../api/useApiQuery';
import { Button, IconTooltip, PageHeader, SortChevrons, sortAlpha, StatPill, StatPillRow } from '../ui';

interface MeetingsPageProps {
  onViewLead?: (id: string) => void;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

function CompleteMeetingModal({ meeting, onConfirm, onClose }: {
  meeting: Meeting; onConfirm: (outcome: string) => void; onClose: () => void;
}) {
  return (
    <OutcomeDialog
      title="Complete Meeting"
      label="Meeting Outcome"
      placeholder="Summarise what was discussed and agreed"
      confirmLabel="Complete Meeting"
      onConfirm={onConfirm}
      onClose={onClose}
      summary={
        <>
          <p className="text-xs font-semibold text-ink-soft">{meeting.leadName}</p>
          <p className="text-sm font-bold text-ink">{meeting.subject}</p>
        </>
      }
    />
  )
}

function ModeBadge({ mode }: { mode: string }) {
  const m = meetingModeMeta(mode);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span style={{ fontSize: 11 }}>{m.icon}</span>
      {mode}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = meetingStatusMeta(status);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0" style={{ background: m.color }} />
      {status}
    </span>
  );
}

/* Detail panel — expands inline below the row */
function MeetingDetailPanel({
  meeting,
  onFollowUp,
  onCompleteMeeting,
}: {
  meeting: Meeting;
  onFollowUp: (m: Meeting) => void;
  onCompleteMeeting: (m: Meeting) => void;
}) {
  return (
    <div className="rounded-xl p-4 flex gap-6 flex-wrap mx-4 ml-9 border border-primary-soft bg-surface">

      {/* Left: Meeting details */}
      <div className="flex-1 min-w-56 space-y-3">
        <div>
          <p className="text-xs font-bold tracking-wider mb-1 text-[10px] text-ink-faint">Location / Link</p>
          <p className="text-xs text-ink-soft">{meeting.location || '—'}</p>
        </div>
        <div>
          <p className="text-xs font-bold tracking-wider mb-1.5 text-[10px] text-ink-faint">Participants</p>
          <div className="flex flex-wrap gap-1.5">
            {meeting.participants.length > 0
              ? meeting.participants.map((p) => (
                  <span key={p} className="text-xs px-2 py-0.5 rounded-full border border-line bg-surface-hover text-ink-soft">
                    {p}
                  </span>
                ))
              : <span className="text-xs text-line-strong">—</span>}
          </div>
        </div>
        {meeting.notes && (
          <div>
            <p className="text-xs font-bold tracking-wider mb-1 text-[10px] text-ink-faint">Notes / Agenda</p>
            <p className="text-xs leading-relaxed text-ink-soft">{meeting.notes}</p>
          </div>
        )}
        {meeting.hasAttachment && meeting.attachmentName && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span>{meeting.attachmentName}</span>
          </div>
        )}
      </div>

      {/* Right: Outcome + CTA */}
      <div className="flex-1 min-w-56">
        {meeting.status === 'Completed' && meeting.outcome ? (
          <div>
            <p className="text-xs font-bold tracking-wider mb-1.5 text-[10px] text-success">Outcome / Result</p>
            <p className="text-xs leading-relaxed mb-3 text-success">{meeting.outcome}</p>
            <button onClick={() => onFollowUp(meeting)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition-colors"
              style={{ background: '#0f7a50', boxShadow: '0 2px 6px rgba(15,122,80,0.25)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0a5e3e')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0f7a50')}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Create Follow-up Task
            </button>
          </div>
        ) : meeting.status === 'Scheduled' ? (
          <div className="flex flex-col items-start gap-2 pt-2">
            <p className="text-xs italic text-ink-faint">
              Mark the meeting complete once it's done.
            </p>
            <button onClick={() => onCompleteMeeting(meeting)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: '#1a8040', boxShadow: '0 2px 6px rgba(26,128,64,0.25)' }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Complete Meeting
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MeetingsPage({ onViewLead, onToast }: MeetingsPageProps) {
  const { data: meetingPage, loading } = useApiQuery(() => api.meetings.list(), []);
  const meetings = meetingPage?.items ?? [];
  const { addMeeting, addActivity, patchMeeting } = useCrmActions();
  const [showDrawer, setShowDrawer] = useState(false);
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<{ id: string; name: string; contact: string } | null>(null);
  const [followUpSubject, setFollowUpSubject] = useState('');
  const [completingMeeting, setCompletingMeeting] = useState<Meeting | null>(null);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<MeetingMode | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<MeetingStatus | 'All'>('All');
  const [dateFilter, setDateFilter] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleAddMeeting(m: Meeting) {
    addMeeting(m);
  }

  function openFollowUp(m: Meeting) {
    setFollowUpLead({ id: m.leadId, name: m.leadName, contact: m.contactPerson });
    setFollowUpSubject(`Follow-up: ${m.subject}`);
    setShowActivityDrawer(true);
  }

  // Filter + sort
  const filtered = meetings
    .filter((m) => {
      const q = search.toLowerCase();
      const matchSearch = !q
        || m.subject.toLowerCase().includes(q)
        || m.leadName.toLowerCase().includes(q)
        || m.contactPerson.toLowerCase().includes(q)
        || m.location.toLowerCase().includes(q);
      const matchMode = modeFilter === 'All' || m.mode === modeFilter;
      const matchStatus = statusFilter === 'All' || m.status === statusFilter;
      const matchDate = !dateFilter || m.date === dateFilter;
      return matchSearch && matchMode && matchStatus && matchDate;
    })
    .sort((a, b) => {
      const da = a.date + a.time;
      const db = b.date + b.time;
      return sortDir === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

  const scheduled = meetings.filter((m) => m.status === 'Scheduled').length;
  const completed = meetings.filter((m) => m.status === 'Completed').length;

  return (
    <div className="page-gutter space-y-5 py-4">
      <PageHeader
        title="Meetings"
        subtitle="All client meetings, demos and discussions"
        actions={
          <Button variant="solid" onClick={() => setShowDrawer(true)}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Schedule Meeting
          </Button>
        }
      />

      <StatPillRow>
        <StatPill label="Total" value={meetings.length} tone="primary" />
        <StatPill label="Scheduled" value={scheduled} tone="warning" />
        <StatPill label="Completed" value={completed} tone="success" />
        <StatPill label="Cancelled" value={meetings.filter((m) => m.status === 'Cancelled').length} tone="accent" />
      </StatPillRow>

      {/* Filter row */}
      <InlineFilterRow>
        <FilterSearch
          value={search}
          onChange={setSearch}
          placeholder="Search meetings, leads, locations…"
          aria-label="Search meetings"
        />
        <FilterSelect
          aria-label="Meeting mode"
          widthClass="w-36"
          value={modeFilter}
          onValueChange={(v) => setModeFilter(v as typeof modeFilter)}
          options={[
            { value: 'All', label: 'All Modes' },
            ...sortAlpha(MEETING_MODES).map((m) => ({ value: m, label: m })),
          ]}
        />
        <FilterSelect
          aria-label="Meeting status"
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'All', label: 'All Statuses' },
            ...sortAlpha(MEETING_STATUSES).map((s) => ({ value: s, label: s })),
          ]}
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="form-input h-8 w-auto shrink-0 !min-h-8 !py-0 text-xs"
          aria-label="Meeting date"
        />
        {dateFilter ? (
          <button type="button" onClick={() => setDateFilter('')} className="shrink-0 text-xs font-semibold text-primary">
            Clear date
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-soft hover:bg-surface-hover"
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          {sortDir === 'desc' ? 'Newest First' : 'Oldest First'}
        </button>
      </InlineFilterRow>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border border-line bg-surface shadow-card">
        <div className="table-scroll">
          <table className="crm-table w-full">
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th style={{ minWidth: 220 }}>Meeting Subject</th>
                <th style={{ minWidth: 180 }}>Lead / Company</th>
                <th style={{ minWidth: 130 }}>Contact Person</th>
                <th style={{ minWidth: 160, cursor: 'pointer' }}
                  onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}>
                  <span className="flex items-center justify-between gap-2">Date & Time <SortChevrons active dir={sortDir} /></span>
                </th>
                <th style={{ minWidth: 110 }}>Mode</th>
                <th style={{ minWidth: 160 }}>Location</th>
                <th style={{ minWidth: 140 }}>Participants</th>
                <th style={{ minWidth: 100 }}>Status</th>
                <th style={{ minWidth: 160 }}>Outcome</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={11} rows={5} />}
              {!loading && meetings.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty-td">
                    <EmptyState
                      icon={EmptyIcons.meetings}
                      title="No meetings scheduled"
                      subtitle="Schedule your first client meeting, demo or discussion."
                      action={{ label: 'Schedule Meeting', onClick: () => setShowDrawer(true) }}
                    />
                  </td>
                </tr>
              )}
              {!loading && meetings.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="table-empty-td">
                    <NoResults onClear={() => { setSearch(''); setModeFilter('All'); setStatusFilter('All'); setDateFilter(''); }} />
                  </td>
                </tr>
              )}
              {!loading && filtered.map((meeting) => {
                const expanded = expandedId === meeting.id;
                return (
                  <React.Fragment key={meeting.id}>
                    <tr className={expanded ? 'bg-surface-muted' : undefined}>
                      {/* Expand toggle */}
                      <td className="text-center">
                        <button
                          onClick={() => setExpandedId(expanded ? null : meeting.id)}
                          className={`flex h-5 w-5 items-center justify-center rounded text-ink-faint transition-transform ${expanded ? 'rotate-90' : ''}`}
                        >
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td>
                        <div>
                          <p className="text-xs font-semibold text-ink">{meeting.subject}</p>
                          <p className="text-xs mt-0.5 text-ink-faint">{meeting.id}</p>
                        </div>
                      </td>
                      <td>
                        <button onClick={() => meeting.leadId && onViewLead?.(meeting.leadId)}
                          className="text-xs font-semibold text-left hover:underline text-primary">
                          {meeting.leadName}
                        </button>
                        <p className="text-xs text-ink-faint">{meeting.leadId}</p>
                      </td>
                      <td className="text-xs text-ink-soft">{meeting.contactPerson || '—'}</td>
                      <td className="text-xs tabular-nums text-ink">
                        {formatMeetingDateTime(meeting.date, meeting.time, meeting.endTime)}
                      </td>
                      <td><ModeBadge mode={meeting.mode} /></td>
                      <td>
                        <p className="text-xs truncate max-w-36 text-ink-soft">
                          {meeting.location || '—'}
                        </p>
                      </td>
                      <td>
                        {meeting.participants.length > 0 ? (
                          <div className="flex items-center gap-1">
                            <div className="flex -space-x-1.5">
                              {meeting.participants.slice(0, 3).map((p, i) => (
                                <div key={i}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold border-2 border-white flex-shrink-0"
                                  style={{ background: ['#2955a3', '#7c3aed', '#0f7a50', '#b45309'][i % 4], fontSize: 8 }}
                                  title={p}>
                                  {p.charAt(0)}
                                </div>
                              ))}
                            </div>
                            {meeting.participants.length > 3 && (
                              <span className="text-xs text-ink-faint">
                                +{meeting.participants.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-line">—</span>
                        )}
                      </td>
                      <td><StatusBadge status={meeting.status} /></td>
                      <td>
                        {meeting.status === 'Completed' && meeting.outcome ? (
                          <p className="text-xs line-clamp-2 text-success">
                            {meeting.outcome}
                          </p>
                        ) : (
                          <span className="text-[11px] text-line-strong">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {meeting.status === 'Scheduled' && (
                            <IconTooltip label="Complete Meeting">
                              <button type="button" onClick={() => setCompletingMeeting(meeting)}
                                aria-label="Complete Meeting"
                                className="w-6 h-6 rounded flex items-center justify-center transition-colors text-success"
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#edfbf1')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </button>
                            </IconTooltip>
                          )}
                          {meeting.status === 'Completed' && (
                            <IconTooltip label="Create Follow-up Task">
                              <button type="button" onClick={() => openFollowUp(meeting)}
                                aria-label="Create Follow-up Task"
                                className="w-6 h-6 rounded flex items-center justify-center transition-colors text-success-strong"
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#edfbf1')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            </IconTooltip>
                          )}
                          <IconTooltip label="View Details">
                            <button type="button" onClick={() => setExpandedId(expanded ? null : meeting.id)}
                              aria-label="View Details"
                              className="w-6 h-6 rounded flex items-center justify-center transition-colors text-ink-soft"
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4fb')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </IconTooltip>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded detail row */}
                    {expanded && (
                      <tr className='bg-surface-muted'>
                        <td />
                        <td colSpan={10} className="pb-4 pt-1">
                          <MeetingDetailPanel meeting={meeting} onFollowUp={openFollowUp} onCompleteMeeting={(m) => setCompletingMeeting(m)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between border-t border-line-subtle">
            <p className="text-xs text-ink-faint">
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of{' '}
              <span className="font-semibold text-ink">{meetings.length}</span> meetings
            </p>
          </div>
        )}
      </div>

      {/* Schedule Meeting drawer */}
      {showDrawer && (
        <MeetingDrawer
          preselectedLead={null}
          onClose={() => setShowDrawer(false)}
          onSave={(m) => { handleAddMeeting(m); setShowDrawer(false); }}
        />
      )}

      {/* Follow-up Activity drawer */}
      {showActivityDrawer && followUpLead && (
        <ActivityDrawer
          preselectedLead={followUpLead}
          followUpFrom={null}
          onClose={() => { setShowActivityDrawer(false); setFollowUpLead(null); setFollowUpSubject(''); }}
          onSave={(a) => { addActivity(a); onToast?.('success', 'Follow-up Task Created', `"${a.subject}" has been added.`); setShowActivityDrawer(false); setFollowUpLead(null); setFollowUpSubject(''); }}
        />
      )}
      {completingMeeting && (
        <CompleteMeetingModal
          meeting={completingMeeting}
          onConfirm={(outcome) => {
            patchMeeting(completingMeeting.id, { status: 'Completed', outcome });
            onToast?.('success', 'Meeting Completed', `"${completingMeeting.subject}" has been marked complete.`);
            setCompletingMeeting(null);
          }}
          onClose={() => setCompletingMeeting(null)}
        />
      )}
    </div>
  );
}
