import { useCallback, useEffect, useMemo, useState } from 'react'
import ActivityDrawer from '../components/ActivityDrawer'
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice'
import { SkeletonStatCards } from '../components/CRMStates'
import type { ToastType } from '../components/Toast'
import { useLeadFormFillValues } from '../components/useLeadFormFillValues'
import { useOpportunityFillValues } from '../components/useOpportunityFillValues'
import { useServerLeadSync, useServerOpportunitySync } from '../components/useServerLeadSync'
import { loadDashboardActivities, resetDashboardActivities } from '../api/dashboardActivities'
import { stageWeight } from '../api/opportunityFormFillValues'
import { useCrmActions, useCrmSelector } from '../contexts/CrmStoreContext'
import type { Activity } from '../data/activities'
import {
  closuresThisMonth,
  currentMonthRange,
  groupActivities,
  isOpenStatus,
  isPendingActivity,
  lastSixMonthsSales,
  leadPipeline,
  leadsRequiringAttention,
  opportunitiesRequiringAttention,
  opportunityPipeline,
  type StageMaster,
} from '../data/dashboard'
import { useStagnantDays } from '../data/dashboardSettings'
import { formatMoneyTotals } from '../data/leads'
import { Button, PageHeader } from '../ui'
import { formatDate, toIsoDate } from '../utils/dateFormat'
import { LeadsAttentionTable, OpportunitiesAttentionTable } from './dashboard/Attention'
import { ClosureThisMonthTable } from './dashboard/ClosureThisMonth'
import { LastSixMonthsTable } from './dashboard/LastSixMonths'
import { OpenActivitiesTable } from './dashboard/OpenActivities'
import { LeadPipelineTable, OpportunityPipelineTable } from './dashboard/Pipelines'
import { Section } from './dashboard/parts'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

/** A valid `#hex` colour from the server, else undefined. */
function hexColor(value: string | null | undefined) {
  const color = value?.trim()
  return color && HEX.test(color) ? color : undefined
}

/** Stage name (any case) → its server colour. */
function colorLookup(stages: readonly StageMaster[]) {
  const map = new Map(stages.filter((s) => s.color).map((s) => [s.name.trim().toLowerCase(), s.color!]))
  return (stage: string) => map.get(stage.trim().toLowerCase())
}

interface DashboardProps {
  onOpenLead: (id: string) => void
  onOpenOpportunity: (id: string) => void
  /** Lead list filtered to open leads in this stage. */
  onLeadStage: (stage: string) => void
  /** Opportunity list filtered to this stage. */
  onOpportunityStage: (stage: string) => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}

/** Activities of these records are loaded for the dashboard (the server has no all-activities list). */
function useDashboardActivities(ids: readonly string[], ready: boolean) {
  const key = ids.join(',')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(0)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setLoading(true)
    loadDashboardActivities(key ? key.split(',') : [])
      .then((n) => {
        if (!cancelled) setFailed(n)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [key, ready, attempt])

  const retry = useCallback(() => {
    resetDashboardActivities()
    setAttempt((n) => n + 1)
  }, [])

  return { loading: !ready || loading, failed, retry }
}

export default function Dashboard({ onOpenLead, onOpenOpportunity, onLeadStage, onOpportunityStage, onToast }: DashboardProps) {
  const leadSync = useServerLeadSync()
  const oppSync = useServerOpportunitySync()
  const leadFillQuery = useLeadFormFillValues()
  const oppFillQuery = useOpportunityFillValues()
  const leadFill = leadFillQuery.values
  const oppFill = oppFillQuery.values
  const { patchActivity } = useCrmActions()

  // Server records only, as on the Leads / Opportunities lists.
  const allLeads = useCrmSelector((s) => s.leads)
  const allOpportunities = useCrmSelector((s) => s.opportunities)
  const allActivities = useCrmSelector((s) => s.activities)
  const leads = useMemo(() => allLeads.filter((l) => l.spectrum), [allLeads])
  const opportunities = useMemo(() => allOpportunities.filter((o) => o.spectrum), [allOpportunities])

  // Fixed for this visit; a new month is picked up the next time the dashboard opens.
  const [today] = useState(() => new Date())
  const todayIso = toIsoDate(today)
  const month = currentMonthRange(today)

  const [editing, setEditing] = useState<Activity | null>(null)
  // Opened from Expected Closure's pending list: only Notes / Outcome and Status are editable.
  const [notesOnly, setNotesOnly] = useState(false)

  // Stage order, weightage and colours come from the server masters (fill-values) only.
  const leadStages = useMemo<StageMaster[]>(
    () =>
      (leadFill?.leadStages ?? []).map((s) => ({ name: s.leadStageName, sequence: s.sequence, color: hexColor(s.colorCode) })),
    [leadFill],
  )
  const opportunityStages = useMemo<StageMaster[]>(
    () =>
      (oppFill?.opportunityStages ?? []).map((s) => ({
        name: s.opportunityStageName,
        sequence: s.sequence,
        weight: stageWeight(s),
        color: hexColor(s.colorCoding),
      })),
    [oppFill],
  )
  // Open activities follow the stage sequence of their lead / opportunity (then activity date).
  const activitySequence = useMemo(() => {
    const seq = (stages: readonly StageMaster[]) => new Map(stages.map((s) => [s.name.trim().toLowerCase(), s.sequence]))
    const leadSeq = seq(leadStages)
    const oppSeq = seq(opportunityStages)
    const leadStage = new Map(leads.map((l) => [l.id, l.leadStage]))
    const oppStage = new Map(opportunities.map((o) => [o.id, o.dealStage]))
    return (a: Activity) =>
      a.opportunityId
        ? oppSeq.get((oppStage.get(a.opportunityId) ?? '').trim().toLowerCase())
        : leadSeq.get((leadStage.get(a.leadId) ?? '').trim().toLowerCase())
  }, [leadStages, opportunityStages, leads, opportunities])
  const leadStageColor = useMemo(() => colorLookup(leadStages), [leadStages])
  const opportunityStageColor = useMemo(() => colorLookup(opportunityStages), [opportunityStages])
  // Loading until the masters arrive (or fail); errors from the list sync or the masters.
  const leadMastersLoading = leadFillQuery.remote && !leadFill && !leadFillQuery.error
  const oppMastersLoading = oppFillQuery.remote && !oppFill && !oppFillQuery.error
  const leadError = leadSync.error || leadFillQuery.error
  const oppError = oppSync.error || oppFillQuery.error
  function retryLeads() {
    if (leadSync.error) void leadSync.retry()
    if (leadFillQuery.error) leadFillQuery.retry()
  }
  function retryOpportunities() {
    if (oppSync.error) void oppSync.retry()
    if (oppFillQuery.error) oppFillQuery.retry()
  }

  const openLeadIds = useMemo(() => leads.filter((l) => isOpenStatus(l.leadStatus)).map((l) => l.id), [leads])
  const openOpportunityIds = useMemo(
    () => opportunities.filter((o) => isOpenStatus(o.status)).map((o) => o.id),
    [opportunities],
  )
  const syncing = leadSync.loading || oppSync.loading
  const activityLoad = useDashboardActivities([...openLeadIds, ...openOpportunityIds], !syncing)

  const serverActivities = useMemo(() => {
    const leadIds = new Set(leads.map((l) => l.id))
    const oppIds = new Set(opportunities.map((o) => o.id))
    return allActivities.filter((a) => (a.opportunityId ? oppIds.has(a.opportunityId) : leadIds.has(a.leadId)))
  }, [allActivities, leads, opportunities])
  const grouped = useMemo(() => groupActivities(serverActivities), [serverActivities])
  const stagnantDays = useStagnantDays()

  // Only open records: a converted lead's activities are copied to its opportunity by the server,
  // so counting the lead's copy too would list the same activity twice.
  const openActivities = useMemo(() => {
    const open = new Set([...openLeadIds, ...openOpportunityIds])
    return serverActivities.filter((a) => isPendingActivity(a) && open.has(a.opportunityId || a.leadId))
  }, [serverActivities, openLeadIds, openOpportunityIds])
  const overdueCount = openActivities.filter((a) => a.scheduleDate && a.scheduleDate < todayIso).length
  const leadRows = useMemo(() => leadPipeline(leads, leadStages), [leads, leadStages])
  const opportunityRows = useMemo(() => opportunityPipeline(opportunities, opportunityStages), [opportunities, opportunityStages])
  const leadAttention = useMemo(
    () => leadsRequiringAttention(leads, grouped.byLead, today, stagnantDays),
    [leads, grouped, today, stagnantDays],
  )
  const opportunityAttention = useMemo(
    () => opportunitiesRequiringAttention(opportunities, grouped.byOpportunity, today, stagnantDays),
    [opportunities, grouped, today, stagnantDays],
  )
  const closures = useMemo(
    () => closuresThisMonth(opportunities, grouped.byOpportunity, today),
    [opportunities, grouped, today],
  )
  const months = useMemo(() => lastSixMonthsSales(opportunities, today), [opportunities, today])

  const openLeadCount = leadRows.reduce((s, r) => s + r.count, 0)
  const openOpportunityCount = opportunityRows.reduce((s, r) => s + r.count, 0)

  const summary = [
    {
      label: 'Open Activities',
      value: String(openActivities.length),
      sub: overdueCount ? `${overdueCount} overdue` : 'none overdue',
      alert: overdueCount > 0,
      target: 'dash-activities',
      loading: activityLoad.loading,
    },
    {
      label: 'Need Attention',
      value: String(leadAttention.length + opportunityAttention.length),
      sub: `${leadAttention.length} leads · ${opportunityAttention.length} opps`,
      alert: leadAttention.length + opportunityAttention.length > 0,
      target: 'dash-attention',
      loading: activityLoad.loading,
    },
    { label: 'Open Leads', value: String(openLeadCount), sub: 'in pipeline', target: 'dash-pipeline', loading: leadSync.loading || leadMastersLoading },
    {
      label: 'Open Opportunities',
      value: String(openOpportunityCount),
      sub: `Weighted ${formatMoneyTotals(opportunityRows.flatMap((r) => r.weighted))}`,
      target: 'dash-pipeline',
      loading: oppSync.loading || oppMastersLoading,
    },
    {
      label: 'Closing This Month',
      value: String(closures.length),
      sub: closures.length
        ? formatMoneyTotals(closures.map((r) => ({ value: r.opportunity.dealValue, currency: r.opportunity.valueCurrency })))
        : 'no closures due',
      target: 'dash-closure',
      loading: oppSync.loading,
    },
  ]

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function retryAll() {
    retryLeads()
    retryOpportunities()
    activityLoad.retry()
  }

  return (
    <div className="page-gutter space-y-4 py-4">
      <PageHeader title="Sales Dashboard" subtitle={`Today: ${formatDate(today)}`} />

      <SpectrumRequiredNotice what="Dashboard figures" />

      {activityLoad.failed > 0 && !activityLoad.loading ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-line bg-warning-soft px-4 py-2.5 text-xs text-ink" role="status">
          <span>
            Activities could not be loaded for {activityLoad.failed} record{activityLoad.failed === 1 ? '' : 's'}; activity figures may be
            incomplete.
          </span>
          <Button variant="secondary" onClick={activityLoad.retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {summary.every((s) => s.loading) ? (
          <SkeletonStatCards count={5} />
        ) : (
          summary.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => scrollTo(s.target)}
              className="min-w-0 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <p className="mb-1 text-xs font-semibold text-ink-muted">{s.label}</p>
              {s.loading ? (
                <div className="skeleton my-1.5" style={{ height: 22, width: '40%' }} />
              ) : (
                <p className={`font-display text-2xl font-bold tabular-nums ${s.alert ? 'text-accent' : 'text-ink'}`}>{s.value}</p>
              )}
              <p className="mt-0.5 truncate text-xs text-ink-faint" title={s.sub}>
                {s.loading ? ' ' : s.sub}
              </p>
            </button>
          ))
        )}
      </div>

      {/* 1. Open activities */}
      <div id="dash-activities" className="scroll-mt-4">
        <Section
          id="dash-activities-title"
          title="Open Activities"
          subtitle="Pending activities on your leads and opportunities, in stage sequence, then by date. Click a row to update it."
          loading={activityLoad.loading}
          error={leadSync.error || oppSync.error}
          onRetry={retryAll}
          skeletonRows={5}
        >
          <OpenActivitiesTable
            activities={openActivities}
            todayIso={todayIso}
            sequenceOf={activitySequence}
            onOpenActivity={(a) => {
              setEditing(a)
              setNotesOnly(false)
            }}
            onOpenLead={onOpenLead}
            onOpenOpportunity={onOpenOpportunity}
          />
        </Section>
      </div>

      {/* 2. Pipelines */}
      <div id="dash-pipeline" className="grid scroll-mt-4 grid-cols-1 gap-4 xl:grid-cols-2">
        <Section
          id="dash-lead-pipeline"
          title="Lead Pipeline"
          subtitle="Open leads by stage (On Hold, Cold and closed leads excluded). Click a stage to see its leads."
          loading={leadSync.loading || leadMastersLoading}
          error={leadError}
          onRetry={retryLeads}
          skeletonRows={6}
        >
          <LeadPipelineTable rows={leadRows} onStage={onLeadStage} />
        </Section>
        <Section
          id="dash-opp-pipeline"
          title="Opportunity Pipeline"
          subtitle="Open opportunities by stage. Weighted value = value × stage weightage."
          loading={oppSync.loading || oppMastersLoading}
          error={oppError}
          onRetry={retryOpportunities}
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
          subtitle={`Open leads with no activity, an overdue activity, or no change for over ${stagnantDays} days.`}
          loading={leadSync.loading || activityLoad.loading}
          error={leadError}
          onRetry={retryAll}
        >
          <LeadsAttentionTable rows={leadAttention} stagnantDays={stagnantDays} todayIso={todayIso} stageColor={leadStageColor} onOpenLead={onOpenLead} />
        </Section>
        <Section
          id="dash-opp-attention"
          title="Opportunities Requiring Attention"
          subtitle={`Open opportunities with no activity, an overdue activity, or no change for over ${stagnantDays} days.`}
          loading={oppSync.loading || oppMastersLoading || activityLoad.loading}
          error={oppError}
          onRetry={retryAll}
        >
          <OpportunitiesAttentionTable
            rows={opportunityAttention}
            stagnantDays={stagnantDays}
            todayIso={todayIso}
            stageColor={opportunityStageColor}
            onOpenOpportunity={onOpenOpportunity}
          />
        </Section>
      </div>

      {/* 4. Expected closure this month */}
      <div id="dash-closure" className="scroll-mt-4">
        <Section
          id="dash-closure-title"
          title="Expected Closure This Month"
          subtitle={`Open opportunities expected to close ${formatDate(month.from)} – ${formatDate(month.to)}.`}
          loading={oppSync.loading || activityLoad.loading}
          error={oppError}
          onRetry={retryAll}
        >
          <ClosureThisMonthTable
            rows={closures}
            todayIso={todayIso}
            onOpenOpportunity={onOpenOpportunity}
            onOpenActivity={(a) => {
              setEditing(a)
              setNotesOnly(true)
            }}
          />
        </Section>
      </div>

      {/* 5. Last six months */}
      <Section
        id="dash-six-months"
        title="Last 6 Months Sales"
        subtitle="Won / lost months use the date the opportunity was last updated."
        loading={oppSync.loading}
        error={oppSync.error}
        onRetry={() => void oppSync.retry()}
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
              if (ok) onToast?.('success', 'Activity Updated', `"${a.subject}" has been updated.`)
            })
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
