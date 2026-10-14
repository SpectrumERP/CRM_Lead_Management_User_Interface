import { useEffect, useMemo, useState } from "react"
import ActivityAttachments from "./ActivityAttachments"
import { Button, Card, ChoiceGroup, Spinner } from "../ui"
import { PersonContactCard } from "./PersonContactCard"
import { stopBubbleProps } from "../utils/events"
import type { Contact } from "../data/contacts"
import type { Lead } from "../data/leads"
import { type Activity, formatDateTime } from "../data/activities"
import { EmptyState, EmptyIcons } from "./CRMStates"
import ActivityDrawer from "./ActivityDrawer"
import OutcomeDialog from "./OutcomeDialog"
import type { ToastType } from "./Toast"
import { sameList, useCrmActions, useCrmSelector } from "../contexts/CrmStoreContext"
import { refreshServerLead } from "../api/leadSync"
import { useConfirm } from "../contexts/ConfirmContext"
import { toIsoDate, toTimeHHMM } from "../utils/dateFormat"

/**
 * Lead activity list (open / all), shared by the lead view and the lead form in edit mode.
 */

export function activityTypeTone(type: string): string {
  const tones: Record<string, string> = {
    Task: "bg-warning-soft text-warning",
    "Follow-up": "bg-success-soft text-success",
    "Phone Call": "bg-primary-soft text-primary",
    Meeting: "bg-purple-soft text-purple",
    "Customer Visit": "bg-warning-soft text-warning",
    "Online Meeting": "bg-primary-soft text-primary",
    "Requirement Discussion": "bg-success-soft text-success",
    "Commercial Discussion": "bg-accent-soft text-accent",
    Negotiation: "bg-purple-soft text-purple",
    "Document Submission": "bg-surface-hover text-ink-soft",
    Other: "bg-surface-hover text-ink-muted",
  }
  return tones[type] ?? tones.Other
}

export function activityStatusTone(status: string): string {
  if (status === "Completed") return "bg-success-soft text-success"
  if (status === "Closed") return "bg-surface-hover text-ink-soft"
  if (status === "Cancelled") return "bg-accent-soft text-accent"
  return "bg-warning-soft text-warning"
}

// ─── Tab: Activities ──────────────────────────────────────────────────────────
export function ActivityTypeGlyph({ type }: { type: string }) {
  const common = {
    width: 12,
    height: 12,
    fill: "none" as const,
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 2,
    "aria-hidden": true as const,
  }
  if (type === "Phone Call") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.95.68l1.5 4.49a1 1 0 01-.5 1.21l-2.26 1.13a11.04 11.04 0 005.52 5.52l1.13-2.26a1 1 0 011.21-.5l4.49 1.5a1 1 0 01.68.95V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z" />
      </svg>
    )
  }
  if (type.includes("Meeting") || type === "Customer Visit") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
  if (type === "Document Submission") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }
  if (type === "Commercial Discussion" || type === "Negotiation") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (type === "Follow-up") {
    return (
      <svg {...common}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

export function ActivityCard({
  activity,
  contacts = [],
  expanded,
  onToggle,
  onFollowUp,
  onMarkComplete,
  onDelete,
  onEdit,
  readOnly = false,
}: {
  activity: Activity
  /** Locked lead: no Mark Complete / follow-up / edit / delete. */
  readOnly?: boolean
  contacts?: Contact[]
  expanded: boolean
  onToggle: () => void
  onFollowUp: (a: Activity) => void
  onMarkComplete: (a: Activity) => void
  onDelete?: (a: Activity) => void
  onEdit?: (a: Activity) => void
}) {
  const typeTone = activityTypeTone(activity.type)
  const statusTone = activityStatusTone(activity.status)
  const pending = activity.status === "Pending"
  const finished = activity.status === "Completed" || activity.status === "Closed"
  const when = formatDateTime(activity.scheduleDate, activity.scheduleTime)

  return (
    <li
      className={`group/activity border-b border-line-subtle last:border-b-0 transition-colors duration-200 ${
        expanded ? "bg-primary-soft/25" : "bg-surface hover:bg-surface-muted/70"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onToggle()
          }
        }}
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${typeTone}`}
          aria-hidden="true"
        >
          <ActivityTypeGlyph type={activity.type} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`shrink-0 text-[9px] font-bold tracking-wide ${typeTone.replace(/\bbg-\S+\s*/g, "").trim()}`}>
              {activity.type}
            </span>
            <h3 className="min-w-0 truncate text-[12px] font-semibold text-ink">{activity.subject}</h3>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${statusTone}`}>
          {activity.status}
        </span>
      </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[10px] leading-snug text-ink-muted">
            <span className="truncate">{when}</span>
            <span className="text-ink-faint" aria-hidden="true">·</span>
            <span className="inline-flex min-w-0 items-center gap-1" {...stopBubbleProps}>
              <PersonContactCard name={activity.assignedTo} />
            </span>
            {activity.reminder !== "None" ? (
              <>
                <span className="text-ink-faint" aria-hidden="true">·</span>
                <span className="truncate">{activity.reminder}</span>
              </>
            ) : null}
          </div>
        </div>

        <svg
          width="12"
          height="12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          className={`shrink-0 text-ink-faint transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            expanded ? "rotate-180 text-primary" : ""
          }`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      <div
        className="accordion-panel"
        data-open={expanded ? "true" : "false"}
        aria-hidden={!expanded}
        {...(!expanded ? { inert: true } : {})}
      >
        <div className="accordion-panel-inner">
          <div className="accordion-panel-body border-t border-line-subtle bg-surface-muted/50 px-3 pb-3 pl-[3.25rem] pt-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
                <p className="text-[9px] font-bold tracking-[0.08em] text-ink-faint">Contact</p>
                <div className="mt-0.5 min-w-0">
                  {activity.contactPerson ? (
                    <PersonContactCard name={activity.contactPerson} contacts={contacts} />
                  ) : (
                    <span className="text-[11px] font-semibold text-ink">—</span>
                  )}
                </div>
                  </div>
              <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
                <p className="text-[9px] font-bold  tracking-[0.08em] text-ink-faint">Reminder</p>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-ink">
                  {activity.reminder === "None" ? "No reminder" : activity.reminder}
                </p>
                  </div>
                    </div>

            <div className="mt-2.5">
              <p className="mb-1 text-[9px] font-bold  tracking-[0.08em] text-ink-faint">Notes</p>
              <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
                {activity.notes ? (
                  <p className="text-[12px] leading-relaxed text-ink-soft">{activity.notes}</p>
                ) : (
                  <p className="text-[11px] text-ink-faint">No notes for this activity.</p>
                )}
              </div>
            </div>

            <ActivityAttachments activity={activity} className="mt-2" />

            {activity.status === "Completed" && activity.outcome ? (
              <div className="mt-2.5 rounded-lg border border-success-line bg-success-soft px-2.5 py-2">
                <p className="text-[9px] font-bold  tracking-[0.08em] text-success">Completion Remark</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-success">
                  {activity.outcome}
                  {activity.completeDate ? (
                    <span className="ml-1 font-medium text-success/75">
                      · {formatDateTime(activity.completeDate, activity.completeTime)}
                    </span>
                  ) : null}
                </p>
              </div>
            ) : null}

            {activity.status === "Closed" ? (
              <div className="mt-2.5 rounded-lg border border-line bg-surface px-2.5 py-2">
                <p className="text-[9px] font-bold tracking-[0.08em] text-ink-faint">Closed</p>
                <p className="mt-0.5 text-[12px] font-semibold text-ink">
                  {activity.closureDate ? formatDateTime(activity.closureDate, "") : "Closure date not recorded"}
                </p>
              </div>
            ) : null}

            {!readOnly && (pending || finished || onDelete || onEdit) ? (
              <div className="mt-3 flex items-center justify-end gap-2 border-t border-line-subtle pt-2.5">
                {onEdit ? (
                  <Button variant="secondary" className="!min-h-7 !px-3 !py-1 text-[11px]" onClick={() => onEdit(activity)}>
                    Edit
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button
                    variant="secondary"
                    className="!min-h-7 !px-3 !py-1 text-[11px] text-accent"
                    onClick={() => onDelete(activity)}
                  >
                    Delete
                  </Button>
                ) : null}
                {!pending && !finished ? null : pending ? (
                  <Button
                    variant="solid"
                    className="!min-h-7 !bg-success !px-3 !py-1 text-[11px] hover:!bg-success-strong"
                    onClick={() => onMarkComplete(activity)}
                  >
                        Mark Complete
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="!min-h-7 !px-3 !py-1 text-[11px]"
                    onClick={() => onFollowUp(activity)}
                  >
                    Create Follow-up
                  </Button>
                    )}
                  </div>
            ) : null}
                </div>
              </div>
            </div>
    </li>
  )
}

export function ActivitiesTab({
  activities,
  contacts = [],
  scope,
  onAdd,
  onFollowUp,
  onMarkComplete,
  onDelete,
  onEdit,
  readOnly = false,
}: {
  /** Locked lead: activities are shown only (no add / complete / follow-up / edit / delete). */
  readOnly?: boolean
  activities: Activity[]
  contacts?: Contact[]
  scope: "open" | "all"
  onAdd: () => void
  onFollowUp: (a: Activity) => void
  onMarkComplete: (a: Activity) => void
  /** Shown on each expanded activity when given. */
  onDelete?: (a: Activity) => void
  onEdit?: (a: Activity) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const emptyTitle = scope === "open" ? "No open activities" : "No activities yet"
  const emptySubtitle =
    scope === "open"
      ? "Open tasks and follow-ups for this lead will show here."
      : "Log calls, emails and follow-ups to track engagement on this lead."

  useEffect(() => {
    setOpenId(null)
  }, [scope])

  useEffect(() => {
    setOpenId((prev) => (prev && activities.some((item) => item.id === prev) ? prev : null))
  }, [activities])

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={EmptyIcons.notes}
        title={emptyTitle}
        subtitle={emptySubtitle}
        action={readOnly ? undefined : { label: "Add Activity", onClick: onAdd }}
      />
    )
  }

  return (
    <ul className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="Activities">
      {activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          contacts={contacts}
          expanded={openId === activity.id}
          onToggle={() => setOpenId((prev) => (prev === activity.id ? null : activity.id))}
          onFollowUp={onFollowUp}
          onMarkComplete={onMarkComplete}
          onDelete={onDelete}
          onEdit={onEdit}
          readOnly={readOnly}
        />
      ))}
    </ul>
  )
}


// ─── Panel (list + add / complete / follow-up) ───────────────────────────────

export interface LeadActivitiesPanelProps {
  lead: Lead
  onToast?: (type: ToastType, title: string, message?: string) => void
}

/**
 * The lead view's activity panel as a self-contained block (used by the lead form in edit mode).
 * Changes are saved straight away — server leads through `save-activity-detail` — not with the form.
 */
export function LeadActivitiesPanel({ lead, onToast }: LeadActivitiesPanelProps) {
  const { addActivity, patchActivity, removeActivity } = useCrmActions()
  const confirm = useConfirm()
  const stored = useCrmSelector((state) => state.activities.filter((a) => a.leadId === lead.id), sameList)
  // Shown until the server reload brings the saved rows (which then replace them).
  const [pending, setPending] = useState<Activity[]>([])
  const [patched, setPatched] = useState<Record<string, Partial<Activity>>>({})
  const [scope, setScope] = useState<"open" | "all">("open")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [followUpFrom, setFollowUpFrom] = useState<Activity | null>(null)
  const [completing, setCompleting] = useState<Activity | null>(null)
  const [editing, setEditing] = useState<Activity | null>(null)
  const leadNo = lead.spectrum?.leadNo
  const [loading, setLoading] = useState(Boolean(leadNo && !lead.spectrum?.detailLoaded))

  // A server lead opened straight into edit may not have its activities yet (load-data).
  useEffect(() => {
    if (!leadNo || lead.spectrum?.detailLoaded) return
    let cancelled = false
    refreshServerLead(leadNo)
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // Once per lead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadNo])

  useEffect(() => {
    setPending([])
    setPatched({})
  }, [stored])

  const activities = useMemo(
    () => [...pending, ...stored].map((a) => (patched[a.id] ? { ...a, ...patched[a.id] } : a)),
    [pending, stored, patched],
  )
  const open = activities.filter((a) => a.status === "Pending")
  const visible = scope === "all" ? activities : open

  async function remove(item: Activity) {
    if (pending.some((p) => p.id === item.id)) {
      onToast?.("info", "Still saving", "This activity is still being saved — try again in a moment.")
      return
    }
    const ok = await confirm({
      title: "Delete Activity",
      message: `Delete "${item.subject}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!ok) return
    // Server leads → delete-activity-detail, then the lead reloads (the row leaves the list).
    if (await removeActivity(item.id)) onToast?.("info", "Activity Deleted", `"${item.subject}" has been deleted.`)
  }

  function openDrawer(from: Activity | null) {
    setFollowUpFrom(from)
    setDrawerOpen(true)
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <ChoiceGroup
          name="lead-form-activity-scope"
          layout="wrap"
          value={scope}
          onChange={(value) => setScope(value)}
          options={[
            { value: "open", label: "Open Activities", count: open.length },
            { value: "all", label: "All Activities", count: activities.length },
          ]}
        />
        <Button variant="solid" className="inline-flex !min-h-8 items-center gap-1.5 !px-3 !py-1.5 text-xs" onClick={() => openDrawer(null)}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Activity
        </Button>
      </div>
      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-6"><Spinner label="Loading activities" /></div>
        ) : (
          <ActivitiesTab
            activities={visible}
            scope={scope}
            onAdd={() => openDrawer(null)}
            onFollowUp={(item) => openDrawer(item)}
            onMarkComplete={(item) => setCompleting(item)}
            onDelete={(item) => void remove(item)}
            onEdit={(item) => {
              if (pending.some((p) => p.id === item.id)) {
                onToast?.("info", "Still saving", "This activity is still being saved — try again in a moment.")
                return
              }
              setEditing(item)
            }}
          />
        )}
      </div>

      {editing ? (
        <ActivityDrawer
          preselectedLead={{ id: lead.id, name: lead.companyName, contact: lead.contactPerson }}
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            // Server leads → save-activity-detail with its number (an update), then the lead reloads.
            patchActivity(a.id, a)
            setPatched((prev) => ({ ...prev, [a.id]: a }))
            onToast?.("success", "Activity Updated", `"${a.subject}" has been updated.`)
          }}
        />
      ) : null}

      {drawerOpen ? (
        <ActivityDrawer
          preselectedLead={{ id: lead.id, name: lead.companyName, contact: lead.contactPerson }}
          followUpFrom={followUpFrom}
          onClose={() => { setDrawerOpen(false); setFollowUpFrom(null) }}
          onSave={(a) => {
            addActivity(a)
            setPending((prev) => [a, ...prev])
            setFollowUpFrom(null)
            onToast?.("success", "Activity Logged", `"${a.subject}" has been added.`)
          }}
        />
      ) : null}

      {completing ? (
        <OutcomeDialog
          title="Mark Activity Complete"
          label="Outcome / Result"
          placeholder="What was the result of this activity?"
          confirmLabel="Mark Complete"
          onClose={() => setCompleting(null)}
          summary={
            <>
              <p className="text-xs font-semibold text-ink-soft">{completing.type}</p>
              <p className="text-sm font-bold text-ink">{completing.subject}</p>
            </>
          }
          onConfirm={(outcome) => {
            const now = new Date()
            const completion = {
              status: "Completed" as const,
              outcome,
              completeDate: toIsoDate(now),
              completeTime: toTimeHHMM(now),
            }
            // Server leads → save-activity-detail (status Closed, outcome), then the lead reloads.
            patchActivity(completing.id, completion)
            setPatched((prev) => ({ ...prev, [completing.id]: completion }))
            onToast?.("success", "Activity Completed", `"${completing.subject}" marked as complete.`)
            setCompleting(null)
          }}
        />
      ) : null}
    </Card>
  )
}
