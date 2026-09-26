import { useMemo } from 'react'
import { formatINR, leadStagePalette } from '../data/leads'
import { api } from '../api/crm'
import { useApiQuery } from '../api/useApiQuery'
import { SkeletonStatCards, SkeletonPipelineRows, SkeletonActivityList } from '../components/CRMStates'
import { Button, Card, PageHeader, type StatTone } from '../ui'

interface DashboardProps {
  onNavigateLeads?: () => void
  onNavigateActivities?: () => void
  onNavigateMeetings?: () => void
  onNavigateBusinessEntities?: () => void
}

type DashTone = StatTone

const TONE_TEXT: Record<DashTone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  accent: 'text-accent',
  purple: 'text-purple',
  muted: 'text-ink-muted',
  ink: 'text-ink',
}

const TONE_SOFT: Record<DashTone, string> = {
  primary: 'bg-primary-soft',
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  accent: 'bg-accent-soft',
  purple: 'bg-purple-soft',
  muted: 'bg-surface-hover',
  ink: 'bg-surface-hover',
}

const TONE_BORDER_HOVER: Record<DashTone, string> = {
  primary: 'hover:border-primary hover:bg-primary-soft',
  success: 'hover:border-success hover:bg-success-soft',
  warning: 'hover:border-warning hover:bg-warning-soft',
  accent: 'hover:border-accent hover:bg-accent-soft',
  purple: 'hover:border-purple hover:bg-purple-soft',
  muted: 'hover:border-line hover:bg-surface-hover',
  ink: 'hover:border-ink hover:bg-surface-hover',
}

const TONE_AVATAR: Record<DashTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success-strong',
  warning: 'bg-warning',
  accent: 'bg-accent',
  purple: 'bg-purple',
  muted: 'bg-ink-muted',
  ink: 'bg-ink',
}

const recentActivity: Array<{ time: string; action: string; lead: string; by: string; tone: DashTone }> = [
  { time: '2h ago', action: 'Lead qualified', lead: 'TCS – ERP Suite', by: 'Priya Mehta', tone: 'primary' },
  { time: '4h ago', action: 'Follow-up scheduled', lead: 'Reliance Jio – BSS/OSS', by: 'Vikram Nair', tone: 'success' },
  { time: 'Yesterday', action: 'Requirement doc shared', lead: 'Sun Pharma – QMS', by: 'Priya Mehta', tone: 'warning' },
  { time: 'Yesterday', action: 'Lead created', lead: 'Godrej – HRMS', by: 'Arjun Patel', tone: 'primary' },
  { time: '2d ago', action: 'Demo call booked', lead: 'HDFC Bank – Core Banking', by: 'Meena Iyer', tone: 'accent' },
]

const topSalespeople: Array<{ name: string; leads: number; value: string; initials: string; tone: DashTone }> = [
  { name: 'Meena Iyer', leads: 48, value: '₹6.2 Cr', initials: 'MI', tone: 'accent' },
  { name: 'Vikram Nair', leads: 41, value: '₹5.1 Cr', initials: 'VN', tone: 'primary' },
  { name: 'Priya Mehta', leads: 38, value: '₹4.7 Cr', initials: 'PM', tone: 'success' },
  { name: 'Arjun Patel', leads: 29, value: '₹2.4 Cr', initials: 'AP', tone: 'purple' },
]

const STAGE_ORDER = [
  'New',
  'Contacted',
  'Requirement Identified',
  'Under Qualification',
  'Qualified',
  'Converted to Opportunity',
] as const

export default function Dashboard({
  onNavigateLeads,
  onNavigateActivities,
  onNavigateMeetings,
  onNavigateBusinessEntities,
}: DashboardProps) {
  const { data: snapshot, loading } = useApiQuery(() => api.crm.snapshot(), [])
  const leads = snapshot?.leads ?? []
  const activities = snapshot?.activities ?? []
  const meetings = snapshot?.meetings ?? []
  const contacts = snapshot?.contacts ?? []
  const entities = snapshot?.entities ?? []

  const metrics = useMemo(() => {
    const totalLeads = leads.length
    const openLeads = leads.filter((l) => l.leadStatus === 'Open').length
    const qualified = leads.filter((l) => l.leadStage === 'Qualified').length
    const converted = leads.filter((l) => l.leadStatus === 'Converted').length
    const pipelineValue = leads.reduce((s, l) => s + l.opportunityValue, 0)
    const avgDeal = totalLeads ? pipelineValue / totalLeads : 0
    const pendingActivities = activities.filter((a) => a.status === 'Pending').length
    const upcomingMeetings = meetings.filter((m) => m.status === 'Scheduled').length
    const stageData = STAGE_ORDER.map((stage) => ({
      stage,
      count: leads.filter((l) => l.leadStage === stage).length,
      color: leadStagePalette(stage).text,
      value: leads.filter((l) => l.leadStage === stage).reduce((s, l) => s + l.opportunityValue, 0),
    }))
    const pipelineTotal = stageData.reduce((s, d) => s + d.count, 0)
    return {
      totalLeads,
      openLeads,
      qualified,
      converted,
      pipelineValue,
      avgDeal,
      pendingActivities,
      upcomingMeetings,
      stageData,
      pipelineTotal,
    }
  }, [leads, activities, meetings])

  const {
    totalLeads,
    openLeads,
    qualified,
    converted,
    pipelineValue,
    avgDeal,
    pendingActivities,
    upcomingMeetings,
    stageData,
    pipelineTotal,
  } = metrics

  const stats: Array<{
    label: string
    value: string
    sub: string
    nav?: () => void
    tone: DashTone
  }> = [
    { label: 'Total Leads', value: String(totalLeads), sub: `${openLeads} open`, nav: onNavigateLeads, tone: 'primary' },
    { label: 'Qualified', value: String(qualified), sub: `of ${totalLeads} total`, nav: onNavigateLeads, tone: 'success' },
    {
      label: 'Converted',
      value: String(converted),
      sub: `${Math.round((converted / (totalLeads || 1)) * 100)}% conversion`,
      nav: onNavigateLeads,
      tone: 'accent',
    },
    { label: 'Activities Pending', value: String(pendingActivities), sub: 'awaiting action', nav: onNavigateActivities, tone: 'warning' },
    { label: 'Upcoming Meetings', value: String(upcomingMeetings), sub: 'scheduled', nav: onNavigateMeetings, tone: 'purple' },
    {
      label: 'Business Entities',
      value: String(entities.length),
      sub: `${contacts.length} contacts`,
      nav: onNavigateBusinessEntities,
      tone: 'ink',
    },
  ]

  const quickLinks = [
    { label: 'All Leads', desc: `${totalLeads} total leads`, icon: '⚡', tone: 'primary' as const, action: onNavigateLeads },
    { label: 'Activities', desc: `${pendingActivities} pending`, icon: '✓', tone: 'warning' as const, action: onNavigateActivities },
    { label: 'Meetings', desc: `${upcomingMeetings} upcoming`, icon: '📅', tone: 'purple' as const, action: onNavigateMeetings },
    { label: 'Business Entities', desc: `${entities.length} entities`, icon: '🏢', tone: 'success' as const, action: onNavigateBusinessEntities },
  ]

  return (
    <div className="page-gutter space-y-5 py-4">
      <PageHeader
        title="Sales Dashboard"
        subtitle="Phase 1 Lead Management · FY 2024–25"
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success-line bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
            Live · Updated just now
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {loading ? (
          <SkeletonStatCards count={6} />
        ) : (
          stats.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.nav}
              className={`min-w-0 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TONE_BORDER_HOVER[s.tone]}`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{s.label}</p>
              <p className={`font-display text-2xl font-bold ${TONE_TEXT[s.tone]}`}>{s.value}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{s.sub}</p>
            </button>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-br from-ink to-primary px-4 py-4 shadow-[0_4px_20px_rgba(41,85,163,0.25)] lg:px-5">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-surface/50">Total Pipeline Value</p>
          <p className="font-display text-3xl font-bold text-surface">{formatINR(pipelineValue)}</p>
          <p className="mt-1 text-xs text-surface/50">Avg. deal size: {formatINR(Math.round(avgDeal))}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="!border-surface/20 !bg-surface/10 !text-surface hover:!bg-surface/20"
          onClick={onNavigateLeads}
        >
          View All Leads
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-ink">Pipeline by Stage</h2>
            <button
              type="button"
              onClick={onNavigateLeads}
              className="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              View Leads →
            </button>
          </div>
          <div className="space-y-2.5">
            {loading ? (
              <SkeletonPipelineRows count={6} />
            ) : (
              stageData.map((d) => (
                <div key={d.stage} className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <span className="w-[88px] flex-shrink-0 truncate text-xs font-medium text-ink-soft lg:w-[130px]" title={d.stage}>
                    {d.stage}
                  </span>
                  <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-lg bg-surface-hover">
                    <div
                      className="flex h-full items-center rounded-lg px-2.5 transition-[width] duration-500 ease-out"
                      style={{
                        width:
                          pipelineTotal > 0
                            ? `${Math.max((d.count / pipelineTotal) * 100, d.count > 0 ? 8 : 0)}%`
                            : '0%',
                        background: `linear-gradient(90deg, ${d.color}cc, ${d.color})`,
                        minWidth: d.count > 0 ? 32 : 0,
                      }}
                    >
                      {d.count > 0 ? <span className="text-xs font-bold text-surface">{d.count}</span> : null}
                    </div>
                  </div>
                  <div className="w-[72px] flex-shrink-0 lg:w-[100px]">
                    <span className="truncate text-xs font-bold" style={{ color: d.color }}>
                      {formatINR(d.value)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex-1 p-5">
            <h2 className="mb-3 font-display text-sm font-bold text-ink">Top Salespeople</h2>
            <div className="space-y-2.5">
              {topSalespeople.map((r, i) => (
                <div key={r.name} className="flex items-center gap-2.5">
                  <span className="w-4 text-xs font-bold text-line-strong">{i + 1}</span>
                  <div
                    className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-surface ${TONE_AVATAR[r.tone]}`}
                  >
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{r.name}</p>
                    <p className="text-xs text-ink-faint">{r.leads} leads</p>
                  </div>
                  <span className="text-xs font-bold text-primary">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex-1 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-ink">Recent Activity</h2>
              <button
                type="button"
                onClick={onNavigateActivities}
                className="text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                View all →
              </button>
            </div>
            <div className="space-y-2.5">
              {loading ? (
                <SkeletonActivityList count={5} />
              ) : (
                recentActivity.map((a) => (
                  <div key={`${a.action}-${a.time}`} className="flex gap-2.5">
                    <div className="flex-shrink-0 pt-1">
                      <div className={`mt-0.5 h-2 w-2 rounded-full ${TONE_AVATAR[a.tone]}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-ink">{a.action}</p>
                      <p className="truncate text-xs text-ink-soft">{a.lead}</p>
                      <p className="text-xs text-ink-faint">
                        {a.by} · {a.time}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quickLinks.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={q.action}
            className={`flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${TONE_BORDER_HOVER[q.tone]}`}
          >
            <div
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg ${TONE_SOFT[q.tone]}`}
              aria-hidden="true"
            >
              {q.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-ink">{q.label}</p>
              <p className="text-xs text-ink-muted">{q.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
