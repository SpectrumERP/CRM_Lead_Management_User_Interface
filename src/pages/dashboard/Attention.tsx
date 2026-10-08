import { useMemo } from 'react'
import { useBusinessEntityTypes } from '../../components/useBusinessEntityTypes'
import { stageBadgeStyle } from '../../components/useOpportunityStageColors'
import type { DashboardLeadAttention, DashboardNextActivity, DashboardOpportunityAttention } from '../../api/dashboard'
import { formatMoney } from '../../data/leads'
import { formatDate } from '../../utils/dateFormat'
import { DashboardTable, type DashboardColumn } from './DashboardTable'
import { days, DueDate, normalizeReason, ReasonBadges, reasonLabel, reasonSortValue, RecordLink, SectionEmpty } from './parts'

const badge = 'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold'
/** Statuses carry no colour on the server — one neutral badge. */
const neutral = `${badge} border-line bg-surface-hover text-ink-soft`

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** Stage badge in the stage's server colour (neutral when it has none). */
function StageBadge({ stage, color }: { stage?: string | null; color?: string | null }) {
  if (!stage) return null
  const hex = color?.trim()
  return hex && HEX.test(hex) ? (
    <span className={badge} style={stageBadgeStyle(hex)}>
      {stage}
    </span>
  ) : (
    <span className={neutral}>{stage}</span>
  )
}

function NextAction({ next, todayIso }: { next?: DashboardNextActivity | null; todayIso: string }) {
  if (!next?.subject && !next?.dueDate) return null
  return (
    <span className="flex max-w-[14rem] flex-col">
      <span className="truncate" title={next.subject ?? undefined}>
        {next.subject || ''}
      </span>
      <span className="text-[11px]">
        <DueDate date={next.dueDate} todayIso={todayIso} overdue={next.isOverdue} />
      </span>
    </span>
  )
}

const stageDaysHint = (stagnantDays: number) => `Days since the stage last changed. Stagnant after ${stagnantDays} days.`

/** Entity name with its type (Customer / Prospect …) underneath. */
function EntityCell({ name, type }: { name?: string | null; type?: string }) {
  if (!name) return null
  return (
    <span className="flex max-w-[14rem] flex-col">
      <span className="truncate" title={name}>
        {name}
      </span>
      {type ? <span className="text-[11px] text-ink-muted">{type}</span> : null}
    </span>
  )
}

const productNames = (products?: readonly { productName?: string | null }[] | null) =>
  (products ?? []).map((p) => p.productName).filter(Boolean).join(', ')

const reasonsOf = (row: { reasons?: string[] | null }) => (row.reasons ?? []).map(normalizeReason)

function ProductCell({ text }: { text: string }) {
  return (
    <span className="block max-w-[12rem] truncate" title={text}>
      {text || ''}
    </span>
  )
}

interface LeadsAttentionProps {
  rows: readonly DashboardLeadAttention[]
  stagnantDays: number
  todayIso: string
  onOpenLead: (leadNo: number) => void
}

export function LeadsAttentionTable({ rows, stagnantDays, todayIso, onOpenLead }: LeadsAttentionProps) {
  const entityTypes = useBusinessEntityTypes(
    rows.flatMap((r) =>
      r.businessEntity?.businessEntityNo ? [{ no: r.businessEntity.businessEntityNo, name: r.businessEntity.businessEntityName ?? '' }] : [],
    ),
  )
  const columns = useMemo<DashboardColumn<DashboardLeadAttention>[]>(() => {
    const entityType = (r: DashboardLeadAttention) => (r.businessEntity?.businessEntityNo && entityTypes.get(r.businessEntity.businessEntityNo)) || ''
    const name = (r: DashboardLeadAttention) => r.leadName || r.code || `Lead ${r.leadNo}`
    return [
      {
        key: 'name',
        label: 'Lead Name',
        render: (r) => <RecordLink label={name(r)} onClick={() => onOpenLead(r.leadNo)} />,
        sortValue: name,
        searchText: (r) => `${name(r)} ${r.code ?? ''}`,
      },
      {
        key: 'entity',
        label: 'Business Entity',
        render: (r) => <EntityCell name={r.businessEntity?.businessEntityName} type={entityType(r)} />,
        sortValue: (r) => r.businessEntity?.businessEntityName,
        searchText: (r) => `${r.businessEntity?.businessEntityName ?? ''} ${entityType(r)}`,
      },
      { key: 'product', label: 'Product Group', render: (r) => <ProductCell text={productNames(r.products)} />, searchText: (r) => productNames(r.products) },
      {
        key: 'stage',
        label: 'Lead Stage',
        render: (r) => <StageBadge stage={r.leadStage?.leadStageName} color={r.leadStage?.colorCoding} />,
        sortValue: (r) => r.leadStage?.leadStageName,
        searchText: (r) => r.leadStage?.leadStageName,
      },
      {
        key: 'status',
        label: 'Lead Status',
        render: (r) => (r.leadStatus?.leadStatusName ? <span className={neutral}>{r.leadStatus.leadStatusName}</span> : ''),
        searchText: (r) => r.leadStatus?.leadStatusName,
      },
      {
        key: 'owner',
        label: 'Lead Owner',
        render: (r) => r.leadOwner?.printingName || '',
        sortValue: (r) => r.leadOwner?.printingName,
        searchText: (r) => r.leadOwner?.printingName,
      },
      { key: 'age', label: 'Lead Age', render: (r) => days(r.leadAgeDays), sortValue: (r) => r.leadAgeDays, align: 'right' },
      {
        key: 'inStage',
        label: 'Days in Current Stage',
        render: (r) => <span title={stageDaysHint(stagnantDays)}>{days(r.daysInStage)}</span>,
        sortValue: (r) => r.daysInStage,
        align: 'right',
      },
      { key: 'last', label: 'Last Activity Date', render: (r) => formatDate(r.lastActivityDate, ''), sortValue: (r) => r.lastActivityDate },
      {
        key: 'next',
        label: 'Pending Activity / Due Date',
        render: (r) => <NextAction next={r.nextActivity} todayIso={todayIso} />,
        sortValue: (r) => r.nextActivity?.dueDate,
        searchText: (r) => r.nextActivity?.subject,
      },
      {
        key: 'reason',
        label: 'Attention Reason',
        render: (r) => <ReasonBadges reasons={reasonsOf(r)} record="lead" />,
        sortValue: (r) => reasonSortValue(reasonsOf(r)),
        searchText: (r) => reasonsOf(r).map((x) => reasonLabel(x, 'lead')).join(' '),
      },
    ]
  }, [todayIso, onOpenLead, stagnantDays, entityTypes])

  return (
    <DashboardTable
      label="Leads requiring attention"
      rows={rows}
      columns={columns}
      rowKey={(r) => String(r.leadNo)}
      defaultSort={{ key: 'age', dir: 'asc' }}
      searchable
      searchPlaceholder="Search leads…"
      onRowClick={(r) => onOpenLead(r.leadNo)}
      rowLabel={(r) => `Open lead ${r.leadName || r.code || r.leadNo}`}
      empty={<SectionEmpty positive title="No leads require attention" subtitle="Every open lead has activity on track." />}
    />
  )
}

interface OpportunitiesAttentionProps {
  rows: readonly DashboardOpportunityAttention[]
  stagnantDays: number
  todayIso: string
  onOpenOpportunity: (opportunityNo: number) => void
}

export function OpportunitiesAttentionTable({ rows, stagnantDays, todayIso, onOpenOpportunity }: OpportunitiesAttentionProps) {
  const columns = useMemo<DashboardColumn<DashboardOpportunityAttention>[]>(() => {
    const name = (r: DashboardOpportunityAttention) => r.opportunityName || r.code || `Opportunity ${r.opportunityNo}`
    return [
      {
        key: 'name',
        label: 'Opportunity Name',
        render: (r) => <RecordLink label={name(r)} onClick={() => onOpenOpportunity(r.opportunityNo)} />,
        sortValue: name,
        searchText: (r) => `${name(r)} ${r.code ?? ''}`,
      },
      {
        key: 'entity',
        label: 'Business Entity',
        render: (r) => r.businessEntity?.businessEntityName || '',
        sortValue: (r) => r.businessEntity?.businessEntityName,
        searchText: (r) => r.businessEntity?.businessEntityName,
      },
      { key: 'product', label: 'Product Group', render: (r) => <ProductCell text={productNames(r.products)} />, searchText: (r) => productNames(r.products) },
      {
        key: 'value',
        label: 'Opportunity Value',
        render: (r) => (r.opportunityValue == null ? '' : formatMoney(r.opportunityValue, r.currency?.currencyCode || undefined)),
        sortValue: (r) => r.opportunityValue,
        align: 'right',
      },
      {
        key: 'stage',
        label: 'Opportunity Stage',
        render: (r) => <StageBadge stage={r.opportunityStage?.opportunityStageName} color={r.opportunityStage?.colorCoding} />,
        sortValue: (r) => r.opportunityStage?.opportunityStageName,
        searchText: (r) => r.opportunityStage?.opportunityStageName,
      },
      {
        key: 'weight',
        label: 'Weightage',
        render: (r) => (r.opportunityStage?.weightage == null ? '' : `${r.opportunityStage.weightage}%`),
        sortValue: (r) => r.opportunityStage?.weightage,
        align: 'right',
      },
      {
        key: 'status',
        label: 'Opportunity Status',
        render: (r) =>
          r.opportunityStatus?.opportunityStatusName ? <span className={neutral}>{r.opportunityStatus.opportunityStatusName}</span> : '',
        searchText: (r) => r.opportunityStatus?.opportunityStatusName,
      },
      {
        key: 'closing',
        label: 'Expected Closure Date',
        render: (r) => formatDate(r.expectedClosureDate, ''),
        sortValue: (r) => r.expectedClosureDate,
      },
      {
        key: 'inStage',
        label: 'Days in Current Stage',
        render: (r) => <span title={stageDaysHint(stagnantDays)}>{days(r.daysInStage)}</span>,
        sortValue: (r) => r.daysInStage,
        align: 'right',
      },
      { key: 'last', label: 'Last Activity Date', render: (r) => formatDate(r.lastActivityDate, ''), sortValue: (r) => r.lastActivityDate },
      {
        key: 'next',
        label: 'Pending Activity / Due',
        render: (r) => <NextAction next={r.nextActivity} todayIso={todayIso} />,
        sortValue: (r) => r.nextActivity?.dueDate,
        searchText: (r) => r.nextActivity?.subject,
      },
      {
        key: 'reason',
        label: 'Attention Reason',
        render: (r) => <ReasonBadges reasons={reasonsOf(r)} />,
        sortValue: (r) => reasonSortValue(reasonsOf(r)),
        searchText: (r) => reasonsOf(r).join(' '),
      },
    ]
  }, [todayIso, onOpenOpportunity, stagnantDays])

  return (
    <DashboardTable
      label="Opportunities requiring attention"
      rows={rows}
      columns={columns}
      rowKey={(r) => String(r.opportunityNo)}
      defaultSort={{ key: 'reason', dir: 'asc' }}
      searchable
      searchPlaceholder="Search opportunities…"
      onRowClick={(r) => onOpenOpportunity(r.opportunityNo)}
      rowLabel={(r) => `Open opportunity ${r.opportunityName || r.code || r.opportunityNo}`}
      empty={<SectionEmpty positive title="No opportunities require attention" subtitle="Every open opportunity has activity on track." />}
    />
  )
}
