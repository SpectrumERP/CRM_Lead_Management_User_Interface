import { useMemo, useState, type ReactElement } from 'react';
import { useNotifications } from '../contexts/NotificationsContext';
import {
  NotificationCategory,
  NOTIFICATION_CATEGORY_LABELS,
  AppNotification,
} from '../data/notifications';
import { compareAlpha, Button, IconTooltip, PageHeader, StatPill, StatPillRow, CountBadge } from '../ui';
import { FilterSearch, FilterSelect, InlineFilterRow } from '../components/InlineFilterRow';
import { EmptyState, NoResults } from '../components/CRMStates';
import { formatDate } from '../utils/dateFormat';

type Tab = 'all' | 'unread';
type TimeBucket = 'today' | 'yesterday' | 'week' | 'earlier';

interface Props {
  onNavigateLead: (id: string) => void;
  onNavigateActivity: () => void;
  onNavigateMeeting: () => void;
}

/** Seed data “today” — keep filters / relative labels aligned with demo timestamps. */
const REF_TODAY = '2024-09-25';

const CATEGORY_TONE: Record<NotificationCategory, string> = {
  'overdue-task': 'bg-accent-soft text-accent',
  'task-due-today': 'bg-warning-soft text-warning',
  'follow-up-due': 'bg-warning-soft text-warning',
  'meeting-today': 'bg-primary-soft text-primary',
  'meeting-reminder': 'bg-primary-soft text-primary',
  'upcoming-task': 'bg-success-soft text-success',
  'stage-change': 'bg-purple-soft text-purple',
  'status-change': 'bg-primary-soft text-primary',
};

const TIME_BUCKET_LABEL: Record<TimeBucket, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  earlier: 'Earlier',
};

function CategoryIcon({ category }: { category: NotificationCategory }) {
  const icons: Record<NotificationCategory, ReactElement> = {
    'task-due-today': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      </svg>
    ),
    'overdue-task': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
    'upcoming-task': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    'follow-up-due': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
    'meeting-today': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    'meeting-reminder': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    'stage-change': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    'status-change': (
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  };
  return icons[category];
}

function dayOffset(dateStr: string): number {
  const [y, m, d] = REF_TODAY.split('-').map(Number);
  const [yy, mm, dd] = dateStr.split('-').map(Number);
  const ref = Date.UTC(y, m - 1, d);
  const cur = Date.UTC(yy, mm - 1, dd);
  return Math.round((ref - cur) / 86_400_000);
}

function timeBucket(dateTime: string): TimeBucket {
  const date = dateTime.slice(0, 10);
  const offset = dayOffset(date);
  if (offset <= 0) return 'today';
  if (offset === 1) return 'yesterday';
  if (offset <= 7) return 'week';
  return 'earlier';
}

function fmtWhen(dateTime: string): string {
  const [datePart, timePart = ''] = dateTime.split(' ');
  const offset = dayOffset(datePart);
  const time = timePart.replace(/^0/, '') || '';
  if (offset <= 0) return time ? `Today · ${time}` : 'Today';
  if (offset === 1) return time ? `Yesterday · ${time}` : 'Yesterday';
  const label = formatDate(datePart);
  return time ? `${label} · ${time}` : label;
}

function relatedHint(n: AppNotification): string {
  if (n.relatedMeeting) return 'Open meeting';
  if (n.relatedActivity) return 'Open activity';
  if (n.relatedLead) return 'Open lead';
  return 'View';
}

function NotificationRow({
  n,
  onMarkRead,
  onOpenRecord,
}: {
  n: AppNotification;
  onMarkRead: () => void;
  onOpenRecord: () => void;
}) {
  const urgent = n.category === 'overdue-task';
  const tone = CATEGORY_TONE[n.category];

  return (
    <article
      className={[
        'group relative flex gap-3 border-b border-line-subtle px-4 py-3.5 transition-colors sm:px-5',
        'hover:bg-surface-hover focus-within:bg-surface-hover',
        n.isRead ? 'bg-surface' : 'bg-primary-soft/40',
        urgent ? 'bg-accent-soft/50' : '',
      ].filter(Boolean).join(' ')}
    >
      {urgent ? (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" aria-hidden="true" />
      ) : !n.isRead ? (
        <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden="true" />
      ) : null}

      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}
        aria-hidden="true"
      >
        <CategoryIcon category={n.category} />
      </div>

      <button
        type="button"
        className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        onClick={() => {
          onMarkRead();
          onOpenRecord();
        }}
        aria-label={`${n.title}. ${relatedHint(n)}`}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className={`text-sm leading-snug text-ink ${n.isRead ? 'font-medium' : 'font-semibold'}`}>
            {n.title}
          </p>
          {!n.isRead ? (
            <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold tracking-wide text-surface">
              New
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{n.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
            {NOTIFICATION_CATEGORY_LABELS[n.category]}
          </span>
          {n.relatedCompany ? (
            <span className="inline-flex max-w-[14rem] items-center gap-1 truncate text-xs text-ink-soft">
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V7l6-4v18M9 11H3v10M15 21V11h6v10" />
              </svg>
              <span className="truncate">{n.relatedCompany}</span>
            </span>
          ) : null}
          <time className="text-xs text-ink-faint" dateTime={n.dateTime.replace(' ', 'T')}>
            {fmtWhen(n.dateTime)}
          </time>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-end gap-1 self-start pt-0.5 sm:flex-row sm:items-center">
        {!n.isRead ? (
          <IconTooltip label="Mark as read">
            <button
              type="button"
              aria-label="Mark as read"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead();
              }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </IconTooltip>
        ) : null}
        <IconTooltip label={relatedHint(n)}>
          <button
            type="button"
            aria-label={relatedHint(n)}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
              onOpenRecord();
            }}
          >
            Open
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </IconTooltip>
      </div>
    </article>
  );
}

export default function Notifications({ onNavigateLead, onNavigateActivity, onNavigateMeeting }: Props) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<NotificationCategory | 'all'>('all');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'older'>('all');

  const categories = (Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[]).sort(
    (left, right) => compareAlpha(NOTIFICATION_CATEGORY_LABELS[left], NOTIFICATION_CATEGORY_LABELS[right]),
  );

  const overdueCount = useMemo(
    () => notifications.filter((n) => n.category === 'overdue-task' && !n.isRead).length,
    [notifications],
  );
  const dueTodayCount = useMemo(
    () =>
      notifications.filter(
        (n) =>
          !n.isRead &&
          (n.category === 'task-due-today' ||
            n.category === 'follow-up-due' ||
            n.category === 'meeting-today'),
      ).length,
    [notifications],
  );

  function openRecord(n: AppNotification) {
    if (n.relatedMeeting) {
      onNavigateMeeting();
      return;
    }
    if (n.relatedActivity) {
      onNavigateActivity();
      return;
    }
    if (n.relatedLead) {
      onNavigateLead(n.relatedLead.id);
    }
  }

  function clearFilters() {
    setSearch('');
    setFilterCategory('all');
    setFilterDate('all');
  }

  const filtered = useMemo(() => {
    let list = tab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          (n.relatedCompany?.toLowerCase().includes(q) ?? false),
      );
    }

    if (filterCategory !== 'all') {
      list = list.filter((n) => n.category === filterCategory);
    }

    if (filterDate === 'today') {
      list = list.filter((n) => n.dateTime.startsWith(REF_TODAY));
    } else if (filterDate === 'week') {
      list = list.filter((n) => dayOffset(n.dateTime.slice(0, 10)) <= 7);
    } else if (filterDate === 'older') {
      list = list.filter((n) => dayOffset(n.dateTime.slice(0, 10)) > 7);
    }

    return list.slice().sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      const urgA = a.category === 'overdue-task' ? 0 : 1;
      const urgB = b.category === 'overdue-task' ? 0 : 1;
      if (urgA !== urgB) return urgA - urgB;
      return b.dateTime.localeCompare(a.dateTime);
    });
  }, [notifications, tab, search, filterCategory, filterDate]);

  const grouped = useMemo(() => {
    const order: TimeBucket[] = ['today', 'yesterday', 'week', 'earlier'];
    const map = new Map<TimeBucket, AppNotification[]>();
    for (const bucket of order) map.set(bucket, []);
    for (const n of filtered) {
      map.get(timeBucket(n.dateTime))!.push(n);
    }
    return order
      .map((bucket) => ({ bucket, items: map.get(bucket)! }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const hasFilters = Boolean(search) || filterCategory !== 'all' || filterDate !== 'all';

  return (
    <div className="page-gutter space-y-5 py-4">
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread · stay on top of tasks, meetings, and lead updates`
            : 'You are all caught up'
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAllAsRead}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Mark all as read
            </Button>
          ) : null
        }
      />

      <StatPillRow>
        <StatPill label="Total" value={notifications.length} tone="primary" />
        <StatPill label="Unread" value={unreadCount} tone={unreadCount > 0 ? 'warning' : 'muted'} />
        <StatPill label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'accent' : 'muted'} />
        <StatPill label="Due today" value={dueTodayCount} tone={dueTodayCount > 0 ? 'purple' : 'muted'} />
      </StatPillRow>

      <div
        className="inline-flex rounded-xl border border-line bg-surface-muted p-1"
        role="tablist"
        aria-label="Notification status"
      >
        {(
          [
            ['all', 'All', notifications.length],
            ['unread', 'Unread', unreadCount],
          ] as const
        ).map(([id, label, count]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={[
                'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active
                  ? 'bg-surface text-primary shadow-sm ring-1 ring-line'
                  : 'text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              {label}
              <CountBadge
                value={count}
                size="sm"
                tone={active ? 'primary' : 'muted'}
              />
            </button>
          );
        })}
      </div>

      <InlineFilterRow>
        <FilterSearch
          value={search}
          onChange={setSearch}
          placeholder="Search notifications…"
          aria-label="Search notifications"
        />
        <FilterSelect
          aria-label="Notification type"
          widthClass="w-44"
          value={filterCategory}
          onValueChange={(v) => setFilterCategory(v as NotificationCategory | 'all')}
          options={[
            { value: 'all', label: 'All types' },
            ...categories.map((c) => ({ value: c, label: NOTIFICATION_CATEGORY_LABELS[c] })),
          ]}
        />
        <FilterSelect
          aria-label="Notification date"
          preserveOrder
          value={filterDate}
          onValueChange={(v) => setFilterDate(v as typeof filterDate)}
          options={[
            { value: 'all', label: 'All dates' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'older', label: 'Older' },
          ]}
        />
        {hasFilters ? (
          <Button
            type="button"
            variant="secondary"
            className="!h-8 !min-h-8 shrink-0 !px-3 text-xs"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </InlineFilterRow>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {filtered.length === 0 ? (
          hasFilters ? (
            <NoResults onClear={clearFilters} />
          ) : (
            <EmptyState
              icon={
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-primary" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              }
              title={tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              subtitle={
                tab === 'unread'
                  ? 'Nice work — everything has been reviewed.'
                  : 'New tasks, meetings, and lead updates will show up here.'
              }
            />
          )
        ) : (
          grouped.map(({ bucket, items }) => (
            <section key={bucket} aria-labelledby={`notif-group-${bucket}`}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line-subtle bg-surface-muted/95 px-4 py-2.5 backdrop-blur-sm sm:px-5">
                <h2
                  id={`notif-group-${bucket}`}
                  className="text-[11px] font-bold tracking-[0.08em] text-ink-soft"
                >
                  {TIME_BUCKET_LABEL[bucket]}
                </h2>
                <CountBadge value={items.length} size="sm" tone="surface" />
              </div>
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onMarkRead={() => markAsRead(n.id)}
                  onOpenRecord={() => openRecord(n)}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
