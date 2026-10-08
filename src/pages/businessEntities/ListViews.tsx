/** The five Business Entities list views, laid out as in Task Management. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchAttachmentImages, openAttachment } from '../../api/attachments'
import { toApiError } from '../../api/errors'
import { BusinessEntityShareMenu } from '../../components/BusinessEntityShareMenu'
import { ColumnVisibilityMenu, useColumnVisibility, type GridColumn } from '../../components/ColumnVisibility'
import { SkeletonTableRows } from '../../components/CRMStates'
import { RecordRowActions } from '../../components/RecordRowActions'
import { useOptionalToast } from '../../contexts/ToastContext'
import { IconTooltip, SortChevrons, type SortDir } from '../../ui'
import { stopBubbleProps } from '../../utils/events'
import { formatDateTime } from '../../utils/dateFormat'
import {
  formatCreditLimit,
  fullAddress,
  groupByLetter,
  type AttachmentListRow,
  type ContactListRow,
  type EntityListRow,
} from './listRows'
import { ICON, Icon } from './ui'

export interface RowHandlers {
  /** Absent without update rights. */
  onEdit?: (businessEntityNo: number) => void
  /** Absent without delete rights. */
  onDelete?: (row: EntityListRow) => void
}

export interface SortProps {
  sort: { field: string; dir: SortDir }
  onSort: (field: string) => void
}

const na = (v: string) => v || 'N/A'

// ─── Shared bits ─────────────────────────────────────────────────────────────

function Truncated({ text, className = '' }: { text: string; className?: string }) {
  return (
    <IconTooltip label={text} overflowOnly className="block min-w-0 max-w-full">
      <span className={`block truncate ${className}`.trim()}>{text}</span>
    </IconTooltip>
  )
}

function ActionButton({ label, d, tone, onClick, size = 'md' }: { label: string; d: string; tone: 'edit' | 'delete' | 'plain'; onClick: () => void; size?: 'sm' | 'md' }) {
  const hover = tone === 'delete' ? 'hover:bg-accent-soft hover:text-accent' : 'hover:bg-primary-soft hover:text-primary'
  return (
    <IconTooltip label={label}>
      <button type="button" aria-label={label} onClick={(e) => { e.stopPropagation(); onClick() }}
        className={`inline-flex items-center justify-center rounded-md text-ink-faint transition-colors ${hover} ${size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'}`}>
        <Icon d={d} size={13} />
      </button>
    </IconTooltip>
  )
}

function TypeBadge({ name, small }: { name: string; small?: boolean }) {
  if (!name) return <span className="text-ink-faint">—</span>
  const tone = name === 'Buy' ? 'border-primary/30 bg-primary-soft text-primary' : 'border-success-line bg-success-soft text-success'
  return (
    <span title={name} className={`inline-flex max-w-full truncate rounded-md border font-semibold leading-none ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'} ${tone}`}>
      {name}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const active = (status || 'Active') === 'Active'
  return (
    <span className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-semibold ${active ? 'border-success-line bg-success-soft text-success' : 'border-line bg-surface-hover text-ink-muted'}`}>
      {status || 'Active'}
    </span>
  )
}

function Initials({ name, tint, size = 'md' }: { name: string; tint?: boolean; size?: 'md' | 'lg' }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-lg font-semibold uppercase ${size === 'lg' ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-xs'} ${tint ? 'bg-primary-soft text-primary' : 'bg-primary text-surface'}`}>
      {name ? name.substring(0, 2) : 'BE'}
    </div>
  )
}

function AlphabetHeader({ letter, note }: { letter: string; note: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between rounded-lg bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
      <span>Alphabet {letter}</span>
      <span className="font-medium opacity-70">{note}</span>
    </div>
  )
}

type EntityColumnKey =
  | 'code' | 'name' | 'typeName' | 'address' | 'city' | 'state' | 'country' | 'vatGst' | 'creditLimit' | 'actions'

const ENTITY_COLUMNS: (GridColumn<EntityColumnKey> & { sort?: string })[] = [
  { key: 'code', label: 'Code', sort: 'code', locked: true },
  { key: 'name', label: 'Business Entity Name', sort: 'name' },
  { key: 'typeName', label: 'Type', sort: 'typeName' },
  { key: 'address', label: 'Primary Address', sort: 'address' },
  { key: 'city', label: 'City', sort: 'city' },
  { key: 'state', label: 'State', sort: 'state' },
  { key: 'country', label: 'Country', sort: 'country' },
  { key: 'vatGst', label: 'VAT/GST No.', sort: 'vatGst' },
  { key: 'creditLimit', label: 'Credit Limit', sort: 'creditLimit' },
  { key: 'actions', label: 'Actions', locked: true },
]

type ContactColumnKey =
  | 'name' | 'entityName' | 'designation' | 'department' | 'phone' | 'email' | 'status' | 'actions'

const CONTACT_COLUMNS: (GridColumn<ContactColumnKey> & { sort?: string })[] = [
  { key: 'name', label: 'Contact Name', sort: 'name', locked: true },
  { key: 'entityName', label: 'Business Entity', sort: 'entityName' },
  { key: 'designation', label: 'Designation', sort: 'designation' },
  { key: 'department', label: 'Department', sort: 'department' },
  { key: 'phone', label: 'Phone', sort: 'phone' },
  { key: 'email', label: 'Email', sort: 'email' },
  { key: 'status', label: 'Status', sort: 'status' },
  { key: 'actions', label: 'Actions', locked: true },
]

function SortHeader({
  label,
  field,
  sort,
  onSort,
  className = '',
  menu,
}: {
  label: string
  field?: string
  className?: string
  menu?: ReactNode
} & SortProps) {
  return (
    <th
      onClick={field ? () => onSort(field) : undefined}
      className={`${field ? 'cursor-pointer select-none' : ''} ${className}`.trim()}
    >
      {menu ? (
        <span className="inline-flex items-center gap-1.5">
          {label}
          {menu}
        </span>
      ) : (
        <span className="flex items-center justify-between gap-2">
          {label}
          {field ? <SortChevrons active={sort.field === field} dir={sort.dir} /> : null}
        </span>
      )}
    </th>
  )
}

// ─── Grid list ───────────────────────────────────────────────────────────────

export function EntityTable({
  rows,
  onEdit,
  onDelete,
  sort,
  onSort,
  loading,
  empty,
}: {
  rows: EntityListRow[]
  loading?: boolean
  empty?: ReactNode
} & RowHandlers & SortProps) {
  const columns = useColumnVisibility('crm.entities.hiddenColumns', ENTITY_COLUMNS)
  const show = columns.isVisible
  const colSpan = columns.visibleColumns.length
  const sp = { sort, onSort }

  return (
    <>
      {/* Phones: one card per entity. */}
      <div className="flex flex-col gap-2 p-2 md:hidden">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-line bg-surface-muted px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <button type="button" className={`min-w-0 flex-1 text-left ${onEdit ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={() => onEdit?.(row.businessEntityNo)}>
                <span className="block truncate font-mono text-xs font-semibold text-primary">{row.code}</span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{row.name}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
                  {row.typeName ? <TypeBadge name={row.typeName} small /> : null}
                  <span className="truncate">{[row.city, row.state, row.country].filter(Boolean).join(', ') || '—'}</span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-0.5">
                {onEdit ? <ActionButton label="Edit" d={ICON.edit} tone="edit" onClick={() => onEdit(row.businessEntityNo)} /> : null}
                {onDelete ? <ActionButton label="Delete" d={ICON.trash} tone="delete" onClick={() => onDelete(row)} /> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      <table className="crm-table crm-table-entities hidden md:table">
        <thead>
          <tr>
            {columns.visibleColumns.map((column) => {
              const sticky = column.key === 'actions' ? 'sticky-col-end' : column.key === 'code' ? 'sticky-col-id' : ''
              return (
                <SortHeader
                  key={column.key}
                  label={column.label}
                  field={column.sort}
                  className={sticky}
                  menu={
                    column.key === 'actions' ? (
                      <ColumnVisibilityMenu
                        columns={ENTITY_COLUMNS}
                        isVisible={columns.isVisible}
                        onToggle={columns.toggle}
                        onShowAll={columns.showAll}
                        hiddenCount={columns.hiddenCount}
                      />
                    ) : undefined
                  }
                  {...sp}
                />
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? <SkeletonTableRows cols={colSpan} rows={7} /> : null}
          {!loading && rows.length === 0 && empty ? (
            <tr>
              <td colSpan={colSpan} className="table-empty-td">{empty}</td>
            </tr>
          ) : null}
          {!loading && rows.map((row) => (
            <tr
              key={row.key}
              className={onEdit ? 'cursor-pointer' : undefined}
              onClick={() => onEdit?.(row.businessEntityNo)}
            >
              <td className="sticky-col-id">
                <button
                  type="button"
                  className="font-mono text-xs font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit?.(row.businessEntityNo)
                  }}
                >
                  {row.code}
                </button>
              </td>
              {show('name') && (
                <td>
                  <Truncated text={row.name} className="text-xs font-bold text-ink" />
                </td>
              )}
              {show('typeName') && (
                <td><TypeBadge name={row.typeName} /></td>
              )}
              {show('address') && (
                <td>
                  <Truncated text={fullAddress(row) || 'N/A'} className="text-xs text-ink-soft" />
                </td>
              )}
              {show('city') && (
                <td><Truncated text={na(row.city)} className="text-xs text-ink-soft" /></td>
              )}
              {show('state') && (
                <td><Truncated text={na(row.state)} className="text-xs text-ink-soft" /></td>
              )}
              {show('country') && (
                <td><Truncated text={na(row.country)} className="text-xs text-ink-soft" /></td>
              )}
              {show('vatGst') && (
                <td><Truncated text={na(row.vatGst)} className="font-mono text-xs text-ink-soft" /></td>
              )}
              {show('creditLimit') && (
                <td><Truncated text={formatCreditLimit(row.creditLimit)} className="text-xs text-ink-soft" /></td>
              )}
              <td className="sticky-col-end" {...stopBubbleProps}>
                <RecordRowActions
                  editLabel="Edit Business Entity"
                  deleteLabel="Delete Business Entity"
                  onEdit={onEdit ? () => onEdit(row.businessEntityNo) : undefined}
                  onDelete={onDelete ? () => onDelete(row) : undefined}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// ─── Album ───────────────────────────────────────────────────────────────────

function Detail({ label, text, wide }: { label: string; text: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'col-span-2' : ''}`}>
      <span className={`mb-0.5 block text-[9px] font-semibold ${label === 'Primary Location' ? 'text-primary' : 'text-ink-faint'}`}>{label}</span>
      <Truncated text={text} className="font-medium text-ink" />
    </div>
  )
}

export function EntityAlbum({ rows, onEdit, onDelete }: { rows: EntityListRow[] } & RowHandlers) {
  return (
    <div className="space-y-5 p-3">
      {groupByLetter(rows, (r) => r.name).map((group) => (
        <div key={group.letter} className="relative space-y-3">
          <AlphabetHeader letter={group.letter} note={`${group.rows.length} Entities`} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {group.rows.map((row) => (
              <article key={row.key} className="group flex flex-col gap-3 overflow-hidden rounded-lg border border-line bg-surface p-3.5 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Initials name={row.name} />
                    <div className="min-w-0">
                      <Truncated text={row.name} className="text-xs font-semibold leading-tight text-ink group-hover:text-primary" />
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                        <span className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[9px] font-semibold text-ink-soft">{row.code}</span>
                        <TypeBadge name={row.typeName} small />
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {onEdit ? <ActionButton label="Edit" d={ICON.edit} tone="edit" size="sm" onClick={() => onEdit(row.businessEntityNo)} /> : null}
                    {onDelete ? <ActionButton label="Delete" d={ICON.trash} tone="delete" size="sm" onClick={() => onDelete(row)} /> : null}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-y border-line py-1.5 text-[11px]">
                  <Detail wide label="Primary Location" text={na(row.address)} />
                  <Detail label="City & PIN Code" text={[row.city, row.pinCode].filter(Boolean).join(' - ') || 'N/A'} />
                  <Detail label="State & Country" text={[row.state, row.country].filter(Boolean).join(', ') || 'N/A'} />
                  <Detail wide label="Credit limit & GST" text={`${formatCreditLimit(row.creditLimit)}${row.vatGst ? ` | GST: ${row.vatGst}` : ''}`} />
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-0.5 text-[10px] font-medium text-ink-faint">
                  <span className="flex min-w-0 items-center gap-1">
                    <Icon d={ICON.user} size={10} className="shrink-0" />
                    <span className="shrink-0">Created By:</span>
                    <Truncated text={row.createdBy || 'System'} className="font-semibold text-ink-soft" />
                  </span>
                  <span className="shrink-0 text-[9px] font-semibold">{row.createdDate ? formatDateTime(row.createdDate, '') : ''}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Contacts ────────────────────────────────────────────────────────────────

function shareInfo(row: ContactListRow) {
  return { companyName: row.entityName, companyCode: row.code, name: row.name, designation: row.designation, department: row.department, phone: row.phone, email: row.email }
}

export function ContactTable({
  rows,
  onEdit,
  sort,
  onSort,
  loading,
  empty,
}: {
  rows: ContactListRow[]
  loading?: boolean
  empty?: ReactNode
} & RowHandlers & SortProps) {
  const columns = useColumnVisibility('crm.entityContacts.hiddenColumns', CONTACT_COLUMNS)
  const show = columns.isVisible
  const colSpan = columns.visibleColumns.length
  const sp = { sort, onSort }

  return (
    <table className="crm-table crm-table-entities">
      <thead>
        <tr>
          {columns.visibleColumns.map((column) => {
            const sticky = column.key === 'actions' ? 'sticky-col-end' : column.key === 'name' ? 'sticky-col-start' : ''
            return (
              <SortHeader
                key={column.key}
                label={column.label}
                field={column.sort}
                className={sticky}
                menu={
                  column.key === 'actions' ? (
                    <ColumnVisibilityMenu
                      columns={CONTACT_COLUMNS}
                      isVisible={columns.isVisible}
                      onToggle={columns.toggle}
                      onShowAll={columns.showAll}
                      hiddenCount={columns.hiddenCount}
                    />
                  ) : undefined
                }
                {...sp}
              />
            )
          })}
        </tr>
      </thead>
      <tbody>
        {loading ? <SkeletonTableRows cols={colSpan} rows={7} /> : null}
        {!loading && rows.length === 0 && empty ? (
          <tr>
            <td colSpan={colSpan} className="table-empty-td">{empty}</td>
          </tr>
        ) : null}
        {!loading && rows.map((row) => (
          <tr
            key={row.key}
            className={onEdit ? 'cursor-pointer' : undefined}
            onClick={() => onEdit?.(row.businessEntityNo)}
          >
            <td className="sticky-col-start">
              <Truncated text={row.name} className="text-xs font-bold text-ink" />
            </td>
            {show('entityName') && (
              <td><Truncated text={row.entityName} className="text-xs font-semibold text-ink-soft" /></td>
            )}
            {show('designation') && (
              <td><Truncated text={na(row.designation)} className="text-xs text-ink-soft" /></td>
            )}
            {show('department') && (
              <td><Truncated text={na(row.department)} className="text-xs text-ink-soft" /></td>
            )}
            {show('phone') && (
              <td><Truncated text={na(row.phone)} className="font-mono text-xs text-ink-soft" /></td>
            )}
            {show('email') && (
              <td><Truncated text={na(row.email)} className="text-xs text-ink-soft" /></td>
            )}
            {show('status') && (
              <td><StatusChip status={row.status} /></td>
            )}
            <td className="sticky-col-end" {...stopBubbleProps}>
              <div className="flex items-center gap-0.5">
                <BusinessEntityShareMenu mode="contact" contact={shareInfo(row)} />
                <RecordRowActions
                  editLabel="Edit Business Entity"
                  onEdit={onEdit ? () => onEdit(row.businessEntityNo) : undefined}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function ContactAlbum({ rows, onEdit }: { rows: ContactListRow[] } & RowHandlers) {
  return (
    <div className="space-y-5 p-3">
      {groupByLetter(rows, (r) => r.entityName).map((group) => (
        <div key={group.letter} className="relative space-y-3">
          <AlphabetHeader letter={group.letter} note="Contact Cards" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {group.rows.map((row) => (
              <article key={row.key} className="group flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm transition-all hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Initials name={row.name || 'CP'} size="lg" />
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-semibold leading-tight text-ink">{row.name}</h4>
                      <p className="mt-0.5 truncate text-[10px] font-medium text-ink-faint">
                        {row.designation || 'Representative'} ({row.department || 'General'})
                      </p>
                    </div>
                  </div>
                  <StatusChip status={row.status} />
                </div>
                <div className="space-y-1 border-t border-line pt-2 text-[11px] font-medium text-ink-muted">
                  <span className={`block truncate font-semibold text-ink ${onEdit ? 'cursor-pointer hover:text-primary' : ''}`}
                    onClick={() => onEdit?.(row.businessEntityNo)}>{row.entityName}</span>
                  <div className="flex justify-between gap-2"><span className="text-ink-faint">Phone:</span><span className="font-mono text-ink-soft">{na(row.phone)}</span></div>
                  <div className="flex min-w-0 justify-between gap-2">
                    <span className="shrink-0 text-ink-faint">Email:</span>
                    <div className="min-w-0 max-w-[170px]"><Truncated text={na(row.email)} className="text-right text-ink-soft" /></div>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-line pt-2">
                  <span className="text-[10px] font-medium text-ink-faint">Code: {row.code}</span>
                  <div className="flex items-center gap-0.5">
                    <BusinessEntityShareMenu mode="contact" contact={shareInfo(row)} />
                    {onEdit ? (
                      <button type="button" onClick={() => onEdit(row.businessEntityNo)}
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-ink-muted hover:bg-primary-soft hover:text-primary">
                        <Icon d={ICON.edit} size={11} /> Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Attachments ─────────────────────────────────────────────────────────────

const IMAGE = /\.(jpe?g|png|gif|webp)$/i

function fileTone(name: string) {
  if (/\.pdf$/i.test(name)) return 'bg-accent-soft text-accent'
  if (/\.(xlsx?|csv)$/i.test(name)) return 'bg-success-soft text-success'
  if (/\.docx?$/i.test(name)) return 'bg-primary-soft text-primary'
  return 'bg-surface-hover text-ink-muted'
}

function sizeLabel(bytes: number | null, fallback: string) {
  return bytes ? `${(bytes / 1024).toFixed(1)} KB` : fallback
}

/** Image preview, fetched once it comes near the viewport; click to enlarge. */
function Thumbnail({ docNo, name, onPreview }: { docNo: number; name: string; onPreview: (src: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || near) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNear(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [near])

  // Fetched once; only leaving the page cancels it.
  useEffect(() => {
    if (!near) return
    const controller = new AbortController()
    setLoading(true)
    fetchAttachmentImages([docNo], controller.signal)
      .then((images) => setSrc(images.get(docNo) ?? images.values().next().value ?? null))
      .catch(() => setSrc(null))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [near, docNo])

  return (
    <div ref={ref} className="group/thumb absolute inset-0 flex items-center justify-center overflow-hidden bg-surface-hover">
      {loading ? (
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading image" />
      ) : src ? (
        <>
          <img src={src} alt={name} className="h-full w-full object-cover" />
          <button type="button" onClick={() => onPreview(src)} aria-label={`Preview ${name}`}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/thumb:opacity-100">
            <Icon d={ICON.eye} size={16} className="text-white" />
          </button>
        </>
      ) : (
        <Icon d={ICON.image} size={18} className="text-ink-faint" />
      )}
    </div>
  )
}

function useDownload() {
  const toast = useOptionalToast()
  const [busy, setBusy] = useState<number | null>(null)
  const download = (row: AttachmentListRow) => {
    setBusy(row.attachmentNo)
    openAttachment({ id: row.attachmentNo, name: row.fileName })
      .catch((err) => toast.addToast('error', 'Could not download the file', toApiError(err).message))
      .finally(() => setBusy(null))
  }
  return { busy, download }
}

export function AttachmentGroups({ rows, onEdit, onPreview }: { rows: AttachmentListRow[]; onPreview: (src: string) => void } & RowHandlers) {
  const { busy, download } = useDownload()
  return (
    <div className="space-y-5 p-3">
      {groupByLetter(rows, (r) => r.entityName).map((group) => {
        const entities = new Map<number, AttachmentListRow[]>()
        for (const row of group.rows) entities.set(row.businessEntityNo, [...(entities.get(row.businessEntityNo) ?? []), row])
        return (
          <div key={group.letter} className="relative space-y-3">
            <AlphabetHeader letter={group.letter} note={`${entities.size} Entities`} />
            <div className="space-y-3">
              {[...entities.values()].map((files) => {
                const first = files[0]
                return (
                  <div key={first.businessEntityNo} className="rounded-lg border border-line bg-surface-muted p-4">
                    <div className="mb-3 flex items-center justify-between gap-3 border-b border-line pb-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Initials name={first.entityName} tint />
                        <div className="min-w-0">
                          <h4 className={`truncate text-xs font-semibold text-ink ${onEdit ? 'cursor-pointer hover:text-primary' : ''}`}
                            onClick={() => onEdit?.(first.businessEntityNo)}>{first.entityName}</h4>
                          <p className="text-[10px] font-medium text-ink-faint">{[first.code, first.typeName].filter(Boolean).join(' • ')}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold text-ink-muted">
                        {files.length} Document(s)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {files.map((file) =>
                        IMAGE.test(file.fileName) ? (
                          <article key={file.key} className="group relative h-48 overflow-hidden rounded-lg border border-line bg-surface transition-all hover:border-primary/30 hover:shadow-md">
                            <Thumbnail docNo={file.attachmentNo} name={file.fileName} onPreview={onPreview} />
                            <div className="pointer-events-none absolute bottom-2 right-2 z-10 flex flex-col items-end gap-1.5 rounded-lg border border-white/20 bg-black/50 p-2.5 opacity-0 backdrop-blur-md transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
                              <div className="text-right">
                                <h5 className="max-w-[150px] truncate text-[11px] font-semibold text-white">{file.fileName}</h5>
                                <p className="mt-0.5 font-mono text-[9px] text-white/80">{sizeLabel(file.fileSize, 'Image')} {file.fileType}</p>
                              </div>
                              <div className="flex items-center gap-1">
                                <BusinessEntityShareMenu mode="attachment" docNo={file.attachmentNo} fileName={file.fileName} companyName={file.entityName} />
                                <button type="button" disabled={busy === file.attachmentNo} onClick={() => download(file)}
                                  className="inline-flex h-6 items-center gap-1 rounded border border-white/10 bg-white/10 px-2 text-[9px] font-semibold text-white hover:bg-white/25 disabled:opacity-60">
                                  <Icon d={ICON.download} size={10} /> {busy === file.attachmentNo ? 'Opening…' : 'Download'}
                                </button>
                              </div>
                            </div>
                          </article>
                        ) : (
                          <article key={file.key} className="group flex flex-col justify-between gap-3 rounded-lg border border-line bg-surface p-3.5 transition-all hover:border-primary/30 hover:shadow-md">
                            <div className="flex items-start gap-3">
                              <div className={`flex shrink-0 items-center justify-center rounded-lg p-2 ${fileTone(file.fileName)}`}>
                                <Icon d={ICON.note} size={18} />
                              </div>
                              <div className="min-w-0">
                                <h5 className="truncate text-xs font-semibold leading-snug text-ink group-hover:text-primary">{file.fileName}</h5>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <p className="font-mono text-[9px] font-medium text-ink-faint">{sizeLabel(file.fileSize, 'Attached Document')}</p>
                                  {file.fileType ? <span className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 text-[8px] font-semibold text-ink-muted">{file.fileType}</span> : null}
                                </div>
                              </div>
                            </div>
                            <div className="mt-auto flex items-center justify-end gap-1 border-t border-line pt-2">
                              <BusinessEntityShareMenu mode="attachment" docNo={file.attachmentNo} fileName={file.fileName} companyName={file.entityName} />
                              <button type="button" disabled={busy === file.attachmentNo} onClick={() => download(file)}
                                className="inline-flex h-7 items-center rounded-md border border-success-line px-2.5 text-[10px] font-semibold text-success hover:bg-success-soft disabled:opacity-60">
                                {busy === file.attachmentNo ? 'Opening…' : 'Download'}
                              </button>
                            </div>
                          </article>
                        ),
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
