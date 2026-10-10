import { useState, useRef, useMemo, useEffect, type ReactNode } from "react"
import { Button, Card, ChoiceGroup, CountBadge, FormGrid, IconTooltip, TextAreaField, TextField } from "../ui"
import { PersonContactCard, findContactForLead } from "../components/PersonContactCard"
import OutcomeDialog from "../components/OutcomeDialog"
import FormDrawer from "../components/FormDrawer"
import { useAuth } from "../auth/AuthContext"
import {
  Lead,
  LeadStage,
  LeadStatus,
  formatLeadDate,
  getLeadRequirement,
  leadStageClass,
  leadStatusClass,
  normalizeOrgName,
  isLeadConverted,
  CRM_AS_OF,
} from "../data/leads"
import {
  BusinessEntity,
} from "../data/businessEntities"
import {
  Contact,
  initialsAvatar,
  avatarGradient,
} from "../data/contacts"
import { LeadIdentityEdit, LeadSummaryEdit, type FieldKey } from "../components/LeadInlineEdit"
import { sameList, useCrmActions, useCrmSelector } from "../contexts/CrmStoreContext"
import type { CrmEmail } from "../contexts/crmTypes"
import { api } from "../api/crm"
import { useApiQuery } from "../api/useApiQuery"
import { bySequence } from "../api/fillValues"
import { leadNoFromId, refreshServerLead } from "../api/leadSync"
import { useLeadFormFillValues } from "../components/useLeadFormFillValues"
import {
  Activity,
  formatDateTime,
} from "../data/activities"
import {
  Meeting,
  formatMeetingDateTime,
} from "../data/meetings"
import {
  formatFileSize,
  isImageDocument,
  readImagePreview,
  type CRMDocument,
  type DocFileType,
} from "../data/documents"
import { formatConversionStamp, type Opportunity } from "../data/opportunities"
import ActivityDrawer from "../components/ActivityDrawer"
import { ActivitiesTab, activityStatusTone, activityTypeTone } from "../components/LeadActivities"
import { InternalNotesTab, noteDateToInput, type LeadNote } from "../components/LeadNotes"
import { PagedTimeline, TimelineTab, timelineIconMeta, type TimelineOrder } from "../components/RecordTimeline"
import ConvertOpportunityDialog from "../components/ConvertOpportunityDialog"
import StatusChangeDialog from "../components/StatusChangeDialog"
import StatusHistory from "../components/StatusHistory"
import { changeLeadStatus, type StatusOption } from "../api/statusChange"
import MeetingDrawer from "../components/MeetingDrawer"
import ConfirmDialog from "../components/ConfirmDialog"
import { saveConfirm, useConfirm } from "../contexts/ConfirmContext"
import { ToastType } from "../components/Toast"
import {
  EmptyState,
  ErrorState,
  EmptyIcons,
  SkeletonOverviewCards,
} from "../components/CRMStates"
import { interpolate, PAGE_COPY } from "../constants/messages"
import { FIELD_LIMITS } from "../constants/fieldLimits"
import { formatDate, formatDateParts, formatTime, joinDateTime, parseDate, toIsoDate, toStoredStamp, toTimeHHMM } from "../utils/dateFormat"

type LocalDoc = {
  id: string
  name: string
  type: string
  size: string
  date: string
  uploader: string
  previewUrl?: string
}

function toLocalDoc(d: CRMDocument): LocalDoc {
  return {
    id: d.id,
    name: d.name,
    type: d.fileType,
    size: d.size,
    date: d.uploadedDate,
    uploader: d.uploadedBy,
    previewUrl: d.previewUrl,
  }
}

function fileTypeLbl(name: string): string {
  if (/\.pdf$/i.test(name)) return "PDF"
  if (/\.(docx?)$/i.test(name)) return "DOCX"
  if (/\.(xlsx?|csv)$/i.test(name)) return "XLSX"
  if (/\.(pptx?)$/i.test(name)) return "PPTX"
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name)) return "IMG"
  return "FILE"
}

function downloadLocalDoc(doc: LocalDoc) {
  if (!doc.previewUrl) return
  const link = document.createElement("a")
  link.href = doc.previewUrl
  link.download = doc.name
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

// ─── Mark Complete Modal ──────────────────────────────────────────────────────
function CompleteActivityModal({
  activity,
  onConfirm,
  onClose,
}: {
  activity: Activity
  onConfirm: (outcome: string) => void
  onClose: () => void
}) {
  return (
    <OutcomeDialog
      title="Mark Activity Complete"
      label="Outcome / Result"
      placeholder="What was the result of this activity?"
      confirmLabel="Mark Complete"
      onConfirm={onConfirm}
      onClose={onClose}
      summary={
        <>
          <p className="text-xs font-semibold text-ink-soft">{activity.type}</p>
          <p className="text-sm font-bold text-ink">{activity.subject}</p>
        </>
      }
    />
  )
}

// ─── Document Preview Modal ───────────────────────────────────────────────────
function DocPreviewModal({
  doc,
  onClose,
}: {
  doc: LocalDoc
  onClose: () => void
}) {
  const showImage = Boolean(doc.previewUrl && isImageDocument(doc.type, doc.name))
  const typeTone =
    doc.type === "IMG"
      ? "bg-success-soft text-success"
      : doc.type === "PDF"
        ? "bg-accent-soft text-accent"
        : "bg-primary-soft text-primary"

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="ui-scrim fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-preview-title"
        className={`ui-card flex max-h-[90vh] flex-col overflow-hidden shadow-overlay ${
          showImage
            ? "w-[min(72rem,calc(100vw-2rem))]"
            : "w-[min(35rem,calc(100vw-2rem))]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${typeTone}`}
            >
              {doc.type}
          </div>
            <p id="doc-preview-title" className="ui-title truncate text-sm">
              {doc.name}
            </p>
        </div>
          <Button variant="icon" aria-label="Close preview" onClick={onClose}>
            <svg
              width="15"
              height="15"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </Button>
        </div>
        {showImage ? (
          <div className="flex min-h-0 flex-1 flex-col bg-surface-muted">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
              <img
                src={doc.previewUrl}
                alt={doc.name}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
            </div>
            <p className="px-5 pb-3 text-center text-xs text-ink-faint">
              {doc.size} · Uploaded {formatDate(doc.date)} by {doc.uploader}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center bg-surface-muted px-10 py-16">
            <div
              className={`mb-4 flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold shadow-card ${typeTone}`}
            >
            {doc.type}
          </div>
            <p className="mb-1 text-center text-sm font-semibold text-ink">
              {doc.name}
            </p>
            <p className="text-center text-xs text-ink-faint">
              {doc.size} · Uploaded {formatDate(doc.date)} by {doc.uploader}
            </p>
        </div>
        )}
        <div className="flex justify-end gap-2.5 border-t border-line-subtle px-5 py-3.5">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="solid"
            disabled={!doc.previewUrl}
            onClick={() => downloadLocalDoc(doc)}
          >
            <svg
              width="12"
              height="12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download
          </Button>
        </div>
      </div>
    </div>
  )
}

interface LeadDetailProps {
  leadId: string
  onBack: () => void
  onEdit: () => void
  onToast?: (type: ToastType, title: string, message?: string) => void
  onViewEntity?: (id: string) => void
  onViewContact?: (id: string) => void
  onViewOpportunity?: (id: string) => void
}


type LeadEmail = {
  id: string
  subject: string
  body: string
  to: string
  from: string
  date: string
  time: string
  by: string
  direction: "in" | "out"
}

function toLeadEmail(mail: CrmEmail): LeadEmail {
  return {
    id: mail.id,
    subject: mail.subject,
    body: mail.body,
    to: mail.to,
    from: mail.from,
    date: mail.date,
    time: mail.time,
    by: mail.by,
    direction: mail.direction,
  }
}

function nowStamp() {
  return toStoredStamp()
}

function splitDateTime(value: string) {
  const trimmed = value.trim()
  if (trimmed.includes("T")) {
    const [isoDate, isoTime = ""] = trimmed.split("T")
    const [year, month, day] = isoDate.split("-")
    const date = year && month && day ? `${day}-${month}-${year}` : isoDate
    return { date, time: isoTime.slice(0, 5) }
  }
  const idx = trimmed.indexOf(" ")
  if (idx === -1) return { date: trimmed, time: "" }
  return { date: trimmed.slice(0, idx), time: trimmed.slice(idx + 1).trim() }
}

/** LeadNotesDetail.Discussion varchar(1000) */
const NOTE_DISCUSSION_MAX = FIELD_LIMITS.noteDiscussion
const EMPTY_NOTE_DRAFT = { dateTime: "", createdBy: "", text: "" }

type LeadEvent = {
  type: string
  subject: string
  date: string
  time: string
  user: string
  status: string
  icon: string
}

function resolveLeadEntity(
  lead: Lead,
  entities: BusinessEntity[],
): BusinessEntity | undefined {
  const key = normalizeOrgName(lead.companyName)
  return entities.find((e) => {
    const name = normalizeOrgName(e.name)
    return name === key || name.startsWith(key) || key.startsWith(name)
  })
}

function resolveLeadContact(
  lead: Lead,
  entity: BusinessEntity | undefined,
  contacts: Contact[],
): Contact | undefined {
  if (entity) {
    const onEntity =
      contacts.find(
        (c) => c.name === lead.contactPerson && c.businessEntityId === entity.id,
      ) ??
      (lead.email
        ? contacts.find(
            (c) =>
              c.email.toLowerCase() === lead.email.toLowerCase() &&
              c.businessEntityId === entity.id,
          )
        : undefined)
    if (onEntity) return onEntity
  }
  return findContactForLead(contacts, {
    name: lead.contactPerson,
    email: lead.email,
    companyName: lead.companyName,
  })
}

/** Sort key for a timeline entry (its formatted date + optional `HH:MM`). */
function parseEventStamp(date: string, time?: string): number {
  const d = parseDate(date)
  if (!d) return 0
  const m = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null
  if (m) d.setHours(Number(m[1]), Number(m[2]))
  return d.getTime()
}

/** `HH:MM` of a stored note / email date like `DD-MM-YYYY HH:MM` (else its own time field). */
function storedTime(date: string, time?: string): string {
  if (time) return formatTime(time)
  return /\d{1,2}:\d{2}/.test(date) ? formatTime(date) : ""
}

function isOverdue(date: string, asOf = CRM_AS_OF): boolean {
  return date < asOf
}

function isUpcoming(date: string, asOf = CRM_AS_OF): boolean {
  return date >= asOf
}

function activityTimelineIcon(type: string) {
  if (type === "Phone Call") return "call"
  if (type.includes("Meeting")) return "meeting"
  if (type === "Document Submission") return "email"
  return "stage"
}

function buildProgressTimeline(
  lead: Lead,
  activities: Activity[],
  notes: LeadNote[],
  emails: LeadEmail[],
  meetings: Meeting[],
  opportunity?: Opportunity | null,
) {
  const entries: {
    date: string
    time: string
    event: string
    detail: string
    by: string
    icon: string
  }[] = [
    {
      date: formatLeadDate(lead.createdAt),
      time: formatTime("09:00"),
      event: "Lead created",
      detail: `Lead created from ${lead.leadSource}. Assigned to ${lead.assignedSalesperson}.`,
      by: lead.assignedSalesperson,
      icon: "create",
    },
  ]

  for (const a of activities) {
    entries.push({
      date: formatLeadDate(a.completeDate || a.scheduleDate),
      time: formatTime(a.completeTime || a.scheduleTime || ""),
      event: a.type,
      detail: a.outcome ? `${a.subject} — ${a.outcome}` : a.subject,
      by: a.assignedTo,
      icon: activityTimelineIcon(a.type),
    })
  }
  for (const n of notes) {
    entries.push({
      date: formatDate(n.date),
      time: storedTime(n.date, n.time),
      event: "Internal discussion",
      detail: n.text,
      by: n.by,
      icon: "note",
    })
  }
  for (const e of emails) {
    entries.push({
      date: formatDate(e.date),
      time: storedTime(e.date, e.time),
      event: e.direction === "in" ? "Email received" : "Email sent",
      detail: e.subject,
      by: e.by,
      icon: "email",
    })
  }
  for (const m of meetings) {
    entries.push({
      date: formatLeadDate(m.date),
      time: formatTime(m.time),
      event: "Meeting",
      detail: m.subject,
      by: m.contactPerson,
      icon: "meeting",
    })
  }

  if (lead.leadStage === "Converted to Opportunity" || opportunity) {
    const stamp = opportunity?.convertedAt ?? opportunity?.createdAt ?? lead.createdAt
    entries.push({
      date: formatLeadDate(stamp),
      time: storedTime(stamp),
      event: "Converted to Opportunity",
      detail: opportunity
        ? `${opportunity.id} · ${opportunity.convertedBy ? `by ${opportunity.convertedBy}` : "Converted"}${
            opportunity.convertedAt ? ` · ${formatConversionStamp(opportunity.convertedAt)}` : ""
          }`
        : "Lead converted to opportunity.",
      by: opportunity?.convertedBy ?? lead.assignedSalesperson,
      icon: "create",
    })
  }

  return entries.sort(
    (a, b) => parseEventStamp(b.date, b.time) - parseEventStamp(a.date, a.time),
  )
}

// ─── Enums (resolved at runtime from context) ─────────────────────────────────

// ─── Style helpers ────────────────────────────────────────────────────────────
function docMetaTone(type: string): string {
  const tones: Record<string, string> = {
    PDF: "bg-accent-soft text-accent",
    IMG: "bg-success-soft text-success",
    PPT: "bg-warning-soft text-warning",
    XLS: "bg-success-soft text-success-strong",
    DOC: "bg-primary-soft text-primary",
  }
  return tones[type] ?? "bg-surface-hover text-ink-soft"
}

function meetingModeTone(mode: string): string {
  if (mode === "In Person") return "bg-purple-soft text-purple border-purple-line"
  if (mode === "Online") return "bg-primary-soft text-primary border-line-strong"
  if (mode === "Phone") return "bg-success-soft text-success-strong border-success-line"
  return "bg-surface-hover text-ink-muted border-line"
}

function meetingStatusTone(status: string): string {
  if (status === "Completed") return "bg-success-soft text-success border-success-line"
  if (status === "Cancelled") return "bg-accent-soft text-accent border-accent/40"
  return "bg-warning-soft text-warning border-warning-line"
}

function entityTypeTone(type: string): string {
  const tones: Record<string, string> = {
    Prospect: "bg-primary-soft text-primary border-line-strong",
    Customer: "bg-success-soft text-success border-success-line",
    Dealer: "bg-purple-soft text-purple border-purple-line",
    Distributor: "bg-warning-soft text-warning border-warning-line",
    Other: "bg-surface-hover text-ink-muted border-line",
  }
  return tones[type] ?? tones.Other
}

// ─── Reusable atoms ───────────────────────────────────────────────────────────
function stageTrackTone(stage: string): {
  fill: string
  doneDot: string
  activeDot: string
  label: string
  wave: string
  row: string
  solid: string
  dot: string
} {
  const tones: Record<
    string,
    { fill: string; doneDot: string; activeDot: string; label: string; wave: string; row: string; solid: string; dot: string }
  > = {
    New: {
      fill: "bg-success",
      doneDot: "border-success bg-success group-hover:ring-success/15",
      activeDot: "border-success bg-surface ring-4 ring-success/25",
      label: "text-success",
      wave: "border-success/35",
      row: "bg-success-soft/70 hover:bg-success-soft",
      solid: "border-success bg-success text-surface",
      dot: "bg-success",
    },
    Contacted: {
      fill: "bg-primary",
      doneDot: "border-primary bg-primary group-hover:ring-primary/15",
      activeDot: "border-primary bg-surface ring-4 ring-primary/25",
      label: "text-primary",
      wave: "border-primary/35",
      row: "bg-primary-soft/70 hover:bg-primary-soft",
      solid: "border-primary bg-primary text-surface",
      dot: "bg-primary",
    },
    "Requirement Identified": {
      fill: "bg-warning",
      doneDot: "border-warning bg-warning group-hover:ring-warning/15",
      activeDot: "border-warning bg-surface ring-4 ring-warning/25",
      label: "text-warning",
      wave: "border-warning/35",
      row: "bg-warning-soft/70 hover:bg-warning-soft",
      solid: "border-warning bg-warning text-surface",
      dot: "bg-warning",
    },
    "Under Qualification": {
      fill: "bg-purple",
      doneDot: "border-purple bg-purple group-hover:ring-purple/15",
      activeDot: "border-purple bg-surface ring-4 ring-purple/25",
      label: "text-purple",
      wave: "border-purple/35",
      row: "bg-purple-soft/70 hover:bg-purple-soft",
      solid: "border-purple bg-purple text-surface",
      dot: "bg-purple",
    },
    Qualified: {
      fill: "bg-teal",
      doneDot: "border-teal bg-teal group-hover:ring-teal/15",
      activeDot: "border-teal bg-surface ring-4 ring-teal/25",
      label: "text-teal",
      wave: "border-teal/35",
      row: "bg-teal-soft/70 hover:bg-teal-soft",
      solid: "border-teal bg-teal text-surface",
      dot: "bg-teal",
    },
    "Converted to Opportunity": {
      fill: "bg-primary-hover",
      doneDot: "border-primary-hover bg-primary-hover group-hover:ring-primary/15",
      activeDot: "border-primary-hover bg-surface ring-4 ring-primary/25",
      label: "text-primary-hover",
      wave: "border-primary-hover/35",
      row: "bg-primary-soft/70 hover:bg-primary-soft",
      solid: "border-primary-hover bg-primary-hover text-surface",
      dot: "bg-primary-hover",
    },
  }
  return (
    tones[stage] ?? {
      fill: "bg-primary",
      doneDot: "border-primary bg-primary group-hover:ring-primary/15",
      activeDot: "border-primary bg-surface ring-4 ring-primary/25",
      label: "text-primary",
      wave: "border-primary/35",
      row: "bg-primary-soft/70 hover:bg-primary-soft",
      solid: "border-primary bg-primary text-surface",
      dot: "bg-primary",
    }
  )
}

function LeadStageTrack({
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
  const currentTone = stageTrackTone(current)

  return (
    <div
      key={`${current}-${stages.join("|")}`}
      className="stage-track relative min-w-[36rem]"
      style={{ ["--stage-cols" as string]: count }}
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
        aria-label="Lead stage progress"
      >
        {stages.map((name, i) => {
          const done = i < idx
          const active = i === idx
          const tone = stageTrackTone(name)
          const tip = active ? `Current stage: ${name}` : done ? `Completed: ${name}` : `Upcoming: ${name}`
          const delayMs = i <= idx ? i * stepMs : fillMs
          return (
            <li key={name} className="min-w-0 overflow-visible">
              <IconTooltip label={tip} className="w-full">
                <div
                  className="flex w-full flex-col items-center gap-1.5 px-0.5 py-1 text-center"
                  aria-current={active ? "step" : undefined}
                >
                  <span className="flex h-3.5 w-full items-center justify-center overflow-visible" aria-hidden="true">
                    <span
                      className={`stage-dot-in relative z-[1] h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                        active
                          ? tone.activeDot
                          : done
                            ? tone.doneDot
                            : "border-line bg-line"
                      }`}
                      style={{ animationDelay: `${delayMs}ms` }}
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
                          : "font-medium text-ink-faint"
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

function CardSection({
  title,
  accent = "bg-primary",
  children,
  action,
}: {
  title: string
  accent?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className={`h-4 w-1 flex-shrink-0 rounded-full ${accent}`} />
          <h3 className="font-display text-sm font-bold text-ink">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function InfoField({
  label,
  value,
  accent,
  mono,
  onClick,
  href,
}: {
  label: string
  value?: string | null
  accent?: boolean
  mono?: boolean
  onClick?: () => void
  href?: string
}) {
  const display = value?.trim() ? value : "—"
  const interactive = Boolean(onClick || href)
  const tone = accent ? "text-accent" : interactive ? "text-primary" : "text-ink"
  const content = (
    <span
      className={`break-words text-xs font-semibold leading-relaxed ${tone} ${
        mono ? "font-mono" : ""
      } ${interactive ? "hover:underline" : ""}`}
    >
      {display}
    </span>
  )
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[9.5px] font-bold tracking-wide text-ink-faint">
        {label}
      </p>
      {href ? (
        <a href={href} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {content}
        </a>
      ) : onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  )
}

function SummaryStat({
  label,
  children,
  className = "",
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`min-w-0 bg-surface p-4 ${className}`.trim()}>
      <p className="form-label !mb-1">{label}</p>
      <div className="text-sm font-semibold leading-snug text-ink">{children}</div>
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
      {(value.trim().charAt(0) || "?").toUpperCase()}
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

function CompactEmpty({
  title,
  action,
}: {
  title: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="py-3">
      <p className="text-xs text-ink-faint">
        {title}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 text-xs font-semibold hover:underline focus-visible:outline-none text-primary"
        >
          {action.label}
          </button>
      )}
        </div>
  )
}

// ─── Change Stage / Status drawer ─────────────────────────────────────────────
function OverviewTab({
  lead,
  stage,
  status,
  entity,
  contact,
  activities,
  meetings,
  events,
  docs,
  onAddActivity,
  onAddMeeting,
  onUpload,
  onViewEntity,
  onViewContact,
  onViewActivities,
  onViewMeetings,
  onViewTimeline,
  onViewDocuments,
  onPreviewDoc,
  onDownloadDoc,
}: {
  lead: Lead
  stage: LeadStage
  status: LeadStatus
  entity?: BusinessEntity
  contact?: Contact
  activities: Activity[]
  meetings: Meeting[]
  events: LeadEvent[]
  docs: LocalDoc[]
  onAddActivity: () => void
  onAddMeeting: () => void
  onUpload: () => void
  onViewEntity?: (id: string) => void
  onViewContact?: (id: string) => void
  onViewActivities: () => void
  onViewMeetings: () => void
  onViewTimeline: () => void
  onViewDocuments: () => void
  onPreviewDoc: (d: LocalDoc) => void
  onDownloadDoc: (d: LocalDoc) => void
}) {
  const requirement = getLeadRequirement(lead)
  const location =
    entity?.locations.find((l) => l.isPrimary) ?? entity?.locations[0]
  const pending = activities.filter((a) => a.status === "Pending")
  const overdue = pending.filter((a) => isOverdue(a.scheduleDate))
  const followUps = pending.filter(
    (a) =>
      (a.type === "Follow-up" || a.type === "Task") &&
      isUpcoming(a.scheduleDate),
  )
  const upcomingMeetings = meetings.filter(
    (m) => m.status === "Scheduled" && isUpcoming(m.date),
  )
  const recentActivities = [...activities]
    .sort(
      (a, b) =>
        parseEventStamp(b.scheduleDate, b.scheduleTime) -
        parseEventStamp(a.scheduleDate, a.scheduleTime),
    )
    .slice(0, 4)
  const latestDocs = docs.slice(0, 4)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <CardSection title="Lead Information" accent="bg-primary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <InfoField label="Lead Source" value={lead.leadSource} />
          <InfoField label="Stage" value={stage} />
          <InfoField label="Status" value={status} />
          <InfoField
            label="Created Date"
            value={formatLeadDate(lead.createdAt)}
          />
          <div className="sm:col-span-2">
            <InfoField
              label="Assigned Salesperson"
              value={lead.assignedSalesperson}
            />
          </div>
          </div>
      </CardSection>

      <CardSection
        title="Business Entity"
        accent="bg-success-strong"
        action={
          entity && onViewEntity ? (
            <button
              type="button"
              onClick={() => onViewEntity(entity.id)}
              className="text-xs font-semibold hover:underline focus-visible:outline-none text-primary"
            >
              View entity
            </button>
          ) : undefined
        }
      >
        {entity ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <div className="sm:col-span-2">
              <InfoField
                label="Company Name"
                value={entity.name}
                onClick={
                  onViewEntity ? () => onViewEntity(entity.id) : undefined
                }
              />
        </div>
            <InfoField label="Entity Type" value={entity.type} />
            <InfoField
              label="City / State / Country"
              value={
                location
                  ? `${location.city} / ${location.state} / ${location.country}`
                  : "—"
              }
            />
            <InfoField
              label="Territory / Region"
              value={location?.territory ?? "—"}
            />
            <InfoField
              label="Website"
              value={entity.website}
              href={
                entity.website
                  ? `https://${entity.website.replace(/^https?:\/\//, "")}`
                  : undefined
              }
            />
            <div className="sm:col-span-2">
              <InfoField
                label="GST / Tax Registration"
                value={entity.gstin}
                mono
              />
            </div>
            <span
              className={`w-fit rounded-full border px-2 py-0.5 text-xs font-semibold ${entityTypeTone(entity.type)}`}
            >
              {entity.type}
            </span>
          </div>
        ) : (
          <CompactEmpty title="No business entity is linked to this lead." />
        )}
      </CardSection>

      <CardSection
        title="Primary Contact"
        accent="bg-purple"
        action={
          contact && onViewContact ? (
            <button
              type="button"
              onClick={() => onViewContact(contact.id)}
              className="text-xs font-semibold hover:underline focus-visible:outline-none text-primary"
            >
              View contact
          </button>
          ) : undefined
        }
      >
        {contact ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ background: avatarGradient(contact.name) }}
              >
                {initialsAvatar(contact.name)}
              </div>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onViewContact?.(contact.id)}
                  className="font-bold text-sm text-left hover:underline focus-visible:outline-none text-ink"
                >
                  {contact.name}
          </button>
                <p
                  className="text-xs font-semibold text-purple"
                >
                  {contact.designation}
                </p>
        </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <InfoField label="Designation" value={contact.designation} />
              <InfoField label="Department" value={contact.department} />
              <InfoField
                label="Mobile"
                value={contact.mobile}
                href={`tel:${contact.mobile.replace(/\s/g, "")}`}
              />
              <InfoField
                label="Email"
                value={contact.email}
                href={`mailto:${contact.email}`}
              />
              <div className="sm:col-span-2">
                <InfoField
                  label="Location / Plant"
                  value={contact.locationLabel}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple to-primary text-sm font-bold text-white"
              >
                {lead.contactPerson.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-sm text-ink">
                  {lead.contactPerson}
                </p>
                <p className="text-xs text-ink-faint">
                  Linked from lead record
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <InfoField
                label="Mobile"
                value={lead.phone}
                href={`tel:${lead.phone.replace(/\s/g, "")}`}
              />
              <InfoField
                label="Email"
                value={lead.email}
                href={`mailto:${lead.email}`}
              />
            </div>
          </>
        )}
      </CardSection>

      <div className="lg:col-span-3">
        <CardSection title="Requirement" accent="bg-warning">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            <InfoField
              label="Products Required"
              value={lead.productsRequired}
            />
            <InfoField
              label="Approximate Quantity"
              value={requirement.approximateQuantity}
            />
            <div className="sm:col-span-2">
              <InfoField
                label="Requirement Details"
                value={requirement.requirementDetails}
              />
            </div>
            <div className="sm:col-span-2">
              <InfoField label="Remarks" value={requirement.remarks || "—"} />
            </div>
          </div>
        </CardSection>
      </div>

      <Card className="min-w-0 overflow-hidden lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-4 w-1 flex-shrink-0 rounded-full bg-primary" aria-hidden />
            <h3 className="ui-title text-sm">Activity Summary</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onAddActivity}>
              + Activity
            </Button>
            <Button variant="secondary" onClick={onAddMeeting}>
              + Meeting
            </Button>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Pending tasks",
                value: pending.length,
                tone: "bg-warning-soft text-warning",
                onClick: onViewActivities,
              },
              {
                label: "Overdue tasks",
                value: overdue.length,
                tone: "bg-accent-soft text-accent",
                onClick: onViewActivities,
              },
              {
                label: "Upcoming follow-ups",
                value: followUps.length,
                tone: "bg-success-soft text-success",
                onClick: onViewActivities,
              },
              {
                label: "Meetings",
                value: upcomingMeetings.length || meetings.length,
                tone: "bg-purple-soft text-purple",
                onClick: onViewMeetings,
              },
            ].map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                onClick={kpi.onClick}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left ${kpi.tone} hover:brightness-[0.98] active:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary`}
              >
                <span className="min-w-0 text-xs font-semibold leading-snug text-ink-soft">
                  {kpi.label}
                </span>
                <span className="flex-shrink-0 font-display text-xl font-bold leading-none">
                  {kpi.value}
                </span>
              </button>
            ))}
            </div>
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-ink-faint">
              Recent activities
            </p>
            {recentActivities.length === 0 ? (
              <CompactEmpty
                title="No activities logged yet."
                action={{ label: "Log activity", onClick: onAddActivity }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {recentActivities.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={onViewActivities}
                    className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-left hover:bg-surface-hover active:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`badge ${activityTypeTone(a.type)}`}>
                        {a.type}
                      </span>
                      <span
                        className={`badge ml-auto ${activityStatusTone(a.status)}`}
                      >
                        {a.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug text-ink break-words">
                      {a.subject}
                    </p>
                    <p className="text-xs leading-relaxed text-ink-faint">
                      {formatDateTime(a.scheduleDate, a.scheduleTime)}
                    </p>
                    <p className="text-xs text-ink-muted">{a.assignedTo}</p>
                  </button>
          ))}
        </div>
            )}
          </div>
        </div>
      </Card>

      <div className="lg:col-span-2">
        <CardSection
          title="Recent Timeline"
          accent="bg-primary-hover"
          action={
            <button
              type="button"
              onClick={onViewTimeline}
              className="text-xs font-semibold hover:underline focus-visible:outline-none text-primary"
            >
              View all
            </button>
          }
        >
          {events.length === 0 ? (
            <EmptyState
              icon={EmptyIcons.timeline}
              title="No timeline events yet"
              subtitle="Events appear as activities, meetings and stage changes are logged."
            />
          ) : (
            <div className="space-y-2">
              {events.slice(0, 5).map((ev, i) => {
                const ic = timelineIconMeta(ev.icon)
                return (
                  <button
                    key={`${ev.type}-${i}`}
                    type="button"
                    onClick={onViewTimeline}
                    className="w-full flex items-start gap-2.5 text-left focus-visible:outline-none"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ic.tone}`}
                    >
                      <svg
                        width="12"
                        height="12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        {ic.d}
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className="text-xs font-bold truncate text-ink"
                        >
                          {ev.type}
                        </p>
                        <span
                          className="text-xs flex-shrink-0 text-ink-faint"
                        >
                          {joinDateTime(ev.date, ev.time)}
                        </span>
                      </div>
                      <p
                        className="text-xs truncate text-ink-soft"
                      >
                        {ev.subject}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {ev.user} · {ev.status}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
      </CardSection>
      </div>

      <CardSection
        title="Documents Summary"
        accent="bg-accent"
        action={
        <div className="flex gap-2">
            <button
              type="button"
              onClick={onViewDocuments}
              className="text-xs font-semibold hover:underline focus-visible:outline-none text-primary"
            >
              View all
            </button>
            <button
              type="button"
              onClick={onUpload}
              className="rounded-lg border border-accent/30 bg-accent-soft px-2 py-1 text-xs font-semibold text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Upload
            </button>
        </div>
        }
      >
        {latestDocs.length === 0 ? (
          <CompactEmpty
            title="No documents uploaded yet."
            action={{ label: "Upload document", onClick: onUpload }}
          />
        ) : (
          <div className="space-y-2">
            {latestDocs.map((d) => {
              const tone = docMetaTone(d.type)
            return (
                <div key={d.id} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onPreviewDoc(d)}
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tone}`}
                    aria-label={`Preview ${d.name}`}
                  >
                    {d.type}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs font-semibold truncate text-ink"
                    >
                      {d.name}
                    </p>
                    <p className="text-xs text-ink-faint">
                      {d.type} · {formatDate(d.date)}
                    </p>
                </div>
                  <IconTooltip label="Preview">
                  <button
                    type="button"
                    onClick={() => onPreviewDoc(d)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    aria-label={`Preview ${d.name}`}
                  >
                    <svg
                      width="13"
                      height="13"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </button>
                  </IconTooltip>
                  <IconTooltip label="Download">
                  <button
                    type="button"
                    onClick={() => onDownloadDoc(d)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center focus-visible:outline-none text-ink-faint"
                    aria-label={`Download ${d.name}`}
                  >
                    <svg
                      width="13"
                      height="13"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  </button>
                  </IconTooltip>
                </div>
              )
          })}
        </div>
        )}
      </CardSection>
    </div>
  )
}

// ─── Tab: Meetings ────────────────────────────────────────────────────────────
function MeetingsTab({
  meetings,
  onAdd,
  onFollowUp,
}: {
  meetings: Meeting[]
  onAdd: () => void
  onFollowUp: (m: Meeting) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-ink-muted">
          {meetings.length} meetings
        </p>
        <Button type="button" variant="solid" className="!min-h-8 !px-3 !py-1.5 text-xs" onClick={onAdd}>
          <svg
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4v16m8-8H4"
            />
          </svg>
          Schedule Meeting
        </Button>
      </div>
      {meetings.length === 0 && (
        <EmptyState
          icon={EmptyIcons.meetings}
          title="No meetings scheduled"
          subtitle="Schedule a demo, discovery call or stakeholder discussion for this lead."
          action={{ label: "Schedule Meeting", onClick: onAdd }}
        />
      )}
      <div className="space-y-3">
        {meetings.map((m) => {
          const modeIcon =
            m.mode === "In Person" ? "🏢" : m.mode === "Online" ? "💻" : m.mode === "Phone" ? "📞" : "📅"
          return (
            <div
              key={m.id}
              className="rounded-xl border border-line bg-surface p-4"
            >
              <div className="mb-2.5 flex items-start justify-between gap-4">
                <p className="text-sm font-bold text-ink">{m.subject}</p>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meetingModeTone(m.mode)}`}
                  >
                    <span className="text-[10px]" aria-hidden="true">{modeIcon}</span>
                    {m.mode}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${meetingStatusTone(m.status)}`}
                  >
                    {m.status}
                  </span>
                </div>
                {m.status === "Completed" && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="!min-h-8 !border-success-line !bg-success-soft !px-2.5 !py-1.5 text-xs !text-success-strong hover:!bg-success-soft"
                    onClick={() => onFollowUp(m)}
                  >
                    <svg
                      width="11"
                      height="11"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Create Follow-up Task
                  </Button>
                )}
              </div>
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
                <span>📅 {formatMeetingDateTime(m.date, m.time, m.endTime)}</span>
                {m.location && <span>📍 {m.location}</span>}
              </div>
              {m.participants.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-[9.5px] font-bold tracking-wide text-ink-faint">
                    Participants
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {m.participants.map((p) => (
                      <span
                        key={p}
                        className="rounded-full border border-line bg-surface-hover px-2 py-0.5 text-xs text-ink-soft"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {m.notes && (
                <p className="mb-2.5 text-xs italic text-ink-faint">{m.notes}</p>
              )}
              {m.status === "Completed" && m.outcome && (
                <div className="mb-2.5 rounded-lg border-l-[3px] border-success bg-success-soft px-3 py-2 text-xs text-success">
                  <strong>Outcome: </strong>
                  {m.outcome}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Timeline ────────────────────────────────────────────────────────────
// ─── Tab: Documents ───────────────────────────────────────────────────────────
function DocumentsTab({
  docs,
  onUpload,
  onPreview,
  onDownload,
  onRename,
  onDelete,
}: {
  docs: LocalDoc[]
  onUpload: () => void
  onPreview: (d: LocalDoc) => void
  onDownload: (d: LocalDoc) => void
  onRename: (d: LocalDoc) => void
  onDelete: (d: LocalDoc) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-ink-muted">
          {docs.length} document{docs.length !== 1 ? "s" : ""}
        </p>
        <Button type="button" variant="solid" className="!min-h-8 !px-3 !py-1.5 text-xs" onClick={onUpload}>
          <svg
            width="12"
            height="12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Upload Document
        </Button>
      </div>
      {docs.length === 0 ? (
        <div className="empty-state">
          <svg
            width="36"
            height="36"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-line-strong"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-3 text-sm font-semibold text-ink-faint">No documents attached</p>
          <p className="mt-1 text-xs text-ink-muted">
            Upload contracts, proposals or any related files.
          </p>
          <Button type="button" variant="solid" className="mt-3 text-xs" onClick={onUpload}>
            Upload Document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => {
            const tone = docMetaTone(d.type)
            return (
              <div
                key={d.id}
                className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-line-strong"
              >
                <button
                  type="button"
                  onClick={() => onPreview(d)}
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${tone}`}
                >
                  {d.type}
                </button>
                <div
                  className="min-w-0 flex-1 cursor-pointer"
                  onClick={() => onPreview(d)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      onPreview(d)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <p className="truncate text-sm font-semibold text-ink">{d.name}</p>
                  <p className="text-xs text-ink-faint">
                    {d.size} · Uploaded {formatDate(d.date)} by {d.uploader}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <IconTooltip label="Preview">
                    <button
                      type="button"
                      aria-label="Preview"
                      onClick={() => onPreview(d)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                  </button>
                  </IconTooltip>
                  <IconTooltip label="Download">
                    <button
                      type="button"
                      aria-label="Download"
                      onClick={() => onDownload(d)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-primary-soft hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                  </button>
                  </IconTooltip>
                  <IconTooltip label="Rename">
                    <button
                      type="button"
                      aria-label="Rename"
                      onClick={() => onRename(d)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-warning-soft hover:text-warning focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                  </button>
                  </IconTooltip>
                  <IconTooltip label="Delete">
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => onDelete(d)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                  </button>
                  </IconTooltip>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Rename Document drawer ───────────────────────────────────────────────────
function RenameDocModal({
  doc,
  onConfirm,
  onClose,
}: {
  doc: LocalDoc
  onConfirm: (newName: string) => void
  onClose: () => void
}) {
  const [val, setVal] = useState(doc.name)
  const [err, setErr] = useState("")

  return (
    <FormDrawer
      title="Rename Document"
      subtitle="Update the file name for this attachment"
      onClose={onClose}
      widthClass="w-[24rem]"
      icon={
        <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      }
      footer={(requestClose) => (
        <>
          <Button type="button" variant="secondary" onClick={requestClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="solid"
            onClick={() => {
              if (!val.trim()) {
                setErr("Name is required")
                return
              }
              onConfirm(val.trim())
            }}
          >
            Rename
          </Button>
        </>
      )}
    >
      <TextField
        label="File Name"
        required
        value={val}
        error={err || undefined}
        autoFocus
        onValueChange={(value) => {
          setVal(value)
          setErr("")
        }}
      />
    </FormDrawer>
  )
}

// ─── Tab: Emails ──────────────────────────────────────────────────────────────
function EmailCard({
  mail,
  expanded,
  onToggle,
}: {
  mail: LeadEmail
  expanded: boolean
  onToggle: () => void
}) {
  const party = mail.direction === "out" ? `To ${mail.to}` : `From ${mail.from}`

  return (
    <li
      className={`border-b border-line last:border-b-0 transition-colors duration-200 ${
        expanded ? "bg-primary-soft/40" : "bg-surface"
      }`}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[9px] font-bold text-primary">
          {initialsAvatar(mail.by)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-[11px] font-bold leading-snug text-ink">{mail.subject}</p>
          <p className="mt-px truncate text-[10px] leading-snug text-ink-muted">
            {party} · {formatDateParts(mail.date, mail.time)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary-soft px-1.5 py-px text-[9px] font-bold leading-none tracking-wide text-primary">
          {mail.direction === "in" ? "Inbound" : "Outbound"}
        </span>
        <svg
          width="12"
          height="12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.2}
          className={`shrink-0 text-ink-faint transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className="accordion-panel"
        data-open={expanded ? "true" : "false"}
        aria-hidden={!expanded}
        {...(!expanded ? { inert: true } : {})}
      >
        <div className="accordion-panel-inner">
          <div className="accordion-panel-body border-t border-line-subtle px-2.5 pb-2 pl-10 pt-1.5">
            <p className="text-[11px] leading-relaxed text-ink-soft">{mail.body || "No email body."}</p>
            <p className="mt-1 text-[10px] text-ink-faint">Logged by {mail.by}</p>
          </div>
        </div>
      </div>
    </li>
  )
}

function EmailsTab({
  emails,
  adding,
  draft,
  onDraft,
  onStartAdd,
  onCancel,
  onSave,
}: {
  emails: LeadEmail[]
  adding: boolean
  draft: { subject: string; to: string; body: string }
  onDraft: (patch: Partial<{ subject: string; to: string; body: string }>) => void
  onStartAdd: () => void
  onCancel: () => void
  onSave: () => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    setOpenId((prev) => (prev && emails.some((item) => item.id === prev) ? prev : null))
  }, [emails])

  return (
          <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-muted">
          {emails.length} email{emails.length !== 1 ? "s" : ""}
        </p>
        <Button variant="solid" className="!px-3 !py-1.5 text-xs" onClick={onStartAdd}>
          Add Email
        </Button>
          </div>
      {adding && (
        <div className="mb-3 space-y-3 rounded-xl border border-line bg-surface p-4">
          <FormGrid cols={2}>
            <TextField label="To" value={draft.to} onValueChange={(v) => onDraft({ to: v })} placeholder="name@company.com" />
            <TextField label="Subject" value={draft.subject} onValueChange={(v) => onDraft({ subject: v })} placeholder="Email subject" />
          </FormGrid>
          <TextAreaField
            label="Email body"
            rows={4}
            value={draft.body}
            onValueChange={(v) => onDraft({ body: v })}
            placeholder="Write the email discussion…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button variant="solid" onClick={onSave} disabled={!draft.subject.trim() || !draft.to.trim()}>
              Save Email
            </Button>
          </div>
        </div>
      )}
      {emails.length === 0 && !adding ? (
        <EmptyState
          icon={EmptyIcons.notes}
          title="No emails yet"
          subtitle="Add outbound and inbound emails so the lead timeline stays complete."
          action={{ label: "Add Email", onClick: onStartAdd }}
        />
      ) : emails.length > 0 ? (
        <ul className="overflow-hidden rounded-xl border border-line bg-surface" aria-label="Emails">
          {emails.map((mail) => (
            <EmailCard
              key={mail.id}
              mail={mail}
              expanded={openId === mail.id}
              onToggle={() => setOpenId((prev) => (prev === mail.id ? null : mail.id))}
            />
          ))}
        </ul>
      ) : null}
      </div>
  )
}

// ─── Tab: Internal Notes ──────────────────────────────────────────────────────
// ─── Main component ───────────────────────────────────────────────────────────
const ALL_TABS = [
  "Emails",
  "Internal Notes / Observations",
  "Timeline",
  "Status History",
] as const
type Tab = (typeof ALL_TABS)[number]
/** Hidden for now; the tab's code stays so it can be switched back on by removing it here. */
const HIDDEN_TABS: readonly Tab[] = ["Emails"]
const TABS = ALL_TABS.filter((tab) => !HIDDEN_TABS.includes(tab))
const DEFAULT_TAB: Tab = TABS[0] ?? "Timeline"

/** No in-app entity / contact catalogue on server leads — cards show only what the lead carries. */
const NO_ENTITIES: BusinessEntity[] = []
const NO_CONTACTS: Contact[] = []

export default function LeadDetail({
  leadId,
  onBack,
  onEdit,
  onToast,
  onViewEntity,
  onViewContact,
  onViewOpportunity,
}: LeadDetailProps) {
  // Server lists only for the stage track / status / source.
  const { values: fill } = useLeadFormFillValues()
  const activeLeadStageNames = fill ? bySequence(fill.leadStages).map((x) => x.leadStageName) : []
  const activeLeadSourceNames = fill ? fill.leadSources.map((x) => x.leadSourceName) : []
  const leadStatusOptions: StatusOption[] = fill
    ? fill.leadStatuses.map((x) => ({ no: x.leadStatusNo, name: x.leadStatusName, isRemarkMandatory: x.isRemarkMandatory }))
    : []
  // Server lead (id SL-…): reload it in full from load-data whenever the page opens.
  const serverLeadNo = leadNoFromId(leadId)
  const [serverRefresh, setServerRefresh] = useState<"idle" | "loading" | "done" | "failed">(serverLeadNo ? "loading" : "idle")
  useEffect(() => {
    if (!serverLeadNo) return
    let cancelled = false
    setServerRefresh("loading")
    refreshServerLead(serverLeadNo)
      .then(() => { if (!cancelled) setServerRefresh("done") })
      .catch(() => { if (!cancelled) setServerRefresh("failed") })
    return () => { cancelled = true }
  }, [serverLeadNo])
  const {
    leads,
    activities: storeActivities,
    meetings: storeMeetings,
    notes: storeNotes,
    emails: storeEmails,
    documents: storeDocuments,
  } = useCrmSelector(
    (state) => ({
      // Server leads only — in-app sample leads are not shown.
      leads: state.leads.filter((item) => item.spectrum),
      // Opportunity activities are shown on the opportunity, not its lead.
      activities: state.activities.filter((item) => item.leadId === leadId && !item.opportunityId),
      meetings: state.meetings.filter((item) => item.leadId === leadId),
      notes: state.notes.filter((item) => item.relatedLeadId === leadId),
      emails: state.emails.filter((item) => item.leadId === leadId),
      documents: state.documents.filter((item) => item.relatedId === leadId),
    }),
    (left, right) =>
      sameList(left.leads, right.leads) &&
      sameList(left.activities, right.activities) &&
      sameList(left.meetings, right.meetings) &&
      sameList(left.notes, right.notes) &&
      sameList(left.emails, right.emails) &&
      sameList(left.documents, right.documents),
  )
  const { addActivity, addMeeting, addNote, addEmail, addDocument, convertLead, patchActivity, removeActivity, removeNote, patchNote } = useCrmActions()
  const confirm = useConfirm()
  const { data: linkedOppPage } = useApiQuery(
    () => api.opportunities.list({ leadId, pageSize: 1 }),
    [leadId],
  )
  const linkedOpportunity = linkedOppPage?.items[0] ?? null
  const { user } = useAuth()
  const createdByName = user?.name ?? ""
  const ALL_STAGES = activeLeadStageNames as LeadStage[]

  const leadData = leads.find((l) => l.id === leadId)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>(DEFAULT_TAB)
  const [activityScope, setActivityScope] = useState<"open" | "all">("open")
  const [stage, setStage] = useState<LeadStage>(leadData?.leadStage ?? "New")
  const [status, setStatus] = useState<LeadStatus>(
    leadData?.leadStatus ?? "Open",
  )
  // Converted leads (or ones that already have an opportunity) are read-only.
  const converted = isLeadConverted({ leadStage: stage, leadStatus: status }) || Boolean(linkedOpportunity)
  // Locked: converted, or at a completed stage (load-data `leadStage.isStagedCompleted`) — no edits to
  // the lead, and no adding / editing / deleting its activities or notes.
  const locked = converted || Boolean(leadData?.spectrum?.stageCompleted)
  const lockedReason = converted
    ? "Converted to an opportunity — this lead can no longer be changed"
    : "The lead is at a completed stage — it can no longer be changed"
  const [showConvert, setShowConvert] = useState(false)
  const [showStatusChange, setShowStatusChange] = useState(false)
  const [editingField, setEditingField] = useState<FieldKey | null>(null)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [followUpFrom, setFollowUpFrom] = useState<Activity | null>(null)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  /** Note being edited (its id); null when the note form adds a new one. */
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [leadDocs, setLeadDocs] = useState<LocalDoc[]>([])
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [addingNote, setAddingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState(EMPTY_NOTE_DRAFT)
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({})
  const [emails, setEmails] = useState<LeadEmail[]>([])
  const [addingEmail, setAddingEmail] = useState(false)
  const [emailDraft, setEmailDraft] = useState({ subject: "", to: "", body: "" })
  const docFileRef = useRef<HTMLInputElement>(null)
  const [previewDoc, setPreviewDoc] = useState<LocalDoc | null>(null)
  const [renamingDoc, setRenamingDoc] = useState<LocalDoc | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<LocalDoc | null>(null)
  const [completingActivity, setCompletingActivity] = useState<Activity | null>(
    null,
  )
  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    setActiveTab(DEFAULT_TAB)
    setActivityScope("open")
    setAddingNote(false)
    setNoteDraft(EMPTY_NOTE_DRAFT)
    setNoteErrors({})
    setAddingEmail(false)
    setEmailDraft({ subject: "", to: "", body: "" })
    setEditingField(null)
    const found = leads.find((l) => l.id === leadId)
    const timer = window.setTimeout(() => {
      if (!found) {
        // A server lead opened by link may not be in the store until load-data finishes.
        if (serverRefresh === "loading") return
        setLoadError(true)
        setLoading(false)
        return
      }
      setLoadError(false)
      setStage(found.leadStage)
      setStatus(found.leadStatus)
      setActivities(storeActivities.filter((a) => a.leadId === leadId))
      setMeetings(storeMeetings.filter((m) => m.leadId === leadId))
      setLeadDocs(
        storeDocuments
          .filter((d) => d.relatedId === leadId)
          .map(toLocalDoc),
      )
      setNotes([

        ...storeNotes
          .filter((n) => n.relatedLeadId === leadId)
          .map((n) => ({
            id: n.id,
            text: n.title ? `${n.title} — ${n.text}` : n.text,
            date: n.date,
            time: "",
            by: n.by,
          })),
      ])
      setEmails([
        ...storeEmails.map(toLeadEmail),
      ])
      setLoading(false)
    }, 420)
    return () => window.clearTimeout(timer)
    // Reload the lead record when the route id changes; extras merge below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, leads, serverRefresh])

  useEffect(() => {
    setActivities((prev) => {
      const extras = storeActivities.filter((a) => a.leadId === leadId && !prev.some((p) => p.id === a.id))
      return extras.length ? [...extras, ...prev] : prev
    })
    setMeetings((prev) => {
      const extras = storeMeetings.filter((m) => m.leadId === leadId && !prev.some((p) => p.id === m.id))
      return extras.length ? [...extras, ...prev] : prev
    })
    setLeadDocs((prev) => {
      const related = storeDocuments.filter((d) => d.relatedId === leadId)
      const extras = related.filter((d) => !prev.some((p) => p.id === d.id)).map(toLocalDoc)
      let changed = extras.length > 0
      const base = extras.length ? [...extras, ...prev] : prev
      const next = base.map((doc) => {
        const stored = related.find((d) => d.id === doc.id)
        if (stored?.previewUrl && stored.previewUrl !== doc.previewUrl) {
          changed = true
          return { ...doc, previewUrl: stored.previewUrl }
        }
        return doc
      })
      return changed ? next : prev
    })
    setNotes((prev) => {
      const extras = storeNotes
        .filter((n) => n.relatedLeadId === leadId && !prev.some((p) => p.id === n.id))
        .map((n) => ({ id: n.id, text: n.title ? `${n.title} — ${n.text}` : n.text, date: n.date, time: "", by: n.by }))
      return extras.length ? [...extras, ...prev] : prev
    })
    setEmails((prev) => {
      const extras = storeEmails
        .filter((mail) => !prev.some((p) => p.id === mail.id))
        .map(toLeadEmail)
      return extras.length ? [...extras, ...prev] : prev
    })
  }, [leadId, storeActivities, storeMeetings, storeDocuments, storeNotes, storeEmails])

  const openActivities = useMemo(
    () => activities.filter((item) => item.status === "Pending"),
    [activities],
  )
  const visibleActivities = activityScope === "all" ? activities : openActivities

  const [timelineOrder, setTimelineOrder] = useState<TimelineOrder>("received")
  // Server leads read the paged timeline API (PagedTimeline below); others build theirs in the app.
  const timeline = useMemo(() => {
    if (!leadData) return []
    const built = buildProgressTimeline(leadData, activities, notes, emails, meetings, linkedOpportunity)
    return timelineOrder === "newest" ? [...built].reverse() : built
  }, [leadData, activities, notes, emails, meetings, linkedOpportunity, timelineOrder])

  const recentEvents = useMemo<LeadEvent[]>(
    () =>
      timeline.map((t) => ({
        type: t.event,
        subject: t.detail,
        date: t.date,
        time: t.time,
        user: t.by,
        status: "Logged",
        icon: t.icon,
      })),
    [timeline],
  )

  /** Delete an activity (server leads → delete-activity-detail); the list updates once it is gone. */
  async function deleteActivity(item: Activity) {
    const ok = await confirm({
      title: "Delete Activity",
      message: `Delete "${item.subject}"? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!ok) return
    if (!(await removeActivity(item.id))) return
    setActivities((prev) => prev.filter((a) => a.id !== item.id))
    onToast?.("info", "Activity Deleted", `"${item.subject}" has been deleted.`)
  }

  /** Delete a note (server leads → delete-notes-detail). */
  async function deleteNote(note: LeadNote) {
    const ok = await confirm({
      title: "Delete Note",
      message: `Delete this note by ${note.by || "unknown"}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    })
    if (!ok) return
    if (!(await removeNote(note.id))) return
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
    onToast?.("info", "Note Deleted", "The internal note has been deleted.")
  }

  async function saveNote() {
    if (!leadData) return
    const dateTime = noteDraft.dateTime.trim()
    const by = noteDraft.createdBy.trim()
    const text = noteDraft.text.trim()
    const errs: Record<string, string> = {}
    if (!dateTime) errs.dateTime = "Date/Time is required"
    if (!by) errs.createdBy = "Created by is required"
    if (!text) errs.text = "Note / discussion is required"
    else if (noteDraft.text.length > NOTE_DISCUSSION_MAX) {
      errs.text = `Note / discussion cannot exceed ${NOTE_DISCUSSION_MAX} characters`
    }
    if (Object.keys(errs).length) {
      setNoteErrors(errs)
      return
    }
    if (!(await confirm(saveConfirm("Note", Boolean(editingNoteId))))) return
    const { date, time } = splitDateTime(dateTime)
    if (editingNoteId) {
      // Server notes → save-notes-detail with their number (an update), then the lead reloads.
      // Failed → the error toast shows and the form stays open with the text.
      if (!(await patchNote(editingNoteId, { text, by, date: `${date} ${time}`.trim() }))) return
      setNotes((prev) => prev.map((n) => (n.id === editingNoteId ? { ...n, text, by, date, time } : n)))
      setNoteDraft(EMPTY_NOTE_DRAFT)
      setNoteErrors({})
      setAddingNote(false)
      setEditingNoteId(null)
      onToast?.("success", "Internal Note / Observation Updated", "The discussion has been updated.")
      return
    }
    const created = {
      id: `N-${Date.now()}`,
      title: "Internal note",
      text,
      relatedLeadId: leadData.id,
      relatedLeadName: leadData.companyName,
      date: `${date} ${time}`.trim(),
      by,
    }
    if (!(await addNote(created))) return
    setNotes((n) => [
      {
        id: created.id,
        text: created.text,
        date,
        time,
        by,
      },
      ...n,
    ])
    setNoteDraft(EMPTY_NOTE_DRAFT)
    setNoteErrors({})
    setAddingNote(false)
    onToast?.("success", "Internal Note / Observation Added", "The discussion has been saved on this lead.")
  }

  async function saveEmail() {
    if (!leadData || !emailDraft.subject.trim() || !emailDraft.to.trim()) return
    if (!(await confirm(saveConfirm("Email")))) return
    const stamp = nowStamp()
    const created: CrmEmail = {
      id: `EM-${Date.now()}`,
      leadId: leadData.id,
      leadName: leadData.companyName,
      subject: emailDraft.subject.trim(),
      body: emailDraft.body.trim(),
      to: emailDraft.to.trim(),
      from: user?.email ?? "",
      date: stamp.date,
      time: stamp.time,
      by: createdByName,
      direction: "out",
    }
    addEmail(created)
    setEmails((prev) => [toLeadEmail(created), ...prev])
    setEmailDraft({ subject: "", to: "", body: "" })
    setAddingEmail(false)
    onToast?.("success", "Email Added", "The email has been added to this lead.")
  }

  if (loadError || (!loading && !leadData)) {
    return (
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-canvas">
        <div className="page-gutter pt-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium mb-3 text-ink-muted"
          >
            <svg
              width="13"
              height="13"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
              Back to Leads
            </button>
          </div>
        <ErrorState
          message={interpolate(PAGE_COPY.leadLoadFailed, { id: leadId })}
          onRetry={onBack}
        />
                </div>
    )
  }

  return (
    <>
      <div className="min-h-full bg-canvas">
        {/* ── Lead header ───────────────────────────────────────────────────── */}
                <div>
          <div className="page-gutter pt-4">
            <button
              type="button"
              onClick={onBack}
              className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <svg
                width="13"
                height="13"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Leads
            </button>
                  </div>

          <div className="page-gutter space-y-3 pb-4">
            <Card className="overflow-hidden p-0">
              <div className="flex min-w-0 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-ink to-primary text-lg font-bold text-surface">
                    {(leadData?.companyName ?? "?").charAt(0)}
                  </div>
                  <div className="min-w-0">
                    {leadData ? (
                      <LeadIdentityEdit
                        key={leadData.id}
                        lead={leadData}
                        editing={editingField}
                        onEdit={setEditingField}
                        onCancel={() => setEditingField(null)}
                        onToast={onToast}
                        readOnly={locked}
                      />
                    ) : (
                      <h1 className="font-display text-xl font-bold text-ink">Loading lead…</h1>
                    )}
                </div>
              </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
                  <IconTooltip label={locked ? lockedReason : "Edit lead"}>
                    <Button variant="secondary" onClick={onEdit} disabled={locked}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Button>
                  </IconTooltip>
                  {leadData && status !== "Dropped/Lost" && !locked ? (
                    <Button variant="solid" onClick={() => setShowConvert(true)}>
                       Convert to Opportunity
                    </Button>
                  ) : null}
                    </div>
                </div>
              <div className="grid grid-cols-1 divide-y divide-line border-t border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <HeaderFact
                  label="Stage"
                  value={stage}
                  hint="Where this lead sits in the pipeline"
                  tone={leadStageClass(stage)}
                />
                <HeaderFact
                  label="Status"
                  value={status}
                  hint={locked ? lockedReason : "Whether work on this lead is active · click to change"}
                  tone={leadStatusClass(status)}
                  onEdit={locked || !leadData?.spectrum ? undefined : () => setShowStatusChange(true)}
                />
                <HeaderFact
                  label="Owner"
                  value={leadData?.assignedSalesperson ?? "—"}
                  hint="Who owns follow-up on this lead"
                  tone="bg-surface text-ink border-line"
                  avatar
                  onEdit={locked ? undefined : () => setEditingField("owner")}
                />
              </div>
              {ALL_STAGES.length > 0 ? (
                <div className="overflow-x-auto border-t border-line px-4 py-3">
                  <LeadStageTrack stages={ALL_STAGES} current={stage} />
                </div>
              ) : null}
            </Card>

            <Card className="overflow-hidden p-0">
            {leadData ? (
              <LeadSummaryEdit
                key={leadData.id}
                lead={leadData}
                entities={NO_ENTITIES}
                contacts={NO_CONTACTS}
                sources={activeLeadSourceNames}
                editing={editingField}
                onEdit={setEditingField}
                onCancel={() => setEditingField(null)}
                onToast={onToast}
                readOnly={locked}
              />
            ) : null}
            </Card>
            <Card className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <ChoiceGroup
                  name="lead-activity-scope"
                  layout="wrap"
                  value={activityScope}
                  onChange={(value) => setActivityScope(value)}
                  options={[
                    { value: "open", label: "Open Activities", count: openActivities.length },
                    { value: "all", label: "All Activities", count: activities.length },
                  ]}
                />
                {locked ? (
                  <span className="text-[11px] font-semibold text-ink-faint" title={lockedReason}></span>
                ) : (
                <Button
                  variant="solid"
                  className="inline-flex !min-h-8 items-center gap-1.5 !px-3 !py-1.5 text-xs"
                  onClick={() => {
                    setFollowUpFrom(null)
                    setShowActivityForm(true)
                  }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Activity
                </Button>
                )}
              </div>
              <div className="p-4">
                {loading ? (
                  <SkeletonOverviewCards count={2} />
                ) : (
                  <ActivitiesTab
                    readOnly={locked}
                    activities={visibleActivities}
                    contacts={NO_CONTACTS}
                    scope={activityScope}
                    onAdd={() => {
                      setFollowUpFrom(null)
                      setShowActivityForm(true)
                    }}
                    onFollowUp={(item) => {
                      setFollowUpFrom(item)
                      setShowActivityForm(true)
                    }}
                    onMarkComplete={(item) => setCompletingActivity(item)}
                    onDelete={(item) => void deleteActivity(item)}
                    onEdit={(item) => {
                      if (!storeActivities.some((a) => a.id === item.id)) {
                        onToast?.("info", "Still saving", "This activity is still being saved — try again in a moment.")
                        return
                      }
                      setEditingActivity(item)
                    }}
                  />
                    )}
                  </div>
            </Card>
          </div>
        </div>

        {/* ── Tabs bar ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-b border-line bg-surface">
          <div className="page-gutter">
            <div
              className="flex min-w-0 items-center overflow-x-auto"
              role="tablist"
              aria-label="Lead detail sections"
            >
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-ink-muted hover:text-ink-soft"
                }`}
              >
                {tab}
                {tab === "Emails" && emails.length > 0 && (
                  <CountBadge value={emails.length} size="sm" tone="primary-soft" className="ml-1.5" />
                )}
                {tab === "Internal Notes / Observations" && notes.length > 0 && (
                  <CountBadge value={notes.length} size="sm" tone="warning-soft" className="ml-1.5" />
                )}
              </button>
            ))}
            </div>
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        <div className="page-gutter py-4">
          {loading && <SkeletonOverviewCards count={6} />}
          {!loading && activeTab === "Timeline" && leadData?.spectrum ? (
            // GET /api/crm/leads/timeline/{leadNo}: 20 at a time, more on scroll; reloads after changes.
            <PagedTimeline
              record="lead"
              recordNo={leadData.spectrum.leadNo}
              refreshKey={`${activities.length}:${notes.length}:${stage}:${status}:${leadData.audit?.modifiedAt ?? ""}`}
              emptySubtitle="Timeline entries will appear as this lead progresses through stages."
            />
          ) : null}
          {!loading && activeTab === "Timeline" && !leadData?.spectrum && (
            <TimelineTab
              timeline={timeline}
              contacts={NO_CONTACTS}
              order={timelineOrder}
              onOrderChange={setTimelineOrder}
            />
          )}
          {!loading && activeTab === "Emails" && (
            <EmailsTab
              emails={emails}
              adding={addingEmail}
              draft={emailDraft}
              onDraft={(patch) => setEmailDraft((prev) => ({ ...prev, ...patch }))}
              onStartAdd={() => {
                setEmailDraft({ subject: "", to: leadData?.email ?? "", body: "" })
                setAddingEmail(true)
              }}
              onCancel={() => {
                setAddingEmail(false)
                setEmailDraft({ subject: "", to: "", body: "" })
              }}
              onSave={saveEmail}
            />
          )}
          {!loading && activeTab === "Status History" && leadData?.spectrum ? (
            <StatusHistory
              record="Lead"
              recordNo={leadData.spectrum.leadNo}
              serverLogs={leadData.spectrum.statusLogs}
              refreshKey={`${status}:${leadData.audit?.modifiedAt ?? ""}`}
            />
          ) : null}
          {!loading && activeTab === "Internal Notes / Observations" && (
            <InternalNotesTab
              // Internal notes stay open on every lead, locked (converted / completed) ones included.
              notes={notes}
              adding={addingNote}
              draft={noteDraft}
              errors={noteErrors}
              onDraft={(patch) => {
                setNoteDraft((prev) => ({ ...prev, ...patch }))
                setNoteErrors((prev) => {
                  const next = { ...prev }
                  if (patch.dateTime !== undefined) delete next.dateTime
                  if (patch.createdBy !== undefined) delete next.createdBy
                  if (patch.text !== undefined) delete next.text
                  return next
                })
              }}
              onStartAdd={() => {
                setNoteDraft(EMPTY_NOTE_DRAFT)
                setNoteErrors({})
                setEditingNoteId(null)
                setAddingNote(true)
              }}
              onCancel={() => {
                setAddingNote(false)
                setNoteDraft(EMPTY_NOTE_DRAFT)
                setNoteErrors({})
                setEditingNoteId(null)
              }}
              onSave={saveNote}
              onDelete={(note) => void deleteNote(note)}
              onEdit={(note) => {
                const saved = storeNotes.find((n) => n.id === note.id)
                if (!saved) {
                  onToast?.("info", "Still saving", "This note is still being saved — try again in a moment.")
                  return
                }
                setNoteDraft({ dateTime: noteDateToInput(saved.date), createdBy: saved.by, text: saved.text })
                setNoteErrors({})
                setEditingNoteId(saved.id)
                setAddingNote(true)
              }}
              editing={Boolean(editingNoteId)}
              editingId={editingNoteId}
            />
          )}
        </div>
      </div>

      {/* ── Overlays ──────────────────────────────────────────────────────────── */}
      {showActivityForm && leadData && (
        <ActivityDrawer
          preselectedLead={{
            id: leadData.id,
            name: leadData.companyName,
            contact: leadData.contactPerson,
          }}
          followUpFrom={followUpFrom}
          onClose={() => {
            setShowActivityForm(false)
            setFollowUpFrom(null)
          }}
          onSave={(a) => {
            addActivity(a)
            setActivities((p) => [a, ...p])
            setFollowUpFrom(null)
            onToast?.(
              "success",
              "Activity Logged",
              `"${a.subject}" has been added.`,
            )
          }}
        />
      )}
      {editingActivity && leadData && (
        <ActivityDrawer
          preselectedLead={{ id: leadData.id, name: leadData.companyName, contact: leadData.contactPerson }}
          editing={editingActivity}
          onClose={() => setEditingActivity(null)}
          onSave={(a) => {
            // Server leads → save-activity-detail with its number (an update), then the lead reloads.
            patchActivity(a.id, a)
            setActivities((prev) => prev.map((item) => (item.id === a.id ? a : item)))
            onToast?.("success", "Activity Updated", `"${a.subject}" has been updated.`)
          }}
        />
      )}
      {showMeetingForm && leadData && (
        <MeetingDrawer
          preselectedLead={{
            id: leadData.id,
            name: leadData.companyName,
            contact: leadData.contactPerson,
          }}
          onClose={() => setShowMeetingForm(false)}
          onSave={(m) => {
            addMeeting(m)
            setMeetings((p) => [m, ...p])
            setActiveTab("Timeline")
            setShowMeetingForm(false)
            onToast?.(
              "success",
              "Meeting Scheduled",
              `"${m.subject}" has been added.`,
            )
          }}
        />
      )}
      {showStatusChange && leadData && (
        <StatusChangeDialog
          record="Lead"
          recordLabel={`Lead ${leadData.spectrum?.code ?? leadData.id} · ${leadData.leadName || leadData.companyName}`}
          currentStatusName={status}
          statuses={leadStatusOptions}
          changedBy={createdByName}
          onClose={() => setShowStatusChange(false)}
          onSubmit={async (change) => {
            await changeLeadStatus(leadData, change)
            setStatus(change.newStatus.name as LeadStatus)
            onToast?.("success", "Status Changed", `Lead status is now ${change.newStatus.name}.`)
          }}
        />
      )}
      {showConvert && leadData && (
        <ConvertOpportunityDialog
          lead={leadData}
          convertedBy={createdByName}
          onCancel={() => setShowConvert(false)}
          onConfirm={async (input) => {
            const created = await convertLead(leadData.id, input)
            if (!created) return
            setStage("Converted to Opportunity")
            setStatus("Converted")
            setShowConvert(false)
            onToast?.(
              "success",
              "Converted to Opportunity",
              `${leadData.companyName} is now in the opportunity pipeline.`,
            )
            onViewOpportunity?.(created.id)
          }}
        />
      )}
      {completingActivity && (
        <CompleteActivityModal
          activity={completingActivity}
          onConfirm={(outcome) => {
            const completion = {
              status: "Completed" as const,
              outcome,
              completeDate: toIsoDate(),
              completeTime: toTimeHHMM(),
            }
            // Saved through the store: server leads → POST /api/crm/leads/save-activity-detail (status Closed,
            // outcome), then the lead reloads. The local update shows it straight away.
            patchActivity(completingActivity.id, completion)
            setActivities((prev) => prev.map((a) => (a.id === completingActivity.id ? { ...a, ...completion } : a)))
            onToast?.(
              "success",
              "Activity Completed",
              `"${completingActivity.subject}" marked as complete.`,
            )
            setCompletingActivity(null)
          }}
          onClose={() => setCompletingActivity(null)}
        />
      )}
      {previewDoc && (
        <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
      {renamingDoc && (
        <RenameDocModal
          doc={renamingDoc}
          onConfirm={async (newName) => {
            if (!(await confirm({ title: "Rename Document", message: `Rename this document to "${newName}"?`, confirmLabel: "Rename" }))) return
            setLeadDocs((prev) =>
              prev.map((d) =>
                d.id === renamingDoc.id ? { ...d, name: newName } : d,
              ),
            )
            onToast?.(
              "success",
              "Document Renamed",
              `File renamed to "${newName}".`,
            )
            setRenamingDoc(null)
          }}
          onClose={() => setRenamingDoc(null)}
        />
      )}
      {deletingDoc && (
        <ConfirmDialog
          title="Delete Document"
          message={`Are you sure you want to delete "${deletingDoc.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            setLeadDocs((prev) => prev.filter((d) => d.id !== deletingDoc.id))
            onToast?.(
              "info",
              "Document Deleted",
              `"${deletingDoc.name}" has been removed.`,
            )
            setDeletingDoc(null)
          }}
          onCancel={() => setDeletingDoc(null)}
        />
      )}
      {/* Hidden file input for document upload */}
      <input
        ref={docFileRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length === 0) return
          const newDocs: LocalDoc[] = await Promise.all(
            files.map(async (f, i) => {
            const typeLabel = fileTypeLbl(f.name)
            const fileType: DocFileType =
              typeLabel === "DOCX" ||
              typeLabel === "XLSX" ||
              typeLabel === "PPTX" ||
              typeLabel === "IMG" ||
              typeLabel === "PDF"
                ? typeLabel
                : "PDF"
            const previewUrl = await readImagePreview(f)
            const created: LocalDoc = {
            id: `DOC-NEW-${Date.now()}-${i}`,
            name: f.name,
              type: typeLabel,
              size: formatFileSize(f.size),
              date: toIsoDate(),
              uploader: "You",
              previewUrl,
            }
            addDocument({
              id: created.id,
              name: created.name,
              fileType,
              size: created.size,
              relatedId: leadId,
              relatedType: "lead",
              relatedName: leadData?.companyName ?? "",
              uploadedBy: created.uploader,
              uploadedDate: created.date,
              category: "General",
              previewUrl,
            })
            return created
            }),
          )
          setLeadDocs((prev) => [...newDocs, ...prev])
          setActiveTab("Timeline")
          onToast?.(
            "success",
            `${files.length} File${files.length > 1 ? "s" : ""} Uploaded`,
            `Document${files.length > 1 ? "s" : ""} added successfully.`,
          )
          e.target.value = ""
        }}
      />
    </>
  )
}
