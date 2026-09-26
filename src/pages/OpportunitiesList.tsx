import { useState } from 'react'
import { api } from '../api/crm'
import { useApiQuery } from '../api/useApiQuery'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import ActivityDrawer from '../components/ActivityDrawer'
import NoteDrawer from '../components/NoteDrawer'
import EmailDrawer from '../components/EmailDrawer'
import { RowQuickMenu } from '../components/RowQuickMenu'
import { RecordRowActions } from '../components/RecordRowActions'
import { EmptyIcons, EmptyState, NoResults, SkeletonTableRows } from '../components/CRMStates'
import { useCrmActions } from '../contexts/CrmStoreContext'
import { formatLeadDate } from '../data/leads'
import { formatDealValue, dealStageClass, type Opportunity } from '../data/opportunities'
import { Button, IconTooltip, MultiSelect, PageHeader, PageLoader } from '../ui'
import { PersonContactCard } from '../components/PersonContactCard'
import type { ToastType } from '../components/Toast'
import { PAGE_COPY } from '../constants/messages'

const PAGE_SIZE = 10

interface OpportunitiesListProps {
  onView: (id: string) => void
  onEdit: (id: string) => void
  onCreate?: () => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}

export default function OpportunitiesList({ onView, onEdit, onCreate, onToast }: OpportunitiesListProps) {
  const { addActivity, addNote, addEmail, removeOpportunity } = useCrmActions()
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Opportunity | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [activityOpp, setActivityOpp] = useState<Opportunity | null>(null)
  const [noteOpp, setNoteOpp] = useState<Opportunity | null>(null)
  const [emailOpp, setEmailOpp] = useState<Opportunity | null>(null)
  const [stageFilter, setStageFilter] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data: meta } = useApiQuery(() => api.opportunities.meta(), [])
  const { data, loading } = useApiQuery(
    () =>
      api.opportunities.list({
        q: search,
        stages: stageFilter,
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, stageFilter, page],
  )
  const paged = data?.items ?? []
  const total = data?.total ?? 0
  const dealSum = data?.totals.dealValue ?? 0
  const weightedSum = data?.totals.weightedValue ?? 0
  const stageOptions = meta?.stages.map((item) => item.value) ?? []
  const hasFilters = Boolean(search || stageFilter.length)
  const allOnPageSelected = paged.length > 0 && paged.every((item) => selected.has(item.id))

  function clearFilters() {
    setSearch('')
    setStageFilter([])
    setPage(1)
    clearSelection()
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const pageIds = paged.map((item) => item.id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id))
      else pageIds.forEach((id) => next.add(id))
      return next
    })
  }

  function clearSelection() {
    setSelected(new Set())
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        bordered
        title="Opportunities"
        subtitle={
          <>
            {total} deal{total !== 1 ? 's' : ''}
            <span className="mx-1.5">·</span>
            Opportunity Value: <strong className="text-accent">{formatDealValue(dealSum)}</strong>
            <span className="mx-1.5">·</span>
            Weighted Value: <strong className="text-primary">{formatDealValue(weightedSum)}</strong>
          </>
        }
        actions={
          onCreate ? (
            <Button variant="solid" onClick={onCreate}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Opportunity
            </Button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <div className="relative min-w-48 max-w-72 flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint"
              width="13"
              height="13"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search opportunities…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
                clearSelection()
              }}
              className="form-input w-full !pl-9 text-xs"
              aria-label="Search opportunities"
            />
          </div>
          <MultiSelect
            size="compact"
            aria-label="Opportunity Stage"
            placeholder="All Opportunity Stages"
            options={stageOptions}
            value={stageFilter}
            onChange={(next) => {
              setStageFilter(next)
              setPage(1)
              clearSelection()
            }}
          />
          {hasFilters ? (
            <Button variant="secondary" className="!min-h-8 !px-3 !py-1.5 text-xs text-accent" onClick={clearFilters}>
              {PAGE_COPY.clearFilters}
            </Button>
          ) : null}
        </div>
      </PageHeader>

      {selected.size > 0 ? (
        <div className="page-gutter flex items-center gap-3 border-b border-line-strong bg-primary-soft py-2 text-xs">
          <span className="font-bold text-primary">{selected.size} selected</span>
          <button
            type="button"
            className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Assign
          </button>
          <button
            type="button"
            className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Change Stage
          </button>
          <button
            type="button"
            className="ml-auto font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            onClick={() => setConfirmBulkDelete(true)}
          >
            Delete
          </button>
        </div>
      ) : null}

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="page-gutter flex h-full min-w-0 flex-col">
          <div className="table-scroll relative min-h-0 min-w-0 flex-1" aria-busy={loading}>
            {loading && <PageLoader label={PAGE_COPY.pageLoading} />}
            <table className="crm-table crm-table-opps">
              <thead>
                <tr>
                  <th className="sticky-col-check" style={{ padding: '10px 12px' }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      aria-label="Select all opportunities on this page"
                    />
                  </th>
                  <th className="sticky-col-id">Opportunity ID</th>
                  <th>Opportunity Name</th>
                  <th>Business Entity Name</th>
                  <th>Primary Contact</th>
                  <th>Products Required</th>
                  <th>Opportunity Value</th>
                  <th>Opportunity Stage</th>
                  <th>Weight %</th>
                  <th>Weighted Value</th>
                  <th>Closing Date</th>
                  <th>Owner</th>
                  <th>Last Activity</th>
                  <th className="sticky-col-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonTableRows cols={14} rows={6} />}
                {!loading && total === 0 && !hasFilters && (
                  <tr>
                    <td colSpan={14}>
                      <EmptyState
                        icon={EmptyIcons.leads}
                        title="No opportunities yet"
                        subtitle="Convert a qualified lead to create the first opportunity."
                      />
                    </td>
                  </tr>
                )}
                {!loading && total === 0 && hasFilters && (
                  <tr>
                    <td colSpan={14}>
                      <NoResults onClear={clearFilters} />
                    </td>
                  </tr>
                )}
                {!loading &&
                  paged.map((item) => (
                    <OpportunityRow
                      key={item.id}
                      item={item}
                      selected={selected.has(item.id)}
                      onToggleSelect={() => toggleSelect(item.id)}
                      onView={() => onView(item.id)}
                      onEdit={() => onEdit(item.id)}
                      onDelete={() => setConfirmDelete(item)}
                      onAddActivity={() => setActivityOpp(item)}
                      onAddNote={() => setNoteOpp(item)}
                      onSendEmail={() => setEmailOpp(item)}
                    />
                  ))}
              </tbody>
              {!loading && total > 0 ? (
                <tfoot>
                  <tr>
                    <td className="sticky-col-check" />
                    <td className="sticky-col-id" />
                    <td colSpan={4} className="text-xs font-bold text-ink-soft">
                      Totals ({total})
                    </td>
                    <td className="text-xs font-bold text-accent">{formatDealValue(dealSum)}</td>
                    <td />
                    <td />
                    <td className="text-xs font-bold text-primary">{formatDealValue(weightedSum)}</td>
                    <td colSpan={3} />
                    <td className="sticky-col-end" />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      </div>

      <div className="page-gutter w-full border-t border-line bg-surface py-2.5 text-ink-muted">
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          onPageChange={(next) => {
            setPage(next)
            clearSelection()
          }}
          end={
            <span>
              Opportunity Value:&nbsp;<strong className="text-accent">{formatDealValue(dealSum)}</strong>
              <span className="mx-1.5">·</span>
              Weighted Value:&nbsp;<strong className="text-primary">{formatDealValue(weightedSum)}</strong>
            </span>
          }
        />
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete Opportunity"
          message={`Are you sure you want to delete opportunity ${confirmDelete.id}? This action cannot be undone.`}
          confirmLabel="Delete Opportunity"
          danger
          onConfirm={() => {
            removeOpportunity(confirmDelete.id)
            setSelected((prev) => {
              const next = new Set(prev)
              next.delete(confirmDelete.id)
              return next
            })
            onToast?.('success', 'Opportunity Deleted', `${confirmDelete.name} has been removed.`)
            setConfirmDelete(null)
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}
      {confirmBulkDelete ? (
        <ConfirmDialog
          title="Delete Opportunities"
          message={`Delete ${selected.size} selected opportunit${selected.size === 1 ? 'y' : 'ies'}? This action cannot be undone.`}
          confirmLabel="Delete Selected"
          danger
          onConfirm={() => {
            const count = selected.size
            selected.forEach((id) => removeOpportunity(id))
            clearSelection()
            onToast?.('success', 'Opportunities Deleted', `${count} record${count === 1 ? '' : 's'} removed.`)
            setConfirmBulkDelete(false)
          }}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      ) : null}
      {activityOpp ? (
        <ActivityDrawer
          preselectedLead={{
            id: activityOpp.leadId || activityOpp.id,
            name: activityOpp.companyName,
            contact: activityOpp.contactPerson,
          }}
          onClose={() => setActivityOpp(null)}
          onSave={(activity) => {
            addActivity(activity)
            onToast?.('success', 'Activity Logged', `"${activity.subject}" has been added.`)
          }}
        />
      ) : null}
      {noteOpp ? (
        <NoteDrawer
          preselectedLead={{ id: noteOpp.leadId || noteOpp.id, name: noteOpp.companyName }}
          onClose={() => setNoteOpp(null)}
          onSave={(note) => {
            addNote(note)
            onToast?.('success', 'Note Added', 'The note has been saved on this opportunity.')
          }}
        />
      ) : null}
      {emailOpp ? (
        <EmailDrawer
          preselectedLead={{
            id: emailOpp.leadId || emailOpp.id,
            name: emailOpp.companyName,
            contact: emailOpp.contactPerson,
            email: emailOpp.email,
          }}
          onClose={() => setEmailOpp(null)}
          onSave={(mail) => {
            addEmail(mail)
            onToast?.('success', 'Email Sent', `"${mail.subject}" opened in your mail app.`)
          }}
        />
      ) : null}
    </div>
  )
}

function OpportunityRow({
  item,
  selected,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onAddActivity,
  onAddNote,
  onSendEmail,
}: {
  item: Opportunity
  selected: boolean
  onToggleSelect: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onAddActivity: () => void
  onAddNote: () => void
  onSendEmail: () => void
}) {
  return (
    <tr
      className={`cursor-pointer ${selected ? 'is-selected' : ''}`}
      onClick={onView}
    >
      <td className="sticky-col-check" style={{ padding: '9px 12px' }} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${item.id}`}
        />
      </td>
      <td className="sticky-col-id">
        <button
          type="button"
          className="font-mono text-xs font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={(e) => {
            e.stopPropagation()
            onView()
          }}
        >
          {item.id}
        </button>
      </td>
      <td>
        <IconTooltip label={item.name} overflowOnly className="max-w-52">
          <span className="block truncate text-xs font-bold text-ink">
            {item.name}
          </span>
        </IconTooltip>
      </td>
      <td>
        <IconTooltip label={item.companyName} overflowOnly className="max-w-44">
          <span className="block truncate text-xs font-semibold text-ink-soft">{item.companyName}</span>
        </IconTooltip>
      </td>
      <td className="whitespace-normal" onClick={(e) => e.stopPropagation()}>
        <PersonContactCard
          name={item.contactPerson}
          email={item.email}
          phone={item.phone}
          company={item.companyName}
        />
      </td>
      <td>
        <IconTooltip label={item.productsRequired} overflowOnly className="max-w-32">
          <span className="block truncate text-xs text-ink-soft">{item.productsRequired}</span>
        </IconTooltip>
      </td>
      <td>
        <span className="text-xs font-bold text-accent">{formatDealValue(item.dealValue, item.valueCurrency)}</span>
      </td>
      <td>
        <span className={`badge ${dealStageClass(item.dealStage)}`}>{item.dealStage}</span>
      </td>
      <td>
        <span className="text-xs font-semibold text-ink">{item.weightPercent}%</span>
      </td>
      <td>
        <span className="text-xs font-bold text-primary">{formatDealValue(item.weightedValue, item.valueCurrency)}</span>
      </td>
      <td>
        <span className="text-xs text-ink-soft">{formatLeadDate(item.closingDate)}</span>
      </td>
      <td>
        <span className="text-xs text-ink-soft">{item.owner}</span>
      </td>
      <td>
        <span className="text-xs text-ink-faint">{item.lastActivity}</span>
      </td>
      <td className="sticky-col-end" onClick={(e) => e.stopPropagation()}>
        <RecordRowActions
          viewLabel="View Opportunity"
          editLabel="Edit Opportunity"
          deleteLabel="Delete Opportunity"
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        >
          <RowQuickMenu
            onAddActivity={onAddActivity}
            onAddNote={onAddNote}
            onSendEmail={onSendEmail}
          />
        </RecordRowActions>
      </td>
    </tr>
  )
}
