import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GRID_SEARCH_INPUT } from '../components/InlineFilterRow';
import { deleteBusinessEntity } from '../api/businessEntities';
import { getBusinessEntityFillValues } from '../api/businessEntityFillValues';
import { toApiError } from '../api/errors';
import { FORM_NO } from '../api/formRights';
import { useSpectrumCompany } from '../auth/useSpectrumCompany';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmptyIcons, EmptyState, NoResults } from '../components/CRMStates';
import Pagination from '../components/Pagination';
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice';
import type { ToastType } from '../components/Toast';
import { PAGE_COPY } from '../constants/messages';
import { useFormRights } from '../contexts/FormRightsContext';
import { Button, IconTooltip, ImagePreview, PageHeader, PageLoader, Spinner, nextSort, type SortDir } from '../ui';
import { downloadCsv } from '../utils/csv';
import { AttachmentGroups, ContactAlbum, ContactTable, EntityAlbum, EntityTable } from './businessEntities/ListViews';
import {
  exportRows,
  searchRows,
  sourceOf,
  type AttachmentListRow,
  type ContactListRow,
  type EntityListRow,
  type ListViewMode,
} from './businessEntities/listRows';
import { useBusinessEntityFeed } from './businessEntities/useBusinessEntityFeed';
import { ICON, Icon, OutlineButton } from './businessEntities/ui';

interface Props {
  onCreate: () => void;
  onEdit: (businessEntityNo: number) => void;
  onToast?: (type: ToastType, title: string, message?: string) => void;
}

const VIEW_MODES: { id: ListViewMode; label: string; icon: string }[] = [
  { id: 'list', label: 'Grid List', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { id: 'album', label: 'Album View', icon: ICON.building },
  { id: 'contact-list', label: 'Contact List', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'contact-album', label: 'Contact Album', icon: ICON.user },
  { id: 'attachment', label: 'Attachments', icon: ICON.paperclip },
];

const PAGE_SIZE = 10;
const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];

type SortState = { field: string; dir: SortDir };
/** No column is sorted until one is clicked; rows keep the server's order. */
const DEFAULT_SORT: SortState = { field: '', dir: 'asc' };

function sortRows<T>(rows: T[], sort: SortState): T[] {
  if (!sort.field) return rows;
  const key = sort.field as keyof T;
  const factor = sort.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (typeof x === 'number' || typeof y === 'number') return ((Number(x) || 0) - (Number(y) || 0)) * factor;
    return String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * factor;
  });
}

/** Business Entities list chrome matches the Leads grid (no row checkboxes). */
export default function BusinessEntitiesList({ onCreate, onEdit, onToast }: Props) {
  const rights = useFormRights(FORM_NO.businessEntity);
  const company = useSpectrumCompany();
  const [view, setView] = useState<ListViewMode>('list');
  const [search, setSearch] = useState('');
  const keyword = useDeferredValue(search.trim());
  const [serverKeyword, setServerKeyword] = useState('');
  const [letter, setLetter] = useState('');
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [pageLoading, setPageLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [typeNames, setTypeNames] = useState<ReadonlyMap<number, string>>(new Map());
  const [confirmDelete, setConfirmDelete] = useState<EntityListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prependFrom = useRef<{ height: number; top: number } | null>(null);
  const source = sourceOf(view);

  // The loaded rows are filtered as you type; the server is also asked once typing pauses.
  useEffect(() => {
    const timer = window.setTimeout(() => setServerKeyword(keyword), 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  // Type names for rows that only carry the type number.
  useEffect(() => {
    if (!company.headOfficeNo) return;
    let cancelled = false;
    getBusinessEntityFillValues(company.headOfficeNo)
      .then((fill) => { if (!cancelled) setTypeNames(new Map(fill.businessEntityTypes.map((t) => [t.typeNo, t.typeName]))); })
      .catch(() => { /* names stay as the search sent them */ });
    return () => { cancelled = true; };
  }, [company.headOfficeNo]);

  const feed = useBusinessEntityFeed(source, {
    keyword: serverKeyword,
    startsWith: letter,
    enabled: company.enabled && rights.isOpen,
    typeNames,
    reloadKey: `${reloadKey}:${company.companyNo ?? ''}`,
  });

  // A new view starts from the top, unsorted.
  useEffect(() => {
    setLetter('');
    setSort(DEFAULT_SORT);
    setPage(1);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => { setPage(1); }, [keyword, letter, sort.field, sort.dir]);

  useEffect(() => {
    if (!pageLoading) return;
    const timer = window.setTimeout(() => setPageLoading(false), 380);
    return () => window.clearTimeout(timer);
  }, [pageLoading, page]);

  const filtered = useMemo(() => searchRows(feed.rows, keyword), [feed.rows, keyword]);
  // A search ranks best matches first; otherwise the chosen column sorts.
  const ordered = useMemo(() => (keyword ? filtered : sortRows(filtered, sort)), [filtered, keyword, sort]);
  const totalPages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const isTableView = view === 'list' || view === 'contact-list';
  // The album views show every loaded row (more load on scroll) with the A–Z rail instead of pages.
  const pageRows = isTableView ? ordered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE) : ordered;
  const listBusy = feed.loading || pageLoading;

  // Keep the reader's place when earlier rows are added above.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const from = prependFrom.current;
    if (!el || !from || feed.loadingMore) return;
    prependFrom.current = null;
    el.scrollTop = from.top + (el.scrollHeight - from.height);
  }, [feed.rows, feed.loadingMore]);

  // While the list does not fill its box, the next server page loads (as in Task Management).
  const { loading: feedLoading, loadingMore, hasNext, error: feedError, loadNext } = feed;
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el || feedLoading || loadingMore || !hasNext || feedError) return;
      if (el.scrollHeight <= el.clientHeight + 4) void loadNext();
    }, 200);
    return () => window.clearTimeout(timer);
    // `loadNext` is recreated each render; the state it reads is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedLoading, loadingMore, hasNext, feedError, feed.rows.length, pageRows.length]);

  const lastTop = useRef(0);
  function onScroll() {
    const el = scrollRef.current;
    if (!el || feed.loading || feed.loadingMore) return;
    const down = el.scrollTop > lastTop.current;
    const up = el.scrollTop < lastTop.current;
    lastTop.current = el.scrollTop;
    if (down && el.scrollHeight - el.scrollTop - el.clientHeight < 80 && feed.hasNext) void feed.loadNext();
    else if (up && el.scrollTop < 20 && feed.hasPrev) {
      prependFrom.current = { height: el.scrollHeight, top: el.scrollTop };
      void feed.loadPrev();
    }
  }

  function pickLetter(next: string) {
    setLetter((current) => (current === next ? '' : next));
    scrollRef.current?.scrollTo({ top: 0 });
  }

  function handlePageChange(next: number) {
    if (next === safePage || pageLoading) return;
    setPageLoading(true);
    setPage(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  async function remove(row: EntityListRow) {
    setDeleting(true);
    try {
      await deleteBusinessEntity(row.businessEntityNo);
      onToast?.('success', 'Business entity deleted');
      setConfirmDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      onToast?.('error', 'Failed to delete business entity', toApiError(err).message);
      setConfirmDelete(null);
      setReloadKey((k) => k + 1);
    } finally {
      setDeleting(false);
    }
  }

  const handlers = {
    onEdit: rights.isUpdate ? onEdit : undefined,
    onDelete: rights.isDelete ? setConfirmDelete : undefined,
  };
  const sortProps = { sort, onSort: (field: string) => setSort((prev) => nextSort(prev, field, DEFAULT_SORT)) };
  const enabledLetters = new Set(feed.alphabets.map((l) => l.toUpperCase()));
  const searching = Boolean(search.trim());
  const titleCount = ordered.length;
  const emptyNode = searching ? (
    <NoResults onClear={() => setSearch('')} />
  ) : (
    <EmptyState
      icon={EmptyIcons.entities}
      title="No business entities found"
      subtitle="Create your first business entity to get started."
      action={rights.isSave ? { label: 'Create Business Entity', onClick: onCreate } : undefined}
    />
  );

  if (!rights.ready) {
    return <div className="flex flex-1 items-center justify-center py-16"><Spinner label="Loading" /></div>;
  }

  const body = !company.ready ? (
    <div className="flex flex-1 items-center justify-center py-16"><Spinner label="Loading" /></div>
  ) : !company.enabled ? null : feed.error && feed.rows.length === 0 ? (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="text-sm font-semibold text-ink">Failed to load business entities</p>
      <p className="text-xs text-ink-muted">Could not load this list. Retry runs the same search again.</p>
      <p className="text-xs text-accent">{feed.error}</p>
      <OutlineButton className="mt-2 h-9" onClick={() => setReloadKey((k) => k + 1)}>Retry</OutlineButton>
    </div>
  ) : (
    <>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className={`page-gutter flex h-full min-w-0 ${isTableView ? '' : 'py-3'}`}>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            onWheel={(e) => { if (e.currentTarget.scrollTop === 0 && e.deltaY < 0 && feed.hasPrev && !feed.loadingMore) void feed.loadPrev(); }}
            className={`relative min-h-0 min-w-0 flex-1 ${isTableView ? 'table-scroll' : 'overflow-auto'}`}
            aria-busy={listBusy || Boolean(feed.loadingMore)}
          >
            {pageLoading ? <PageLoader label={PAGE_COPY.pageLoading} /> : null}
            {feed.loadingMore === 'prev' ? <div className="flex justify-center py-2"><Spinner label="Loading earlier" /></div> : null}
            {feed.loading && feed.rows.length === 0 && !isTableView ? (
              <div className="flex min-h-[200px] items-center justify-center"><Spinner label="Loading business entities" /></div>
            ) : view === 'list' ? (
              <EntityTable
                rows={pageRows as EntityListRow[]}
                loading={feed.loading && feed.rows.length === 0}
                empty={emptyNode}
                {...handlers}
                {...sortProps}
              />
            ) : view === 'album' ? (
              ordered.length === 0 && !feed.loading ? emptyNode : <EntityAlbum rows={pageRows as EntityListRow[]} {...handlers} />
            ) : view === 'contact-list' ? (
              <ContactTable
                rows={pageRows as ContactListRow[]}
                loading={feed.loading && feed.rows.length === 0}
                empty={emptyNode}
                onEdit={handlers.onEdit}
                {...sortProps}
              />
            ) : view === 'contact-album' ? (
              ordered.length === 0 && !feed.loading ? emptyNode : <ContactAlbum rows={pageRows as ContactListRow[]} onEdit={handlers.onEdit} />
            ) : (
              ordered.length === 0 && !feed.loading
                ? emptyNode
                : <AttachmentGroups rows={pageRows as AttachmentListRow[]} onEdit={handlers.onEdit} onPreview={setPreview} />
            )}
            {feed.loadingMore === 'next' ? <div className="flex justify-center py-3"><Spinner label="Loading more" /></div> : null}
            {feed.error ? (
              <div className="flex items-center justify-center gap-2 py-3 text-xs text-accent" role="alert">
                <span>Failed to load more business entities: {feed.error}</span>
                <button type="button" className="font-bold underline" onClick={() => void feed.loadNext()}>Retry</button>
              </div>
            ) : null}
          </div>
          {isTableView ? null : (
            /* A–Z jump: letters with entries are enabled; picking the active letter again clears it. */
            <nav aria-label="Jump to letter" className="ml-2 flex w-7 shrink-0 flex-col items-center gap-px overflow-y-auto rounded-lg border border-line bg-surface py-2">
              {LETTERS.map((l) => {
                const enabled = enabledLetters.has(l) || letter === l;
                return (
                  <button key={l} type="button" disabled={!enabled || feed.loading} aria-pressed={letter === l} onClick={() => pickLetter(l)}
                    title={enabled ? `Jump to ${l}` : undefined}
                    className={`h-5 w-5 shrink-0 rounded text-[9px] font-semibold transition-colors ${
                      letter === l ? 'bg-primary text-surface' : enabled ? 'text-primary hover:bg-primary-soft' : 'cursor-default text-ink-faint/50'
                    }`}>
                    {l}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>
      {isTableView ? (
        <div className="page-gutter w-full border-t border-line bg-surface py-2.5 text-ink-muted">
          <Pagination
            page={safePage}
            pageSize={PAGE_SIZE}
            total={ordered.length}
            onPageChange={handlePageChange}
            disabled={pageLoading}
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        bordered
        title={`Business Entit${titleCount === 1 ? 'y' : 'ies'} - ${titleCount}`}
        actions={
          rights.isSave ? (
            <Button variant="solid" onClick={onCreate}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Business Entity
            </Button>
          ) : null
        }
      >
        <div className="flex w-full flex-wrap items-center gap-2.5 pb-3">
          <div className="relative min-w-48 max-w-72 flex-1">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
              width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Search business entities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={GRID_SEARCH_INPUT}
              aria-label="Search business entities"
            />
          </div>
          {searching ? (
            <Button variant="secondary" className="!min-h-8 !px-3 !py-1.5 text-xs text-accent" onClick={() => setSearch('')}>
              {PAGE_COPY.clearFilters}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            className="!min-h-8 !px-3 !py-1.5 text-xs"
            disabled={ordered.length === 0}
            onClick={() => downloadCsv('Business_Entity_Report.csv', exportRows(view, ordered))}
          >
            Export CSV
          </Button>
          <div className="ml-auto flex items-center overflow-hidden rounded-lg border border-line" role="tablist" aria-label="View">
            {VIEW_MODES.map((mode) => (
              <IconTooltip key={mode.id} label={mode.label}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === mode.id}
                  aria-label={mode.label}
                  onClick={() => setView(mode.id)}
                  className={`px-2.5 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary ${
                    view === mode.id ? 'bg-primary text-surface' : 'bg-surface text-ink-soft hover:bg-surface-hover'
                  }`}
                >
                  <Icon d={mode.icon} size={14} />
                </button>
              </IconTooltip>
            ))}
          </div>
        </div>
      </PageHeader>
      <div className="page-gutter pt-3 empty:hidden">
        <SpectrumRequiredNotice what="Business entities" />
      </div>
      {body}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete business entity"
          message={`Are you sure you want to delete "${confirmDelete.name || confirmDelete.code}"? This action cannot be undone.`}
          confirmLabel={deleting ? 'Deleting…' : 'Delete'}
          danger
          onConfirm={() => { if (!deleting) void remove(confirmDelete); }}
          onCancel={() => setConfirmDelete(null)}
        />
      ) : null}

      {preview ? <ImagePreview src={preview} alt="Attachment preview" onClose={() => setPreview(null)} /> : null}
    </div>
  );
}
