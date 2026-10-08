import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/crm'
import { useApiQuery } from '../api/useApiQuery'
import { bySequence } from '../api/fillValues'
import { useServerOpportunitySync } from '../components/useServerLeadSync'
import { useOpportunityFillValues } from '../components/useOpportunityFillValues'
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice'
import { stageBadgeStyle, useOpportunityStageColors } from '../components/useOpportunityStageColors'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import ActivityDrawer from '../components/ActivityDrawer'
import { RowQuickMenu } from '../components/RowQuickMenu'
import { RecordRowActions } from '../components/RecordRowActions'
import { EmptyIcons, EmptyState, NoResults, SkeletonTableRows } from '../components/CRMStates'
import { useCrmActions } from '../contexts/CrmStoreContext'
import { formatAuditStamp, formatLeadDate, formatMoneyTotals } from '../data/leads'
import { formatDealValue, dealStageClass, type Opportunity } from '../data/opportunities'
import { Button, IconTooltip, MultiSelect, PageHeader, PageLoader } from '../ui'
import { PersonContactCard } from '../components/PersonContactCard'
import type { ToastType } from '../components/Toast'
import { PAGE_COPY } from '../constants/messages'
import { ColumnVisibilityMenu, useColumnVisibility, type GridColumn } from '../components/ColumnVisibility'

const PAGE_SIZE = 10

interface OpportunitiesListProps {
  onView: (id: string) => void
  onEdit: (id: string) => void
  onCreate?: () => void
  onToast?: (type: ToastType, title: string, message?: string) => void
}

export default function OpportunitiesList({ onView, onEdit, onCreate, onToast }: OpportunitiesListProps) {
  const { addActivity, removeOpportunity } = useCrmActions()
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Opportunity | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [activityOpp, setActivityOpp] = useState<Opportunity | null>(null)
  // Dashboard pipeline links open the list as `?stage=…`.
  const [searchParams] = useSearchParams()
  const [stageFilter, setStageFilter] = useState<string[]>(() => searchParams.getAll('stage'))
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Show / hide grid columns (Actions header menu); remembered in this browser.
  const columns = useColumnVisibility('crm.opportunities.hiddenColumns', OPPORTUNITY_COLUMNS)
  // Checkbox column + visible columns.
  const gridColSpan = columns.visibleColumns.length + 1
  // Server opportunities only (synced into the store from search-data) — sample ones are never shown.
  const serverSync = useServerOpportunitySync()
  const { values: oppFill } = useOpportunityFillValues()
  const stageColor = useOpportunityStageColors()
  const { data, loading: localLoading } = useApiQuery(
    () =>
      api.opportunities.list({
        q: search,
        stages: stageFilter,
        source: 'server',
        page,
        pageSize: PAGE_SIZE,
      }),
    [search, stageFilter, page],
  )
  const loading = localLoading || serverSync.loading
  const paged = data?.items ?? []
  const total = data?.total ?? 0
  // Per currency: "₹75.63 L + $500,000.75" (amounts in different currencies are not added up).
  const byCurrency = data?.totals.byCurrency
  const dealSumText = byCurrency
    ? formatMoneyTotals(byCurrency.map((t) => ({ value: t.dealValue, currency: t.currency })))
    : formatDealValue(data?.totals.dealValue ?? 0)
  const weightedSumText = byCurrency
    ? formatMoneyTotals(byCurrency.map((t) => ({ value: t.weightedValue, currency: t.currency })))
    : formatDealValue(data?.totals.weightedValue ?? 0)
  const stageOptions = oppFill ? bySequence(oppFill.opportunityStages).map((item) => item.opportunityStageName) : []
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
        title={`Opportunitie${total === 1 ? '' : 's'} - ${total}`}
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
      <div className="page-gutter pt-3 empty:hidden">
        <SpectrumRequiredNotice what="Opportunities" />
      </div>
      {serverSync.error ? (
        <div className="page-gutter pt-3">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-accent bg-accent-soft px-3 py-2 text-xs text-accent" role="alert">
            <span>Could not load opportunities from the server: {serverSync.error}</span>
            <button type="button" className="font-bold underline" onClick={() => void serverSync.retry()}>Retry</button>
          </div>
        </div>
      ) : null}

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
                  {columns.visibleColumns.map((column) =>
                    column.key === 'actions' ? (
                      <th key={column.key} className="sticky-col-end">
                        <span className="inline-flex items-center gap-1.5">
                          {column.label}
                          <ColumnVisibilityMenu
                            columns={OPPORTUNITY_COLUMNS}
                            isVisible={columns.isVisible}
                            onToggle={columns.toggle}
                            onShowAll={columns.showAll}
                            hiddenCount={columns.hiddenCount}
                          />
                        </span>
                      </th>
                    ) : (
                      <th key={column.key} className={column.key === 'code' ? 'sticky-col-id' : undefined}>{column.label}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {loading && <SkeletonTableRows cols={gridColSpan} rows={6} />}
                {!loading && total === 0 && !hasFilters && (
                  <tr>
                    <td colSpan={gridColSpan} className="table-empty-td">
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
                    <td colSpan={gridColSpan} className="table-empty-td">
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
                      stageColor={item.spectrum ? stageColor(item.dealStage) : undefined}
                      show={columns.isVisible}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="page-gutter w-full border-t border-line bg-surface py-2.5 text-ink-muted">
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          disabled={loading}
          onPageChange={(next) => {
            setPage(next)
            clearSelection()
          }}
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
    </div>
  )
}

type OpportunityColumnKey =
  | 'code' | 'name' | 'entity' | 'primaryContact' | 'products' | 'value' | 'stage' | 'weight' | 'weighted'
  | 'closing' | 'owner' | 'lastActivityOn' | 'createdBy' | 'createdOn' | 'modifiedBy' | 'modifiedOn' | 'actions'

/** Grid columns in order. ID and Actions cannot be hidden. */
const OPPORTUNITY_COLUMNS: GridColumn<OpportunityColumnKey>[] = [
  { key: 'code', label: 'Opportunity Code', locked: true },
  { key: 'name', label: 'Opportunity Name' },
  { key: 'entity', label: 'Business Entity Name' },
  { key: 'primaryContact', label: 'Primary Contact' },
  { key: 'products', label: 'Products Required' },
  { key: 'value', label: 'Opportunity Value' },
  { key: 'stage', label: 'Opportunity Stage' },
  { key: 'weight', label: 'Weight %' },
  { key: 'weighted', label: 'Weighted Value' },
  { key: 'closing', label: 'Closing Date' },
  { key: 'owner', label: 'Owner' },
  { key: 'lastActivityOn', label: 'Last Activity On' },
  { key: 'createdBy', label: 'Created By' },
  { key: 'createdOn', label: 'Created On' },
  { key: 'modifiedBy', label: 'Modified By' },
  { key: 'modifiedOn', label: 'Modified On' },
  { key: 'actions', label: 'Actions', locked: true },
]

function OpportunityRow({
  item,
  selected,
  onToggleSelect,
  onView,
  onEdit,
  onDelete,
  onAddActivity,
  stageColor,
  show,
}: {
  item: Opportunity
  /** Column visibility (Actions header menu). */
  show: (key: OpportunityColumnKey) => boolean
  /** Server `colorCoding` for this row's stage. */
  stageColor?: string
  selected: boolean
  onToggleSelect: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  onAddActivity: () => void
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
      {show('name') && (
        <td>
          <IconTooltip label={item.name} overflowOnly className="max-w-52">
            <span className="block truncate text-xs font-bold text-ink">
              {item.name}
            </span>
          </IconTooltip>
        </td>
      )}
      {show('entity') && (
        <td>
          <IconTooltip label={item.companyName} overflowOnly className="max-w-44">
            <span className="block truncate text-xs font-semibold text-ink-soft">{item.companyName}</span>
          </IconTooltip>
        </td>
      )}
      {show('primaryContact') && (
        <td className="whitespace-normal" onClick={(e) => e.stopPropagation()}>
          <PersonContactCard
            name={item.contactPerson}
            email={item.email}
            phone={item.phone}
            company={item.companyName}
          />
        </td>
      )}
      {show('products') && (
        <td>
          <IconTooltip label={item.productsRequired} overflowOnly className="max-w-32">
            <span className="block truncate text-xs text-ink-soft">{item.productsRequired}</span>
          </IconTooltip>
        </td>
      )}
      {show('value') && (
        <td>
          <span className="text-xs font-bold text-accent">{formatDealValue(item.dealValue, item.valueCurrency)}</span>
        </td>
      )}
      {show('stage') && (
        <td>
          <span
            className={`badge ${stageColor ? 'border' : dealStageClass(item.dealStage)}`}
            style={stageBadgeStyle(stageColor)}
          >
            {item.dealStage}
          </span>
        </td>
      )}
      {show('weight') && (
        <td>
          <span className="text-xs font-semibold text-ink">{item.weightPercent}%</span>
        </td>
      )}
      {show('weighted') && (
        <td>
          <span className="text-xs font-bold text-primary">{formatDealValue(item.weightedValue, item.valueCurrency)}</span>
        </td>
      )}
      {show('closing') && (
        <td>
          <span className="text-xs text-ink-soft">{formatLeadDate(item.closingDate, '')}</span>
        </td>
      )}
      {show('owner') && (
        <td>
          <span className="text-xs text-ink-soft">{item.owner}</span>
        </td>
      )}
      {/* search-data `lastActivityDate` */}
      {show('lastActivityOn') && (
        <td>
          <span className="whitespace-nowrap text-xs text-ink-soft">
            {item.lastActivityAt ? formatAuditStamp(item.lastActivityAt, '') : ''}
          </span>
        </td>
      )}
      {/* Server opportunities: who / when from search-data. In-app ones only know their dates. */}
      {show('createdBy') && (
        <td>
          <span className="whitespace-nowrap text-xs text-ink-soft">{item.audit?.createdBy || item.createdBy || ''}</span>
        </td>
      )}
      {show('createdOn') && (
        <td>
          <span className="whitespace-nowrap text-xs text-ink-faint">
            {item.audit ? formatAuditStamp(item.audit.createdAt, '') : formatLeadDate(item.createdAt, '')}
          </span>
        </td>
      )}
      {show('modifiedBy') && (
        <td>
          <span className="whitespace-nowrap text-xs text-ink-soft">{item.audit?.modifiedBy || ''}</span>
        </td>
      )}
      {show('modifiedOn') && (
        <td>
          <span className="whitespace-nowrap text-xs text-ink-faint">
            {item.audit ? formatAuditStamp(item.audit.modifiedAt, '') : item.lastActivity}
          </span>
        </td>
      )}
      <td className="sticky-col-end" onClick={(e) => e.stopPropagation()}>
        <RecordRowActions
          viewLabel="View Opportunity"
          editLabel="Edit Opportunity"
          deleteLabel="Delete Opportunity"
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        >
          {/* Opportunity rows: activities only (no notes / email actions). */}
          <RowQuickMenu onAddActivity={onAddActivity} />
        </RecordRowActions>
      </td>
    </tr>
  )
}
