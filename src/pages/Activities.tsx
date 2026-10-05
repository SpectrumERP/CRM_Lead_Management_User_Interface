import React, { useState } from 'react';
import {
  Activity, ActivityType, ActivityStatus,
  ACTIVITY_STATUSES,
  activityTypeMeta, activityStatusMeta, formatDateTime,
} from '../data/activities';
import { useMasterData } from '../contexts/MasterDataContext';
import { useCrmActions } from '../contexts/CrmStoreContext';
import { api } from '../api/crm';
import { useApiQuery } from '../api/useApiQuery';
import ActivityDrawer from '../components/ActivityDrawer';
import OutcomeDialog from '../components/OutcomeDialog';
import { FilterSearch, FilterSelect, InlineFilterRow } from '../components/InlineFilterRow';
import { SkeletonTableRows, EmptyState, NoResults, EmptyIcons } from '../components/CRMStates';
import { ToastType } from '../components/Toast';
import { Button, IconTooltip, PageHeader, SortChevrons, sortAlpha, StatPill, StatPillRow } from '../ui';
import { matchesAny } from '../utils/text';
import { toIsoDate, toTimeHHMM } from '../utils/dateFormat';

interface ActivitiesPageProps {
  onViewLead?: (id: string) => void;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

function MarkCompleteModal({ activity, onConfirm, onClose }: {
  activity: Activity; onConfirm: (outcome: string) => void; onClose: () => void;
}) {
  return (
    <OutcomeDialog
      title="Mark Activity Complete"
      label="Outcome / Result"
      placeholder="What was the result of this activity?"
      confirmLabel="Mark Complete"
      onConfirm={onConfirm}
      onClose={onClose}
      summary={
        <>
          <p className="text-xs font-semibold text-ink-soft">{activity.type}</p>
          <p className="text-sm font-bold text-ink">{activity.subject}</p>
        </>
      }
    />
  )
}

function TypeBadge({ type }: { type: string }) {
  const m = activityTypeMeta(type);
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = activityStatusMeta(status);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0" style={{ background: m.color }} />
      {status}
    </span>
  );
}

export default function ActivitiesPage({ onViewLead, onToast }: ActivitiesPageProps) {
  const { activeActivityTypeNames } = useMasterData();
  const { data: activityPage, loading } = useApiQuery(() => api.activities.list(), []);
  const activities = activityPage?.items ?? [];
  const { addActivity, patchActivity } = useCrmActions();
  const [showDrawer, setShowDrawer] = useState(false);
  const [followUpFrom, setFollowUpFrom] = useState<Activity | null>(null);
  const [completingActivity, setCompletingActivity] = useState<Activity | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | 'All'>('All');
  const [dateFilter, setDateFilter] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleAddActivity(a: Activity) {
    addActivity(a);
    setFollowUpFrom(null);
  }

  function openFollowUp(a: Activity) {
    setFollowUpFrom(a);
    setShowDrawer(true);
  }

  function closeDrawer() {
    setShowDrawer(false);
    setFollowUpFrom(null);
  }

  // Filter + sort
  const filtered = activities
    .filter((a) => {
      const matchSearch = matchesAny(
        [a.subject, a.leadName, a.contactPerson, a.assignedTo],
        search,
      );
      const matchType = typeFilter === 'All' || a.type === typeFilter;
      const matchStatus = statusFilter === 'All' || a.status === statusFilter;
      const matchDate = !dateFilter || a.scheduleDate === dateFilter;
      return matchSearch && matchType && matchStatus && matchDate;
    })
    .sort((a, b) => {
      const da = a.scheduleDate + a.scheduleTime;
      const db = b.scheduleDate + b.scheduleTime;
      return sortDir === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

  const pending = activities.filter((a) => a.status === 'Pending').length;
  const completed = activities.filter((a) => a.status === 'Completed').length;

  return (
    <div className="page-gutter space-y-5 py-4">
      <PageHeader
        title="Activities"
        subtitle="All sales activities, tasks and follow-ups"
        actions={
          <Button variant="solid" onClick={() => setShowDrawer(true)}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Activity
          </Button>
        }
      />

      <StatPillRow>
        <StatPill label="Total" value={activities.length} tone="primary" />
        <StatPill label="Pending" value={pending} tone="warning" />
        <StatPill label="Completed" value={completed} tone="success" />
        <StatPill label="Cancelled" value={activities.filter((a) => a.status === 'Cancelled').length} tone="accent" />
      </StatPillRow>

      {/* Filters row */}
      <InlineFilterRow>
        <FilterSearch
          value={search}
          onChange={setSearch}
          placeholder="Search activities, leads, contacts…"
          aria-label="Search activities"
        />
        <FilterSelect
          aria-label="Activity type"
          widthClass="w-40"
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
          options={[
            { value: 'All', label: 'All Types' },
            ...sortAlpha(activeActivityTypeNames).map((t) => ({ value: t, label: t })),
          ]}
        />
        <FilterSelect
          aria-label="Activity status"
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'All', label: 'All Statuses' },
            ...sortAlpha(ACTIVITY_STATUSES).map((s) => ({ value: s, label: s })),
          ]}
        />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="form-input h-8 w-auto shrink-0 !min-h-8 !py-0 text-xs"
          aria-label="Schedule date"
        />
        {dateFilter ? (
          <button type="button" onClick={() => setDateFilter('')} className="shrink-0 text-xs font-semibold text-primary hover:underline">
            Clear date
          </button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="!h-8 !min-h-8 shrink-0 !px-3 text-xs"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        >
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          {sortDir === 'desc' ? 'Newest First' : 'Oldest First'}
        </Button>
      </InlineFilterRow>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="table-scroll">
          <table className="crm-table w-full">
            <thead>
              <tr>
                <th style={{ minWidth: 36, width: 36 }} />
                <th>Activity Type</th>
                <th style={{ minWidth: 220 }}>Subject</th>
                <th style={{ minWidth: 180 }}>Lead</th>
                <th style={{ minWidth: 130 }}>Contact Person</th>
                <th style={{ minWidth: 120 }}>Assigned To</th>
                <th
                  style={{ minWidth: 140, cursor: 'pointer' }}
                  onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}>
                  <span className="flex items-center justify-between gap-2">Schedule Date <SortChevrons active dir={sortDir} /></span>
                </th>
                <th style={{ minWidth: 120 }}>Reminder</th>
                <th style={{ minWidth: 100 }}>Status</th>
                <th style={{ minWidth: 160 }}>Outcome / Complete</th>
                <th style={{ minWidth: 100 }}>Attachment</th>
                <th style={{ width: 80 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows cols={12} rows={6} />}
              {!loading && activities.length === 0 && (
                <tr>
                  <td colSpan={12} className="table-empty-td">
                    <EmptyState
                      icon={EmptyIcons.activities}
                      title="No activities found"
                      subtitle="Log your first call, email or task to start tracking sales activity."
                      action={{ label: 'Add Activity', onClick: () => setShowDrawer(true) }}
                    />
                  </td>
                </tr>
              )}
              {!loading && activities.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="table-empty-td">
                    <NoResults onClear={() => { setSearch(''); setTypeFilter('All'); setStatusFilter('All'); setDateFilter(''); }} />
                  </td>
                </tr>
              )}
              {!loading && filtered.map((activity) => {
                const expanded = expandedId === activity.id;
                return (
                  <React.Fragment key={activity.id}>
                    <tr className={expanded ? 'bg-surface-muted' : undefined}>
                      {/* Expand toggle */}
                      <td className="text-center">
                        <button
                          onClick={() => setExpandedId(expanded ? null : activity.id)}
                          className={`flex h-5 w-5 items-center justify-center rounded text-ink-faint transition-transform ${expanded ? 'rotate-90' : ''}`}
                        >
                          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td><TypeBadge type={activity.type} /></td>
                      <td>
                        <div>
                          <p className="text-xs font-semibold text-ink">{activity.subject}</p>
                          <p className="text-xs mt-0.5 text-ink-faint">{activity.id}</p>
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => activity.leadId && onViewLead?.(activity.leadId)}
                          className="text-xs font-semibold text-left hover:underline font-display text-primary">
                          {activity.leadName}
                        </button>
                        <p className="text-xs text-ink-faint">{activity.leadId}</p>
                      </td>
                      <td className="text-xs text-ink-soft">{activity.contactPerson || '—'}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 h-6 w-6 bg-primary text-[8px] text-surface">
                            {activity.assignedTo.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="text-xs text-ink">{activity.assignedTo}</span>
                        </div>
                      </td>
                      <td className="text-xs tabular-nums text-ink">
                        {formatDateTime(activity.scheduleDate, activity.scheduleTime)}
                      </td>
                      <td className="text-xs text-ink-muted">{activity.reminder !== 'None' ? activity.reminder : '—'}</td>
                      <td><StatusBadge status={activity.status} /></td>
                      <td>
                        {activity.status === 'Completed' ? (
                          <div>
                            <p className="text-xs font-semibold text-success">
                              {formatDateTime(activity.completeDate, activity.completeTime)}
                            </p>
                            {activity.outcome && (
                              <p className="text-xs mt-0.5 line-clamp-1 text-ink-soft">
                                {activity.outcome}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-line-strong">—</span>
                        )}
                      </td>
                      <td>
                        {activity.hasAttachment && activity.attachmentName ? (
                          <div className="flex items-center gap-1 text-xs text-ink-soft">
                            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="truncate max-w-20">{activity.attachmentName}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-line">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {/* Mark Complete for pending */}
                          {activity.status === 'Pending' && (
                            <IconTooltip label="Mark Complete">
                              <button
                                type="button"
                                onClick={() => setCompletingActivity(activity)}
                                aria-label="Mark Complete"
                                className="w-6 h-6 rounded flex items-center justify-center transition-colors text-success"
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#edfbf1')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              </button>
                            </IconTooltip>
                          )}
                          {activity.status === 'Completed' && (
                            <IconTooltip label="Create Follow-up Task">
                              <button
                                type="button"
                                onClick={() => openFollowUp(activity)}
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
                            <button
                              type="button"
                              aria-label="View Details"
                              onClick={() => setExpandedId(expanded ? null : activity.id)}
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
                        <td colSpan={11} className="pb-4 pt-1">
                          <div className="rounded-xl p-4 flex gap-6 mr-4 border border-primary-soft bg-surface">
                            {/* Notes */}
                            <div className="flex-1">
                              <p className="text-xs font-bold mb-1.5 tracking-wider text-[10px] text-ink-faint">Notes / Agenda</p>
                              <p className="text-xs leading-relaxed text-ink-soft">
                                {activity.notes || <span className="text-line-strong">No notes added</span>}
                              </p>
                            </div>
                            {/* Outcome */}
                            {activity.status === 'Completed' && (
                              <div className="flex-1">
                                <p className="text-xs font-bold mb-1.5 tracking-wider text-[10px] text-success">Outcome / Result</p>
                                <p className="text-xs leading-relaxed text-success">
                                  {activity.outcome}
                                </p>
                              </div>
                            )}
                            {/* Action CTAs */}
                            <div className="flex items-start flex-col gap-2">
                              {activity.status === 'Pending' && (
                                <button
                                  onClick={() => setCompletingActivity(activity)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white inline-flex whitespace-nowrap bg-success py-1.5 text-surface hover:bg-success-strong">
                                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  Mark Complete
                                </button>
                              )}
                              {activity.status === 'Completed' && (
                                <button
                                  onClick={() => openFollowUp(activity)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white inline-flex whitespace-nowrap bg-success-strong py-1.5 text-surface hover:bg-success">
                                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Create Follow-up Task
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 flex items-center justify-between border-t border-line-subtle">
            <p className="text-xs text-ink-faint">
              Showing <span className="font-semibold text-ink">{filtered.length}</span> of <span className="font-semibold text-ink">{activities.length}</span> activities
            </p>
          </div>
        )}
      </div>

      {/* Activity Drawer */}
      {showDrawer && (
        <ActivityDrawer
          preselectedLead={null}
          followUpFrom={followUpFrom}
          onClose={closeDrawer}
          onSave={handleAddActivity}
        />
      )}
      {completingActivity && (
        <MarkCompleteModal
          activity={completingActivity}
          onConfirm={(outcome) => {
            const now = new Date();
            patchActivity(completingActivity.id, {
              status: 'Completed',
              outcome,
              completeDate: toIsoDate(now),
              completeTime: toTimeHHMM(now),
            });
            onToast?.('success', 'Activity Completed', `"${completingActivity.subject}" marked as complete.`);
            setCompletingActivity(null);
          }}
          onClose={() => setCompletingActivity(null)}
        />
      )}
    </div>
  );
}
