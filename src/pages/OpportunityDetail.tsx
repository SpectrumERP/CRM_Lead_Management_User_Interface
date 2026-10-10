import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  dealStageClass,
  formatOpportunityStage,
  opportunityStatusClass,
  type DealStage,
  type Opportunity,
} from '../data/opportunities'
import { useCrmActions, useCrmSelector } from '../contexts/CrmStoreContext'
import { useConfirm } from '../contexts/ConfirmContext'
import { opportunityNoFromId, refreshServerOpportunity } from '../api/opportunitySync'
import { bySequence } from '../api/fillValues'
import { useOpportunityFillValues } from '../components/useOpportunityFillValues'
import { stageBadgeStyle, useOpportunityStageColors, withAlpha } from '../components/useOpportunityStageColors'
import { Button, Card, ChoiceGroup, CountBadge, IconTooltip, Spinner } from '../ui'
import type { ToastType } from '../components/Toast'
import ActivityDrawer from '../components/ActivityDrawer'
import { PagedTimeline } from '../components/RecordTimeline'
import { EmptyIcons, EmptyState } from '../components/CRMStates'
import { RecordNotesPanel } from '../components/LeadNotes'
import {
  OpportunityIdentityEdit,
  OpportunitySummaryEdit,
  type OppFieldKey,
} from '../components/OpportunityInlineEdit'
import { formatDateTime, type Activity } from '../data/activities'
import { formatMoney } from '../data/leads'
import { useAuth } from '../auth/AuthContext'
import { usePendingData } from '../api/pendingApiStore'
import { changeOpportunityStatus, opportunityOrder, statusRule, type StatusOption } from '../api/statusChange'
import StatusChangeDialog from '../components/StatusChangeDialog'
import StatusHistory from '../components/StatusHistory'
import ActivityAttachments from '../components/ActivityAttachments'
import { formatDate } from '../utils/dateFormat'

/** Same tabs as the lead view (its Emails tab is hidden there too). */
const DETAIL_TABS = ['Internal Notes / Observations', 'Timeline'] as const
type DetailTab = (typeof DETAIL_TABS)[number]

interface OpportunityDetailProps {
  opportunityId: string
  onBack: () => void
  onEdit: (id: string) => void
  onViewLead?: (id: string) => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}

function dealTrackTone(stage: string): {
  fill: string
  doneDot: string
  activeDot: string
  label: string
  wave: string
} {
  const tones: Record<string, { fill: string; doneDot: string; activeDot: string; label: string; wave: string }> = {
    Qualification: {
      fill: 'bg-primary',
      doneDot: 'border-primary bg-primary group-hover:ring-primary/15',
      activeDot: 'border-primary bg-surface ring-4 ring-primary/25',
      label: 'text-primary',
      wave: 'border-primary/35',
    },
    Proposal: {
      fill: 'bg-warning',
      doneDot: 'border-warning bg-warning group-hover:ring-warning/15',
      activeDot: 'border-warning bg-surface ring-4 ring-warning/25',
      label: 'text-warning',
      wave: 'border-warning/35',
    },
    Negotiation: {
      fill: 'bg-teal',
      doneDot: 'border-teal bg-teal group-hover:ring-teal/15',
      activeDot: 'border-teal bg-surface ring-4 ring-teal/25',
      label: 'text-teal',
      wave: 'border-teal/35',
    },
    Commitment: {
      fill: 'bg-purple',
      doneDot: 'border-purple bg-purple group-hover:ring-purple/15',
      activeDot: 'border-purple bg-surface ring-4 ring-purple/25',
      label: 'text-purple',
      wave: 'border-purple/35',
    },
    'Closed Won': {
      fill: 'bg-success',
      doneDot: 'border-success bg-success group-hover:ring-success/15',
      activeDot: 'border-success bg-surface ring-4 ring-success/25',
      label: 'text-success',
      wave: 'border-success/35',
    },
    'Closed Lost': {
      fill: 'bg-accent',
      doneDot: 'border-accent bg-accent group-hover:ring-accent/15',
      activeDot: 'border-accent bg-surface ring-4 ring-accent/25',
      label: 'text-accent',
      wave: 'border-accent/35',
    },
  }
  // Server stage names may differ ("Won", "Deal Lost"…) — colour those by meaning.
  const byMeaning = /\bwon\b/i.test(stage) ? tones['Closed Won'] : /\blost\b/i.test(stage) ? tones['Closed Lost'] : undefined
  return (
    tones[stage] ?? byMeaning ?? {
      fill: 'bg-primary',
      doneDot: 'border-primary bg-primary group-hover:ring-primary/15',
      activeDot: 'border-primary bg-surface ring-4 ring-primary/25',
      label: 'text-primary',
      wave: 'border-primary/35',
    }
  )
}

function DealStageTrack({
  stages,
  current,
  colorFor,
}: {
  stages: readonly string[]
  current: string
  /** Server `colorCoding` per stage; stages without one use the built-in tones. */
  colorFor?: (stage: string) => string | undefined
}) {
  const idx = Math.max(0, stages.indexOf(current))
  const count = Math.max(stages.length, 1)
  const progress = count <= 1 ? 1 : idx / (count - 1)
  const fillMs = 360 + idx * 160
  const stepMs = idx === 0 ? 0 : fillMs / idx
  const currentTone = dealTrackTone(current)
  const currentHex = colorFor?.(current)

  return (
    <div
      key={`${current}-${stages.join('|')}`}
      className="stage-track relative min-w-[36rem]"
      style={{ ['--stage-cols' as string]: count }}
    >
      <div className="stage-track-rail" aria-hidden="true">
        <div
          className={`stage-progress-fill ${currentHex ? '' : currentTone.fill}`}
          style={{ width: `${progress * 100}%`, animationDuration: `${fillMs}ms`, ...(currentHex ? { backgroundColor: currentHex } : {}) }}
        />
      </div>
      <ol
        className="relative z-[1] grid w-full min-w-[36rem]"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        aria-label="Deal stage progress"
      >
        {stages.map((name, i) => {
          const done = i < idx
          const active = i === idx
          const tone = dealTrackTone(name)
          const hex = colorFor?.(name)
          const dotStyle = !hex
            ? undefined
            : active
              ? { borderColor: hex, backgroundColor: 'var(--color-surface, #fff)', boxShadow: `0 0 0 4px ${withAlpha(hex, 0.25)}` }
              : done
                ? { borderColor: hex, backgroundColor: hex }
                : undefined
          const tip = active ? `Current stage: ${name}` : done ? `Completed: ${name}` : `Upcoming: ${name}`
          const delayMs = i <= idx ? i * stepMs : fillMs
          return (
            <li key={name} className="min-w-0 overflow-visible">
              <IconTooltip label={tip} className="w-full">
                <div className="group flex w-full flex-col items-center gap-1.5 px-0.5 py-1 text-center">
                  <span className="flex h-3.5 w-full items-center justify-center overflow-visible" aria-hidden="true">
                    <span
                      className={`stage-dot-in relative z-[1] h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out ${
                        active
                          ? (hex ? '' : tone.activeDot)
                          : done
                            ? (hex ? '' : tone.doneDot)
                            : 'border-line bg-line'
                      }`}
                      style={{ animationDelay: `${delayMs}ms`, ...dotStyle }}
                      aria-current={active ? 'step' : undefined}
                    >
                      {active ? (
                        <>
                          <span
                            className={`stage-wave-ring ${hex ? '' : tone.wave}`}
                            style={{ animationDelay: `${fillMs}ms`, ...(hex ? { borderColor: withAlpha(hex, 0.35) } : {}) }}
                          />
                          <span
                            className={`stage-wave-ring ${hex ? '' : tone.wave}`}
                            style={{ animationDelay: `${fillMs + 1200}ms`, ...(hex ? { borderColor: withAlpha(hex, 0.35) } : {}) }}
                          />
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className={`stage-label-in max-w-full text-center text-xs leading-tight ${
                      active
                        ? `font-bold ${hex ? '' : tone.label}`
                        : done
                          ? `font-semibold ${hex ? '' : tone.label} opacity-80`
                          : 'font-medium text-ink-faint'
                    }`}
                    style={{ animationDelay: `${delayMs}ms`, ...(hex && (active || done) ? { color: hex } : {}) }}
                  >
                    {name}
                  </span>
                </div>
              </IconTooltip>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function HeaderFact({
  label,
  value,
  hint,
  tone,
  toneStyle,
  avatar,
  onEdit,
}: {
  label: string
  value: string
  hint: string
  tone: string
  /** Inline colours (e.g. a server stage colour) — override `tone`. */
  toneStyle?: CSSProperties
  avatar?: boolean
  onEdit?: () => void
}) {
  const className = `group flex min-w-0 w-full items-center gap-3 px-4 py-3 text-left ${
    onEdit
      ? 'cursor-pointer transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary'
      : ''
  }`
  const mark = avatar ? (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-surface">
      {(value.trim().charAt(0) || '?').toUpperCase()}
    </span>
  ) : (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneStyle ? '' : tone}`}
      style={toneStyle}
      aria-hidden="true"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-current" />
    </span>
  )
  const body = (
    <>
      {mark}
      <span className="min-w-0 flex-1">
        <span className="form-label !mb-0 block">{label}</span>
        <span className="block truncate text-sm font-bold leading-tight text-ink">{value}</span>
        <span className="block truncate text-[11px] text-ink-faint">{hint}</span>
      </span>
      {onEdit ? (
        <span
          className="inline-flex shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100"
          aria-hidden="true"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </span>
      ) : null}
    </>
  )
  if (onEdit) {
    return (
      <button type="button" className={className} aria-label={`Edit ${label}: ${value}. ${hint}`} onClick={onEdit}>
        {body}
      </button>
    )
  }
  return (
    <div className={className} aria-label={`${label}: ${value}`}>
      {body}
    </div>
  )
}

export default function OpportunityDetail({
  opportunityId,
  onBack,
  onEdit,
  onViewLead,
  onToast,
}: OpportunityDetailProps) {
  const { addActivity, removeActivity, patchActivity } = useCrmActions()
  const confirm = useConfirm()
  // Server opportunities only — in-app sample records are not shown.
  const opportunity = useCrmSelector((state) =>
    state.opportunities.find((item) => item.id === opportunityId && item.spectrum),
  ) as Opportunity | undefined
  const activities = useCrmSelector((state) => state.activities)
  const noteCount = useCrmSelector((state) => state.notes.filter((item) => item.relatedLeadId === opportunityId).length)
  // Server opportunity → the stage track follows the server's stages (fill values, by sequence).
  const { values: oppFill } = useOpportunityFillValues()
  const stageColor = useOpportunityStageColors()
  const trackStages: readonly string[] = oppFill ? bySequence(oppFill.opportunityStages).map((item) => item.opportunityStageName) : []
  // Server opportunity (id SO-…): reload it from load-data — that includes its own activities, so no
  // lead request is needed to view it.
  const serverOpportunityNo = opportunityNoFromId(opportunityId)
  const [serverRefresh, setServerRefresh] = useState<'idle' | 'loading' | 'done' | 'failed'>(serverOpportunityNo ? 'loading' : 'idle')
  const [refreshError, setRefreshError] = useState<string | null>(null)
  useEffect(() => {
    if (!serverOpportunityNo) return
    let cancelled = false
    setServerRefresh('loading')
    refreshServerOpportunity(serverOpportunityNo)
      .then(() => {
        if (!cancelled) setServerRefresh('done')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setServerRefresh('failed')
        setRefreshError(err instanceof Error ? err.message : 'Could not load the opportunity.')
      })
    return () => { cancelled = true }
  }, [serverOpportunityNo])
  const [activityScope, setActivityScope] = useState<'open' | 'all'>('open')
  const [showActivity, setShowActivity] = useState(false)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [editingField, setEditingField] = useState<OppFieldKey | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>(DETAIL_TABS[0])
  const [showStatusChange, setShowStatusChange] = useState(false)
  const pending = usePendingData()
  const { user } = useAuth()
  const statusOptions: StatusOption[] = (oppFill?.opportunityStatuses ?? []).map((s) => ({
    no: s.opportunityStatusNo,
    name: s.opportunityStatusName,
    isRemarkMandatory: s.isRemarkMandatory,
    isWon: s.isWon,
  }))

  const relatedActivities = useMemo(() => {
    if (!opportunity) return []
    // The opportunity's own activities (from its load-data).
    return activities.filter((item) => item.opportunityId === opportunity.id)
  }, [activities, opportunity])

  const openActivities = useMemo(
    // Open = not yet closed or completed.
    () => relatedActivities.filter((item) => item.status === 'Pending'),
    [relatedActivities],
  )
  const visibleActivities = activityScope === 'open' ? openActivities : relatedActivities

  /** Server opportunities → delete-activity-detail, then the opportunity reloads (the row leaves the list). */
  async function deleteActivity(item: Activity) {
    const ok = await confirm({
      title: 'Delete Activity',
      message: `Delete "${item.subject}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    if (await removeActivity(item.id)) onToast?.('info', 'Activity Deleted', `"${item.subject}" has been deleted.`)
  }

  if (!opportunity && serverRefresh === 'loading') {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-canvas">
        <Spinner label="Loading opportunity" />
      </div>
    )
  }

  if (!opportunity) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-canvas">
        <div className="page-gutter pt-4">
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Opportunities
          </button>
        </div>
        <div className="page-gutter py-6">
          <p className="text-sm text-ink-muted">{refreshError ?? 'Opportunity not found.'}</p>
        </div>
      </div>
    )
  }

  const stage = opportunity.dealStage as DealStage
  // Won → its Order Value / Order Date under the status.
  const currentStatus = statusOptions.find((s) => s.name.trim().toLowerCase() === opportunity.status.trim().toLowerCase())
  const order = statusRule('Opportunity', currentStatus, pending).isWon ? opportunityOrder(opportunity, pending) : undefined

  return (
    <div className="min-h-full bg-canvas">
      <div className="page-gutter pt-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Opportunities
        </button>
      </div>

      <div className="page-gutter space-y-3 pb-6">
        {/* Header card — Lead Detail style */}
        <Card className="overflow-hidden p-0">
          <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink to-primary text-lg font-bold text-surface">
                {opportunity.companyName.charAt(0)}
              </div>
              <div className="min-w-0">
                <OpportunityIdentityEdit
                  key={`${opportunity.id}-name`}
                  opportunity={opportunity}
                  editing={editingField}
                  onEdit={setEditingField}
                  onCancel={() => setEditingField(null)}
                  onToast={onToast}
                />
                <p className="mt-0.5 text-xs text-ink-muted">
                  <span className="font-mono font-semibold text-primary">{opportunity.id}</span>
                  <span className="mx-1.5">·</span>
                  {opportunity.companyName}
                  {opportunity.leadId ? (
                    <>
                      <span className="mx-1.5">·</span>
                      Lead{' '}
                      {onViewLead ? (
                        <button
                          type="button"
                          className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          onClick={() => onViewLead(opportunity.leadId!)}
                        >
                          {opportunity.leadId}
                        </button>
                      ) : (
                        <span className="font-mono">{opportunity.leadId}</span>
                      )}
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
              <Button variant="secondary" onClick={() => onEdit(opportunity.id)}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
              {opportunity.leadId && onViewLead ? (
                <Button variant="secondary" onClick={() => onViewLead(opportunity.leadId!)}>
                  View Lead
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-line border-t border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <HeaderFact
              label="Opportunity Stage"
              value={formatOpportunityStage(stage, opportunity.weightPercent)}
              hint="Where this deal sits in the pipeline"
              tone={dealStageClass(stage)}
              toneStyle={stageBadgeStyle(stageColor(stage))}
              onEdit={() => setEditingField('stage')}
            />
            <HeaderFact
              label="Opportunity Status"
              value={opportunity.status}
              hint={
                order
                  ? `Order ${formatMoney(order.orderValue, opportunity.valueCurrency)} · ${formatDate(order.orderDate)}`
                  : 'Whether work on this opportunity is active · click to change'
              }
              tone={opportunityStatusClass(opportunity.status)}
              // onEdit={opportunity.spectrum ? () => setShowStatusChange(true) : undefined}
            />
            <HeaderFact
              label="Opportunity Owner"
              value={opportunity.owner}
              hint="Who owns follow-up on this deal"
              tone="bg-surface text-ink border-line"
              avatar
              onEdit={() => setEditingField('owner')}
            />
          </div>

          <div className="overflow-x-auto border-t border-line px-4 py-3">
            {trackStages.length > 0 ? <DealStageTrack stages={trackStages} current={stage} colorFor={stageColor} /> : null}
          </div>
        </Card>

        {/* Opportunity details — Lead details style */}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-surface"
              aria-hidden="true"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </span>
            <h2 className="ui-title truncate text-sm tracking-tight">Opportunity details</h2>
          </div>

          <OpportunitySummaryEdit
            key={opportunity.id}
            opportunity={opportunity}
            editing={editingField}
            onEdit={setEditingField}
            onCancel={() => setEditingField(null)}
            onViewLead={onViewLead}
            onToast={onToast}
          />
        </Card>

        {/* Activities — Lead Detail style */}
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <ChoiceGroup
              name="opp-activity-scope"
              layout="wrap"
              value={activityScope}
              onChange={(value) => setActivityScope(value)}
              options={[
                { value: 'open', label: 'Open Activities', count: openActivities.length },
                { value: 'all', label: 'All Activities', count: relatedActivities.length },
              ]}
            />
            <Button
              variant="solid"
              className="inline-flex !min-h-8 items-center gap-1.5 !px-3 !py-1.5 text-xs"
              onClick={() => setShowActivity(true)}
            >
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Activity
            </Button>
          </div>
          <div className="p-4">
            {visibleActivities.length === 0 ? (
              <EmptyState
                icon={EmptyIcons.leads}
                title={activityScope === 'open' ? 'No open activities' : 'No activities yet'}
                subtitle="Log a call, task, or follow-up on this opportunity."
                action={{ label: 'Add Activity', onClick: () => setShowActivity(true) }}
              />
            ) : (
              <ul className="divide-y divide-line-subtle rounded-xl border border-line">
                {visibleActivities.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink">{item.subject}</p>
                      <p className="mt-0.5 text-[11px] text-ink-faint">
                        {item.type} · {formatDateTime(item.scheduleDate, item.scheduleTime)} · {item.assignedTo}
                      </p>
                      <ActivityAttachments files={item.attachments} className="mt-1.5" />
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="badge stage-contacted">{item.status}</span>
                      <IconTooltip label="Edit activity">
                        <Button variant="icon" className="!h-7 !w-7 hover:text-primary" aria-label={`Edit activity ${item.subject}`} onClick={() => setEditingActivity(item)}>
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Button>
                      </IconTooltip>
                      <IconTooltip label="Delete activity">
                        <Button variant="icon" className="!h-7 !w-7 hover:text-accent" aria-label={`Delete activity ${item.subject}`} onClick={() => void deleteActivity(item)}>
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </IconTooltip>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* ── Tabs bar — Lead Detail style ─────────────────────────────────────── */}
      <div className="shrink-0 border-y border-line bg-surface">
        <div className="page-gutter">
          <div className="flex min-w-0 items-center overflow-x-auto" role="tablist" aria-label="Opportunity detail sections">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink-soft'
                }`}
              >
                {tab}
                {tab === 'Internal Notes / Observations' && noteCount > 0 && (
                  <CountBadge value={noteCount} size="sm" tone="warning-soft" className="ml-1.5" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <div className="page-gutter py-4">
        {activeTab === 'Status History' && opportunity.spectrum ? (
          <StatusHistory
            record="Opportunity"
            recordNo={opportunity.spectrum.opportunityNo}
            currency={opportunity.valueCurrency}
            refreshKey={`${opportunity.status}:${opportunity.audit?.modifiedAt ?? ''}`}
          />
        ) : null}
        {activeTab === 'Internal Notes / Observations' && (
          // Saved through the opportunity notes API (save-notes-detail / delete-notes-detail).
          <RecordNotesPanel recordId={opportunity.id} recordName={opportunity.name} noun="opportunity" onToast={onToast} />
        )}
        {activeTab === 'Timeline' &&
          (opportunity.spectrum ? (
            // GET /api/crm/opportunities/timeline/{opportunityNo}, paged on scroll.
            <PagedTimeline
              record="opportunity"
              recordNo={opportunity.spectrum.opportunityNo}
              refreshKey={`${relatedActivities.length}:${noteCount}:${opportunity.dealStage}:${opportunity.status}:${opportunity.audit?.modifiedAt ?? ''}`}
              emptySubtitle="Timeline entries will appear as this opportunity progresses through stages."
            />
          ) : (
            <p className="text-xs text-ink-faint">The timeline is available for opportunities saved on the server.</p>
          ))}
      </div>

      {editingActivity ? (
        <ActivityDrawer
          preselectedLead={{
            id: opportunity.leadId || opportunity.id,
            name: opportunity.companyName,
            contact: opportunity.contactPerson,
          }}
          editing={editingActivity}
          onClose={() => setEditingActivity(null)}
          onSave={(activity) => {
            // Server opportunities → save-activity-detail with its number (an update), then it reloads.
            patchActivity(activity.id, { ...activity, opportunityId: opportunity.id })
            setEditingActivity(null)
            onToast?.('success', 'Activity Updated', `"${activity.subject}" has been updated.`)
          }}
        />
      ) : null}
      {showStatusChange ? (
        <StatusChangeDialog
          record="Opportunity"
          recordLabel={`Opportunity ${opportunity.spectrum?.code ?? opportunity.id} · ${opportunity.name}`}
          currentStatusName={opportunity.status}
          statuses={statusOptions}
          currencyLabel={opportunity.valueCurrency}
          changedBy={user?.name ?? ''}
          onClose={() => setShowStatusChange(false)}
          onSubmit={async (change) => {
            await changeOpportunityStatus(opportunity, change)
            onToast?.('success', 'Status Changed', `Opportunity status is now ${change.newStatus.name}.`)
          }}
        />
      ) : null}
      {showActivity ? (
        <ActivityDrawer
          forOpportunity
          preselectedLead={{
            id: opportunity.leadId || opportunity.id,
            name: opportunity.companyName,
            contact: opportunity.contactPerson,
          }}
          onClose={() => setShowActivity(false)}
          onSave={(activity) => {
            // Server opportunities keep their own activities (saved via the opportunity API).
            addActivity({ ...activity, opportunityId: opportunity.id })
            setShowActivity(false)
            onToast?.('success', 'Activity Logged', `"${activity.subject}" has been added.`)
          }}
        />
      ) : null}
    </div>
  )
}
