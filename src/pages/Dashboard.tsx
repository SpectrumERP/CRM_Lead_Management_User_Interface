import { useCallback, useEffect, useMemo, useState } from 'react'
import ActivityDrawer from '../components/ActivityDrawer'
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice'
import type { ToastType } from '../components/Toast'
import {
  getExpectedClosures,
  getLeadPipeline,
  getLeadsAttention,
  getMonthlySalesSummary,
  getOpenActivities,
  getOpportunitiesAttention,
  getOpportunityPipeline,
  toMoney,
  type DashboardOpenActivity,
} from '../api/dashboard'
import { api } from '../api/crm'
import { toApiError } from '../api/errors'
import { activityType, dateOnly, refreshServerLead, serverLeadId } from '../api/leadSync'
import { refreshServerOpportunity, serverOpportunityId } from '../api/opportunitySync'
import { useSpectrumCompany } from '../auth/useSpectrumCompany'
import { useCrmActions } from '../contexts/CrmStoreContext'
import type { Activity } from '../data/activities'
import { currentMonthRange, type LeadPipelineRow, type MonthSales, type OpportunityPipelineRow } from '../data/dashboard'
import { useStagnantDays } from '../data/dashboardSettings'
import { formatMoneyTotals } from '../data/leads'
import { PageHeader } from '../ui'
import { formatDate, toIsoDate } from '../utils/dateFormat'
import { LeadsAttentionTable, OpportunitiesAttentionTable } from './dashboard/Attention'
import { ClosureThisMonthTable, type ClosurePendingActivity } from './dashboard/ClosureThisMonth'
import { LastSixMonthsTable } from './dashboard/LastSixMonths'
import { isOpportunityActivity, OpenActivitiesTable } from './dashboard/OpenActivities'
import { LeadPipelineTable, OpportunityPipelineTable } from './dashboard/Pipelines'
import { Section } from './dashboard/parts'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** A valid `#hex` colour from the server, else undefined. */
function hexColor(value: string | null | undefined) {
  const color = value?.trim()
  return color && HEX.test(color) ? color : undefined
}

const bySequence = (a: { sequence?: number | null }, b: { sequence?: number | null }) =>
  (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER)

interface DashboardProps {
  onOpenLead: (id: string) => void
  onOpenOpportunity: (id: string) => void
  /** Lead list filtered to open leads in this stage. */
  onLeadStage: (stage: string) => void
  /** Opportunity list filtered to this stage. */
  onOpportunityStage: (stage: string) => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}

/**
 * One dashboard API call for the selected company. Reloads when `companyNo`, `key` or `reload` change;
 * `retry` reloads this section only.
 */
function useSection<T>(companyNo: number | null, load: (companyNo: number) => Promise<T>, key: string, reload: number) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!companyNo) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    load(companyNo)
      .then((next) => {
        if (!cancelled) setData(next)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(toApiError(err).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // `load` is a fresh closure each render; `key` carries its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyNo, key, reload, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { data, loading: Boolean(companyNo) && loading, error, retry }
}

export default function Dashboard({ onOpenLead, onOpenOpportunity, onLeadStage, onOpportunityStage, onToast }: DashboardProps) {
  const company = useSpectrumCompany()
  // Same company number the Leads / Opportunities lists search with.
  const companyNo = company.enabled ? company.headOfficeNo : null
  const { patchActivity } = useCrmActions()

  // Fixed for this visit; a new month is picked up the next time the dashboard opens.
  const [today] = useState(() => new Date())
  const todayIso = toIsoDate(today)
  const month = currentMonthRange(today)
  const stagnantDays = useStagnantDays()

  // Bumped after an activity is saved, so the activity-based sections reload.
  const [activityReload, setActivityReload] = useState(0)

  const activities = useSection(companyNo, getOpenActivities, '', activityReload)
  const leadPipeline = useSection(companyNo, getLeadPipeline, '', 0)
  const opportunityPipeline = useSection(companyNo, getOpportunityPipeline, '', 0)
  const leadAttention = useSection(companyNo, (no) => getLeadsAttention(no, stagnantDays), String(stagnantDays), activityReload)
  const opportunityAttention = useSection(
    companyNo,
    (no) => getOpportunitiesAttention(no, stagnantDays),
    String(stagnantDays),
    activityReload,
  )
  const closures = useSection(companyNo, (no) => getExpectedClosures(no, month.from, month.to), month.from, activityReload)
  const monthly = useSection(companyNo, (no) => getMonthlySalesSummary(no, 6), '', 0)

  const [editing, setEditing] = useState<Activity | null>(null)
  // Opened from Expected Closure: details read-only, only the remark and status can change.
  const [notesOnly, setNotesOnly] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)

  const openLead = useCallback((leadNo: number) => onOpenLead(serverLeadId(leadNo)), [onOpenLead])
  const openOpportunity = useCallback((no: number) => onOpenOpportunity(serverOpportunityId(no)), [onOpenOpportunity])

  /** Load the activity's lead / opportunity (puts its activities in the store), then edit it in the drawer. */
  const openActivity = useCallback(
    async (row: ClosurePendingActivity, remarkOnly = false, detailNo?: number) => {
      const opp = isOpportunityActivity(row)
      const recordNo = opp ? row.opportunityNo : row.leadNo
      if (!recordNo) return
      // Opportunity: its `opportunityActivityDetailNo` — the number the save sends.
      const id = opp ? `SOA-${row.opportunityActivityDetailNo ?? row.activityDetailNo}` : `SA-${row.activityDetailNo}`
      setOpening(id)
      try {
        if (opp) await refreshServerOpportunity(recordNo)
        else await refreshServerLead(recordNo)
        const oppId = serverOpportunityId(recordNo)
        // Opportunity: only this opportunity's activities (its load-data) — a same-numbered activity of
        // another opportunity already in the store would save against the wrong record ("ActivityNo not found").
        const candidates = opp ? api.crm.getState().activities.filter((a) => a.opportunityId === oppId) : api.crm.getState().activities
        const detailOf = (a: Activity) => a.serverDetailNo ?? Number(a.id.replace(/^SOA-/, ''))
        // Expected closures: the form takes the lastActivity's data and number — only when that number is one
        // of this opportunity's activities; otherwise the clicked activity saves with its own number.
        const owned = opp && detailNo !== undefined && detailNo > 0 ? candidates.find((a) => detailOf(a) === detailNo) : undefined
        const ownsDetailNo = owned !== undefined
        const activity = candidates.find((a) => a.id === id) ?? owned
        if (activity) {
          setNotesOnly(remarkOnly)
          const last = row.lastActivity
          // Opportunity: save against the row's `opportunityNo`.
          const withOpp = opp ? { ...activity, opportunityId: oppId } : activity
          setEditing(
            !ownsDetailNo
              ? withOpp
              : {
                  ...withOpp,
                  serverDetailNo: detailNo,
                  ...(last
                    ? {
                        subject: last.subject ?? activity.subject,
                        type: last.activityTypeName ? activityType(last.activityTypeName) : activity.type,
                        scheduleDate: last.activityDate ? dateOnly(last.activityDate) : activity.scheduleDate,
                      }
                    : {}),
                },
          )
        }
        else onToast?.('error', 'Activity not found', 'It may have been closed or deleted. Refresh the dashboard.')
      } catch (err) {
        onToast?.('error', 'Could not open activity', toApiError(err).message)
      } finally {
        setOpening(null)
      }
    },
    [onToast],
  )

  const leadRows = useMemo<LeadPipelineRow[]>(
    () =>
      [...(leadPipeline.data?.rows ?? [])].sort(bySequence).map((s) => ({
        stage: s.leadStageName || `Stage ${s.leadStageNo}`,
        color: hexColor(s.colorCoding),
        count: s.leadCount,
      })),
    [leadPipeline.data],
  )
  const opportunityRows = useMemo<OpportunityPipelineRow[]>(
    () =>
      [...(opportunityPipeline.data?.rows ?? [])].sort(bySequence).map((s) => ({
        stage: s.opportunityStageName || `Stage ${s.opportunityStageNo}`,
        color: hexColor(s.colorCoding),
        weight: s.weightage ?? 0,
        count: s.opportunityCount,
        values: toMoney(s.opportunityValue),
        weighted: toMoney(s.weightedValue),
      })),
    [opportunityPipeline.data],
  )
  const months = useMemo<MonthSales[]>(
    () =>
      [...(monthly.data?.rows ?? [])]
        .sort((a, b) => (a.month ?? '').localeCompare(b.month ?? ''))
        .map((m, i) => ({
          key: m.month || String(i),
          label: m.monthName || m.month || '',
          created: m.createdCount,
          lost: m.lostCount,
          lostValue: toMoney(m.lostValue),
          won: m.wonCount,
          wonValue: toMoney(m.wonValue),
        })),
    [monthly.data],
  )

  const activityTotals = activities.data?.totals
  const openActivityCount = activityTotals?.openActivityCount ?? activities.data?.rows.length ?? 0
  const overdueCount = activityTotals?.overdueActivityCount ?? activities.data?.rows.filter((a) => a.isOverdue).length ?? 0
  const leadAttentionCount = leadAttention.data?.totals?.attentionLeadCount ?? leadAttention.data?.rows.length ?? 0
  const oppAttentionCount = opportunityAttention.data?.totals?.attentionOpportunityCount ?? opportunityAttention.data?.rows.length ?? 0
  const openLeadCount = leadPipeline.data?.totals?.openLeadCount ?? leadRows.reduce((s, r) => s + r.count, 0)
  const pipelineTotals = opportunityPipeline.data?.totals
  const openOpportunityCount = pipelineTotals?.openOpportunityCount ?? opportunityRows.reduce((s, r) => s + r.count, 0)
  const weightedPipeline = pipelineTotals?.weightedValue?.length
    ? toMoney(pipelineTotals.weightedValue)
    : opportunityRows.flatMap((r) => r.weighted)
  const closureTotals = closures.data?.totals ?? null
  const closingCount = closureTotals?.closingCount ?? closures.data?.rows.length ?? 0
  const closingValue = closureTotals?.opportunityValue?.length
    ? toMoney(closureTotals.opportunityValue)
    : (closures.data?.rows ?? []).map((r) => ({ value: r.opportunityValue ?? 0, currency: r.currency?.currencyCode || undefined }))

  const summary = [
    {
      label: 'Open Activities',
      value: String(openActivityCount),
      sub: overdueCount ? `${overdueCount} overdue` : 'none overdue',
      alert: overdueCount > 0,
      target: 'dash-activities',
      loading: activities.loading,
    },
    {
      label: 'Need Attention',
      value: String(leadAttentionCount + oppAttentionCount),
      sub: `${leadAttentionCount} leads · ${oppAttentionCount} opps`,
      alert: leadAttentionCount + oppAttentionCount > 0,
      target: 'dash-attention',
      loading: leadAttention.loading || opportunityAttention.loading,
    },
    { label: 'Open Leads', value: String(openLeadCount), sub: 'in pipeline', target: 'dash-pipeline', loading: leadPipeline.loading },
    {
      label: 'Open Opportunities',
      value: String(openOpportunityCount),
      sub: `Weighted ${formatMoneyTotals(weightedPipeline)}`,
      target: 'dash-pipeline',
      loading: opportunityPipeline.loading,
    },
    {
      label: 'Closing This Month',
      value: String(closingCount),
      sub: closingCount ? formatMoneyTotals(closingValue) : 'no closures due',
      target: 'dash-closure',
      loading: closures.loading,
    },
  ]

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="dash-animate page-gutter space-y-4 py-4">
      <PageHeader title="Sales Dashboard" subtitle={`Today: ${formatDate(today)}`} />

      <SpectrumRequiredNotice what="Dashboard figures" />

      {/* Key numbers */}
      <div className="dash-kpis grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {summary.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => scrollTo(s.target)}
            className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-left shadow-card transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{s.label}</p>
            {s.loading ? (
              <div className="skeleton mt-1.5 mb-1" style={{ height: 18, width: '55%' }} />
            ) : (
              <div className="flex min-w-0 items-baseline gap-2">
                <span className={`font-display text-xl font-bold leading-7 tabular-nums ${s.alert ? 'text-accent' : 'text-ink'}`}>
                  {s.value}
                </span>
                <span className="truncate text-xs text-ink-faint" title={s.sub}>
                  {s.sub}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* 1. Open activities */}
      <div id="dash-activities" className="scroll-mt-4">
        <Section
          id="dash-activities-title"
          title="Open Activities"
          subtitle={
            opening
              ? 'Opening activity…'
              : 'Pending activities on your leads and opportunities, in stage sequence, then by date. Click a row to update it.'
          }
          loading={activities.loading}
          error={activities.error}
          onRetry={activities.retry}
          skeletonRows={5}
        >
          <OpenActivitiesTable
            activities={activities.data?.rows ?? []}
            todayIso={todayIso}
            onOpenActivity={(a) => void openActivity(a)}
            onOpenLead={openLead}
            onOpenOpportunity={openOpportunity}
          />
        </Section>
      </div>

      {/* 2. Pipelines */}
      <div id="dash-pipeline" className="grid scroll-mt-4 grid-cols-1 gap-4 xl:grid-cols-2">
        <Section
          id="dash-lead-pipeline"
          title="Lead Pipeline"
          subtitle="Open leads by stage. Click a stage to see its leads."
          loading={leadPipeline.loading}
          error={leadPipeline.error}
          onRetry={leadPipeline.retry}
          skeletonRows={6}
        >
          <LeadPipelineTable rows={leadRows} onStage={onLeadStage} />
        </Section>
        <Section
          id="dash-opp-pipeline"
          title="Opportunity Pipeline"
          subtitle="Open opportunities by stage. Weighted value = value × stage weightage."
          loading={opportunityPipeline.loading}
          error={opportunityPipeline.error}
          onRetry={opportunityPipeline.retry}
          skeletonRows={6}
        >
          <OpportunityPipelineTable rows={opportunityRows} onStage={onOpportunityStage} />
        </Section>
      </div>

      {/* 3. Attention */}
      <div id="dash-attention" className="scroll-mt-4 space-y-4">
        <Section
          id="dash-lead-attention"
          title="Leads Requiring Attention"
          subtitle={`Open leads with no activity, an overdue activity, or no stage change for over ${stagnantDays} days.`}
          loading={leadAttention.loading}
          error={leadAttention.error}
          onRetry={leadAttention.retry}
        >
          <LeadsAttentionTable rows={leadAttention.data?.rows ?? []} stagnantDays={stagnantDays} todayIso={todayIso} onOpenLead={openLead} />
        </Section>
        <Section
          id="dash-opp-attention"
          title="Opportunities Requiring Attention"
          subtitle={`Open opportunities with no activity, an overdue activity, or no stage change for over ${stagnantDays} days.`}
          loading={opportunityAttention.loading}
          error={opportunityAttention.error}
          onRetry={opportunityAttention.retry}
        >
          <OpportunitiesAttentionTable
            rows={opportunityAttention.data?.rows ?? []}
            stagnantDays={stagnantDays}
            todayIso={todayIso}
            onOpenOpportunity={openOpportunity}
          />
        </Section>
      </div>

      {/* 4. Expected closure this month */}
      <div id="dash-closure" className="scroll-mt-4">
        <Section
          id="dash-closure-title"
          title="Expected Closure This Month"
          subtitle={`Open opportunities expected to close ${formatDate(month.from)} – ${formatDate(month.to)}.`}
          loading={closures.loading}
          error={closures.error}
          onRetry={closures.retry}
        >
          <ClosureThisMonthTable
            rows={closures.data?.rows ?? []}
            totals={closureTotals}
            activities={activities.data?.rows ?? []}
            todayIso={todayIso}
            onOpenOpportunity={openOpportunity}
            onOpenActivity={(a) => void openActivity(a, true, a.lastActivity ? a.lastActivity.activityDetailNo ?? 0 : a.opportunityActivityDetailNo ?? undefined)}
          />
        </Section>
      </div>

      {/* 5. Last six months */}
      <Section
        id="dash-six-months"
        title="Last 6 Months Sales"
        subtitle="Opportunities created, won and lost per month."
        loading={monthly.loading}
        error={monthly.error}
        onRetry={monthly.retry}
        skeletonRows={5}
      >
        <LastSixMonthsTable months={months} />
      </Section>

      {editing ? (
        <ActivityDrawer
          editing={editing}
          notesOnly={notesOnly}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            // Server leads / opportunities → save-activity-detail, then the record reloads.
            // Success is shown only once the server confirms; a failure shows its own error.
            void patchActivity(a.id, { ...a, opportunityId: editing.opportunityId }).then((ok) => {
              if (!ok) return
              onToast?.('success', 'Activity Updated', `"${a.subject}" has been updated.`)
              setActivityReload((n) => n + 1)
            })
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
