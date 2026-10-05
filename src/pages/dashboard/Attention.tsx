import { useMemo } from 'react'
import { useBusinessEntityTypes } from '../../components/useBusinessEntityTypes'
import { stageBadgeStyle } from '../../components/useOpportunityStageColors'
import { displayLeadName, formatMoney } from '../../data/leads'
import { type LeadAttentionRow, type OpportunityAttentionRow } from '../../data/dashboard'
import { formatDate } from '../../utils/dateFormat'
import { DashboardTable, type DashboardColumn } from './DashboardTable'
import { days, DueDate, ReasonBadges, reasonLabel, reasonSortValue, RecordLink, SectionEmpty } from './parts'

const badge = 'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold'
/** Statuses carry no colour on the server — one neutral badge. */
const neutral = `${badge} border-line bg-surface-hover text-ink-soft`

/** Stage badge in the stage's server colour (neutral when the master has none). */
function StageBadge({ stage, color }: { stage: string; color?: string }) {
  if (!stage) return <span className="text-ink-faint">—</span>
  return color ? (
    <span className={badge} style={stageBadgeStyle(color)}>
      {stage}
    </span>
  ) : (
    <span className={neutral}>{stage}</span>
  )
}

export type StageColor = (stage: string) => string | undefined

function NextAction({ subject, date, todayIso }: { subject?: string; date?: string; todayIso: string }) {
  if (!subject && !date) return <span className="text-ink-faint">—</span>
  return (
    <span className="flex max-w-[14rem] flex-col">
      <span className="truncate" title={subject}>
        {subject || '—'}
      </span>
      <span className="text-[11px]">
        <DueDate date={date} todayIso={todayIso} />
      </span>
    </span>
  )
}

const stageDaysHint = (stagnantDays: number) =>
  `Days since the record was last updated (the server does not send the stage change date yet). Stagnant after ${stagnantDays} days.`

/** Entity name with its type (Customer / Prospect …) underneath. */
function EntityCell({ name, type }: { name: string; type?: string }) {
  if (!name) return <span className="text-ink-faint">—</span>
  return (
    <span className="flex max-w-[14rem] flex-col">
      <span className="truncate" title={name}>
        {name}
      </span>
      {type ? <span className="text-[11px] text-ink-muted">{type}</span> : null}
    </span>
  )
}

interface LeadsAttentionProps {
  rows: LeadAttentionRow[]
  stagnantDays: number
  todayIso: string
  stageColor: StageColor
  onOpenLead: (id: string) => void
}

export function LeadsAttentionTable({ rows, stagnantDays, todayIso, stageColor, onOpenLead }: LeadsAttentionProps) {
  const entityTypes = useBusinessEntityTypes(
    rows.flatMap((r) => (r.lead.spectrum?.businessEntityNo ? [{ no: r.lead.spectrum.businessEntityNo, name: r.lead.companyName }] : [])),
  )
  const entityType = (r: LeadAttentionRow) =>
    (r.lead.spectrum?.businessEntityNo && entityTypes.get(r.lead.spectrum.businessEntityNo)) || ''
  const columns = useMemo<DashboardColumn<LeadAttentionRow>[]>(
    () => [
      {
        key: 'name',
        label: 'Lead Name',
        render: (r) => <RecordLink label={displayLeadName(r.lead)} onClick={() => onOpenLead(r.lead.id)} />,
        sortValue: (r) => displayLeadName(r.lead),
        searchText: (r) => displayLeadName(r.lead),
      },
      {
        key: 'entity',
        label: 'Business Entity',
        render: (r) => <EntityCell name={r.lead.companyName} type={entityType(r)} />,
        sortValue: (r) => r.lead.companyName,
        searchText: (r) => `${r.lead.companyName} ${entityType(r)}`,
      },
      {
        key: 'product',
        label: 'Product Group',
        render: (r) => (
          <span className="block max-w-[12rem] truncate" title={r.lead.productsRequired}>
            {r.lead.productsRequired || '—'}
          </span>
        ),
        searchText: (r) => r.lead.productsRequired,
      },
      {
        key: 'stage',
        label: 'Lead Stage',
        render: (r) => <StageBadge stage={r.lead.leadStage} color={stageColor(r.lead.leadStage)} />,
        sortValue: (r) => r.lead.leadStage,
        searchText: (r) => r.lead.leadStage,
      },
      {
        key: 'status',
        label: 'Lead Status',
        render: (r) => <span className={neutral}>{r.lead.leadStatus}</span>,
        searchText: (r) => r.lead.leadStatus,
      },
      { key: 'owner', label: 'Lead Owner', render: (r) => r.lead.assignedSalesperson || '—', sortValue: (r) => r.lead.assignedSalesperson, searchText: (r) => r.lead.assignedSalesperson },
      { key: 'age', label: 'Lead Age', render: (r) => days(r.ageDays), sortValue: (r) => (r.ageDays === null ? null : r.ageDays - (r.createdTime ?? 0) / 1e15), align: 'right' },
      {
        key: 'inStage',
        label: 'Days in Current Stage',
        render: (r) => <span title={stageDaysHint(stagnantDays)}>{days(r.daysInStage)}</span>,
        sortValue: (r) => r.daysInStage,
        align: 'right',
      },
      { key: 'last', label: 'Last Activity Date', render: (r) => formatDate(r.lastActivity), sortValue: (r) => r.lastActivity },
      {
        key: 'next',
        label: 'Pending Activity / Due Date',
        render: (r) => <NextAction subject={r.next?.subject} date={r.next?.scheduleDate} todayIso={todayIso} />,
        sortValue: (r) => r.next?.scheduleDate,
        searchText: (r) => r.next?.subject,
      },
      {
        key: 'reason',
        label: 'Attention Reason',
        render: (r) => <ReasonBadges reasons={r.reasons} record="lead" />,
        sortValue: (r) => reasonSortValue(r.reasons),
        searchText: (r) => r.reasons.map((x) => reasonLabel(x, 'lead')).join(' '),
      },
    ],
    [todayIso, stageColor, onOpenLead, stagnantDays, entityTypes],
  )

  return (
    <DashboardTable
      label="Leads requiring attention"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.lead.id}
      defaultSort={{ key: 'age', dir: 'asc' }}
      searchable
      searchPlaceholder="Search leads…"
      onRowClick={(r) => onOpenLead(r.lead.id)}
      rowLabel={(r) => `Open lead ${displayLeadName(r.lead)}`}
      empty={<SectionEmpty positive title="No leads require attention" subtitle="Every open lead has activity on track." />}
    />
  )
}

interface OpportunitiesAttentionProps {
  rows: OpportunityAttentionRow[]
  stagnantDays: number
  todayIso: string
  stageColor: StageColor
  onOpenOpportunity: (id: string) => void
}

export function OpportunitiesAttentionTable({ rows, stagnantDays, todayIso, stageColor, onOpenOpportunity }: OpportunitiesAttentionProps) {
  const columns = useMemo<DashboardColumn<OpportunityAttentionRow>[]>(
    () => [
      {
        key: 'name',
        label: 'Opportunity Name',
        render: (r) => <RecordLink label={r.opportunity.name} onClick={() => onOpenOpportunity(r.opportunity.id)} />,
        sortValue: (r) => r.opportunity.name,
        searchText: (r) => r.opportunity.name,
      },
      {
        key: 'entity',
        label: 'Business Entity',
        render: (r) => r.opportunity.companyName || '—',
        sortValue: (r) => r.opportunity.companyName,
        searchText: (r) => r.opportunity.companyName,
      },
      {
        key: 'product',
        label: 'Product Group',
        render: (r) => (
          <span className="block max-w-[12rem] truncate" title={r.opportunity.productsRequired}>
            {r.opportunity.productsRequired || '—'}
          </span>
        ),
        searchText: (r) => r.opportunity.productsRequired,
      },
      {
        key: 'value',
        label: 'Opportunity Value',
        render: (r) => formatMoney(r.opportunity.dealValue, r.opportunity.valueCurrency),
        sortValue: (r) => r.opportunity.dealValue,
        align: 'right',
      },
      {
        key: 'stage',
        label: 'Opportunity Stage',
        render: (r) => (
          <StageBadge stage={r.opportunity.dealStage} color={stageColor(r.opportunity.dealStage)} />
        ),
        sortValue: (r) => r.opportunity.dealStage,
        searchText: (r) => r.opportunity.dealStage,
      },
      {
        key: 'weight',
        label: 'Weightage',
        render: (r) => `${r.opportunity.weightPercent}%`,
        sortValue: (r) => r.opportunity.weightPercent,
        align: 'right',
      },
      {
        key: 'status',
        label: 'Opportunity Status',
        render: (r) => (
          <span className={neutral}>{r.opportunity.status}</span>
        ),
        searchText: (r) => r.opportunity.status,
      },
      {
        key: 'closing',
        label: 'Expected Closure Date',
        render: (r) => formatDate(r.opportunity.closingDate),
        sortValue: (r) => r.opportunity.closingDate,
      },
      {
        key: 'inStage',
        label: 'Days in Current Stage',
        render: (r) => <span title={stageDaysHint(stagnantDays)}>{days(r.daysInStage)}</span>,
        sortValue: (r) => r.daysInStage,
        align: 'right',
      },
      { key: 'last', label: 'Last Activity Date', render: (r) => formatDate(r.lastActivity), sortValue: (r) => r.lastActivity },
      {
        key: 'next',
        label: 'Pending Activity / Due',
        render: (r) => <NextAction subject={r.next?.subject} date={r.next?.scheduleDate} todayIso={todayIso} />,
        sortValue: (r) => r.next?.scheduleDate,
        searchText: (r) => r.next?.subject,
      },
      {
        key: 'reason',
        label: 'Attention Reason',
        render: (r) => <ReasonBadges reasons={r.reasons} />,
        sortValue: (r) => reasonSortValue(r.reasons),
        searchText: (r) => r.reasons.join(' '),
      },
    ],
    [todayIso, stageColor, onOpenOpportunity, stagnantDays],
  )

  return (
    <DashboardTable
      label="Opportunities requiring attention"
      rows={rows}
      columns={columns}
      rowKey={(r) => r.opportunity.id}
      defaultSort={{ key: 'reason', dir: 'asc' }}
      searchable
      searchPlaceholder="Search opportunities…"
      onRowClick={(r) => onOpenOpportunity(r.opportunity.id)}
      rowLabel={(r) => `Open opportunity ${r.opportunity.name}`}
      empty={<SectionEmpty positive title="No opportunities require attention" subtitle="Every open opportunity has activity on track." />}
    />
  )
}
