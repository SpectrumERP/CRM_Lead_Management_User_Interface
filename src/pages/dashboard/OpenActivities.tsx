import { useMemo } from 'react'
import type { Activity } from '../../data/activities'
import { formatDate } from '../../utils/dateFormat'
import { DashboardTable, type DashboardColumn } from './DashboardTable'
import { DueDate, Pill, RecordLink, SectionEmpty } from './parts'

interface OpenActivitiesProps {
  activities: readonly Activity[]
  todayIso: string
  /** Master sequence of the activity's lead / opportunity stage (default order). */
  sequenceOf: (activity: Activity) => number | undefined
  onOpenActivity: (activity: Activity) => void
  onOpenLead: (id: string) => void
  onOpenOpportunity: (id: string) => void
}

const isOpportunity = (a: Activity) => Boolean(a.opportunityId)

export function OpenActivitiesTable({ activities, todayIso, sequenceOf, onOpenActivity, onOpenLead, onOpenOpportunity }: OpenActivitiesProps) {
  const columns = useMemo<DashboardColumn<Activity>[]>(
    () => [
      {
        key: 'date',
        label: 'Activity Date',
        render: (a) => <DueDate date={a.scheduleDate} todayIso={todayIso} />,
        sortValue: (a) => a.scheduleDate,
        // Both the shown date (03 Oct 2026) and the ISO one match.
        searchText: (a) => (a.scheduleDate ? `${formatDate(a.scheduleDate)} ${a.scheduleDate}` : ''),
      },
      { key: 'type', label: 'Activity Type', render: (a) => a.type, sortValue: (a) => a.type, searchText: (a) => a.type },
      {
        key: 'subject',
        label: 'Subject',
        render: (a) => (
          <span className="block max-w-[18rem] truncate" title={a.subject}>
            {a.subject || '—'}
          </span>
        ),
        sortValue: (a) => a.subject,
        searchText: (a) => a.subject,
      },
      {
        key: 'record',
        label: 'Lead/ Opportunity Name',
        render: (a) => (
          <span className="inline-flex items-center gap-1.5">
            <Pill className={isOpportunity(a) ? 'bg-teal-soft text-teal' : 'bg-primary-soft text-primary'}>
              {isOpportunity(a) ? 'Opp' : 'Lead'}
            </Pill>
            <RecordLink
              label={a.leadName}
              onClick={() => (isOpportunity(a) ? onOpenOpportunity(a.opportunityId!) : onOpenLead(a.leadId))}
            />
          </span>
        ),
        sortValue: (a) => a.leadName,
        searchText: (a) => a.leadName,
      },
      {
        key: 'status',
        label: 'Status',
        render: (a) =>
          a.scheduleDate && a.scheduleDate < todayIso ? (
            <Pill className="bg-accent-soft text-accent">Overdue</Pill>
          ) : (
            <Pill className="bg-primary-soft text-primary">Open</Pill>
          ),
        sortValue: (a) => (a.scheduleDate && a.scheduleDate < todayIso ? 'Overdue' : 'Open'),
        searchText: (a) => (a.scheduleDate && a.scheduleDate < todayIso ? 'Overdue Open' : 'Open'),
      },
    ],
    [todayIso, onOpenLead, onOpenOpportunity],
  )

  return (
    <DashboardTable
      label="Open activities"
      rows={activities}
      columns={columns}
      rowKey={(a) => a.id}
      defaultOrder={(a, b) =>
        (sequenceOf(a) ?? Infinity) - (sequenceOf(b) ?? Infinity) || a.scheduleDate.localeCompare(b.scheduleDate)
      }
      searchable
      searchPlaceholder="Search activities…"
      onRowClick={onOpenActivity}
      rowLabel={(a) => `Open activity ${a.subject}`}
      empty={<SectionEmpty title="No activities found" subtitle="Open activities on your leads and opportunities show here." />}
    />
  )
}
