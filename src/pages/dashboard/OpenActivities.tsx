import { useMemo } from 'react'
import { isoDay, type DashboardOpenActivity } from '../../api/dashboard'
import { formatDate } from '../../utils/dateFormat'
import { DashboardTable, type DashboardColumn } from './DashboardTable'
import { DueDate, Pill, RecordLink, SectionEmpty } from './parts'

interface OpenActivitiesProps {
  activities: readonly DashboardOpenActivity[]
  todayIso: string
  onOpenActivity: (activity: DashboardOpenActivity) => void
  onOpenLead: (leadNo: number) => void
  onOpenOpportunity: (opportunityNo: number) => void
}

export const isOpportunityActivity = (a: DashboardOpenActivity) =>
  Boolean(a.opportunityNo) || (a.recordType ?? '').toLowerCase().startsWith('opp')

const recordName = (a: DashboardOpenActivity) => a.recordName || a.recordCode || ''

/** Server overdue flag; falls back to the due date. */
const overdue = (a: DashboardOpenActivity, todayIso: string) => a.isOverdue || (!!a.dueDate && isoDay(a.dueDate) < todayIso)

export function OpenActivitiesTable({ activities, todayIso, onOpenActivity, onOpenLead, onOpenOpportunity }: OpenActivitiesProps) {
  const columns = useMemo<DashboardColumn<DashboardOpenActivity>[]>(
    () => [
      {
        key: 'date',
        label: 'Activity Date',
        render: (a) => <DueDate date={a.dueDate} todayIso={todayIso} overdue={overdue(a, todayIso)} />,
        sortValue: (a) => a.dueDate,
        // Both the shown date (03 Oct 2026) and the ISO one match.
        searchText: (a) => (a.dueDate ? `${formatDate(a.dueDate)} ${isoDay(a.dueDate)}` : ''),
      },
      {
        key: 'type',
        label: 'Activity Type',
        render: (a) => a.activityType?.activityTypeName || '',
        sortValue: (a) => a.activityType?.activityTypeName,
        searchText: (a) => a.activityType?.activityTypeName,
      },
      {
        key: 'subject',
        label: 'Subject',
        render: (a) => (
          <span className="block max-w-[18rem] truncate" title={a.subject ?? undefined}>
            {a.subject || ''}
          </span>
        ),
        sortValue: (a) => a.subject,
        searchText: (a) => a.subject,
      },
      {
        key: 'record',
        label: 'Lead/ Opportunity Name',
        render: (a) => {
          const opp = isOpportunityActivity(a)
          const no = opp ? a.opportunityNo : a.leadNo
          return (
            <span className="inline-flex items-center gap-1.5">
              <Pill className={opp ? 'bg-teal-soft text-teal' : 'bg-primary-soft text-primary'}>{opp ? 'Opp' : 'Lead'}</Pill>
              {no ? (
                <RecordLink label={recordName(a)} onClick={() => (opp ? onOpenOpportunity(no) : onOpenLead(no))} />
              ) : (
                <span>{recordName(a)}</span>
              )}
            </span>
          )
        },
        sortValue: recordName,
        searchText: (a) => `${recordName(a)} ${a.recordCode ?? ''}`,
      },
      {
        key: 'assigned',
        label: 'Assigned To',
        render: (a) => a.assignTo?.printingName || '',
        sortValue: (a) => a.assignTo?.printingName,
        searchText: (a) => a.assignTo?.printingName,
      },
      {
        key: 'status',
        label: 'Status',
        render: (a) =>
          overdue(a, todayIso) ? (
            <Pill className="bg-accent-soft text-accent">Overdue</Pill>
          ) : (
            <Pill className="bg-primary-soft text-primary">{a.status?.statusName || 'Open'}</Pill>
          ),
        sortValue: (a) => (overdue(a, todayIso) ? 'Overdue' : a.status?.statusName || 'Open'),
        searchText: (a) => (overdue(a, todayIso) ? 'Overdue Open' : a.status?.statusName || 'Open'),
      },
    ],
    [todayIso, onOpenLead, onOpenOpportunity],
  )

  return (
    <DashboardTable
      // The count always shows; the page buttons once there are more than 10 activities.
      showPager
      label="Open activities"
      rows={activities}
      columns={columns}
      rowKey={(a) => `${isOpportunityActivity(a) ? 'O' : 'L'}-${a.activityDetailNo}`}
      // Stage sequence of the lead / opportunity, then due date.
      defaultOrder={(a, b) =>
        (a.recordStage?.sequence ?? Infinity) - (b.recordStage?.sequence ?? Infinity) ||
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
      }
      searchable
      searchPlaceholder="Search activities…"
      onRowClick={onOpenActivity}
      rowLabel={(a) => `Open activity ${a.subject ?? ''}`}
      empty={<SectionEmpty title="No activities found" subtitle="Open activities on your leads and opportunities show here." />}
    />
  )
}
