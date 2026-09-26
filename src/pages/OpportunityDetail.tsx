import { useMemo, useState, type ReactNode } from 'react'
import {
  DEAL_STAGES,
  dealStageClass,
  formatOpportunityStage,
  opportunityStatusClass,
  type DealStage,
  type Opportunity,
} from '../data/opportunities'
import { useCrmActions, useCrmSelector } from '../contexts/CrmStoreContext'
import { Button, Card, ChoiceGroup, IconTooltip } from '../ui'
import type { ToastType } from '../components/Toast'
import ActivityDrawer from '../components/ActivityDrawer'
import { EmptyIcons, EmptyState } from '../components/CRMStates'
import {
  OpportunityIdentityEdit,
  OpportunitySummaryEdit,
  type OppFieldKey,
} from '../components/OpportunityInlineEdit'
import { formatDateTime } from '../data/activities'

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
  return (
    tones[stage] ?? {
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
}: {
  stages: readonly string[]
  current: string
}) {
  const idx = Math.max(0, stages.indexOf(current))
  const count = Math.max(stages.length, 1)
  const progress = count <= 1 ? 1 : idx / (count - 1)
  const fillMs = 360 + idx * 160
  const stepMs = idx === 0 ? 0 : fillMs / idx
  const currentTone = dealTrackTone(current)

  return (
    <div
      key={`${current}-${stages.join('|')}`}
      className="stage-track relative min-w-[36rem]"
      style={{ ['--stage-cols' as string]: count }}
    >
      <div className="stage-track-rail" aria-hidden="true">
        <div
          className={`stage-progress-fill ${currentTone.fill}`}
          style={{ width: `${progress * 100}%`, animationDuration: `${fillMs}ms` }}
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
                          ? tone.activeDot
                          : done
                            ? tone.doneDot
                            : 'border-line bg-line'
                      }`}
                      style={{ animationDelay: `${delayMs}ms` }}
                      aria-current={active ? 'step' : undefined}
                    >
                      {active ? (
                        <>
                          <span className={`stage-wave-ring ${tone.wave}`} style={{ animationDelay: `${fillMs}ms` }} />
                          <span
                            className={`stage-wave-ring ${tone.wave}`}
                            style={{ animationDelay: `${fillMs + 1200}ms` }}
                          />
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className={`stage-label-in max-w-full text-center text-xs leading-tight ${
                      active
                        ? `font-bold ${tone.label}`
                        : done
                          ? `font-semibold ${tone.label} opacity-80`
                          : 'font-medium text-ink-faint'
                    }`}
                    style={{ animationDelay: `${delayMs}ms` }}
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
  avatar,
  onEdit,
}: {
  label: string
  value: string
  hint: string
  tone: string
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
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${tone}`} aria-hidden="true">
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
  const { addActivity } = useCrmActions()
  const opportunity = useCrmSelector((state) =>
    state.opportunities.find((item) => item.id === opportunityId),
  ) as Opportunity | undefined
  const activities = useCrmSelector((state) => state.activities)
  const [activityScope, setActivityScope] = useState<'open' | 'all'>('open')
  const [showActivity, setShowActivity] = useState(false)
  const [editingField, setEditingField] = useState<OppFieldKey | null>(null)

  const relatedActivities = useMemo(() => {
    if (!opportunity) return []
    if (!opportunity.leadId) return []
    return activities.filter((item) => item.leadId === opportunity.leadId)
  }, [activities, opportunity])

  const openActivities = useMemo(
    () => relatedActivities.filter((item) => item.status !== 'Completed' && item.status !== 'Cancelled'),
    [relatedActivities],
  )
  const visibleActivities = activityScope === 'open' ? openActivities : relatedActivities

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
          <p className="text-sm text-ink-muted">Opportunity not found.</p>
        </div>
      </div>
    )
  }

  const stage = opportunity.dealStage as DealStage

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
              onEdit={() => setEditingField('stage')}
            />
            <HeaderFact
              label="Opportunity Status"
              value={opportunity.status}
              hint="Whether work on this opportunity is active"
              tone={opportunityStatusClass(opportunity.status)}
              onEdit={() => setEditingField('status')}
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
            <DealStageTrack stages={DEAL_STAGES} current={stage} />
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
                    </div>
                    <span className="badge stage-contacted">{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {showActivity ? (
        <ActivityDrawer
          preselectedLead={{
            id: opportunity.leadId || opportunity.id,
            name: opportunity.companyName,
            contact: opportunity.contactPerson,
          }}
          onClose={() => setShowActivity(false)}
          onSave={(activity) => {
            addActivity(activity)
            setShowActivity(false)
            onToast?.('success', 'Activity Logged', `"${activity.subject}" has been added.`)
          }}
        />
      ) : null}
    </div>
  )
}
