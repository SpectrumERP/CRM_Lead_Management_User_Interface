import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { deleteBusinessEntity } from '../api/businessEntities';
import { getBusinessEntityFillValues } from '../api/businessEntityFillValues';
import { toApiError } from '../api/errors';
import { FORM_NO } from '../api/formRights';
import { useSpectrumCompany } from '../auth/useSpectrumCompany';
import ConfirmDialog from '../components/ConfirmDialog';
import SpectrumRequiredNotice from '../components/SpectrumRequiredNotice';
import type { ToastType } from '../components/Toast';
import { useFormRights } from '../contexts/FormRightsContext';
import { Select, Spinner, nextSort, type SortDir } from '../ui';
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
import { ICON, Icon, OutlineButton, SolidButton } from './businessEntities/ui';

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

const LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
const PAGE_SIZES = [10, 25, 50, 100];

type SortState = { field: string; dir: SortDir };
/** Task Management sorts the list by code by default. */
const DEFAULT_SORT: SortState = { field: 'code', dir: 'asc' };
const SORT_FIELD: Record<ListViewMode, string> = { list: 'code', album: 'code', 'contact-list': 'name', 'contact-album': 'name', attachment: 'code' };

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

function pageItems(page: number, totalPages: number): Array<number | '…'> {
  return Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
    .reduce<Array<number | '…'>>((acc, n, i, arr) => {
      if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…');
      acc.push(n);
      return acc;
    }, []);
}

/** Showing x–y of N · page buttons · rows per page (Task Management's pagination bar). */
function PaginationBar({ total, page, pageSize, onPage, onPageSize }: {
  total: number; page: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  const nav = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted shadow-sm hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex flex-col items-center gap-2 border-t border-line bg-surface-muted px-4 py-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-3">
      <span className="text-[11px] font-medium tabular-nums text-ink-muted lg:justify-self-start">
        Showing <strong className="text-ink">{start}</strong>–<strong className="text-ink">{end}</strong> of <strong className="text-ink">{total}</strong> records
      </span>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Previous page" className={nav} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon d="M15 19l-7-7 7-7" size={12} />
        </button>
        <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5">
          {pageItems(page, totalPages).map((item, i) =>
            item === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-[10px] text-ink-faint">…</span>
            ) : (
              <button key={item} type="button" onClick={() => onPage(item)} aria-current={item === page ? 'page' : undefined}
                className={`h-6 w-9 rounded-md text-[10px] font-semibold tabular-nums transition-all ${item === page ? 'bg-primary text-surface shadow-sm' : 'text-ink-muted hover:bg-surface-hover hover:text-primary'}`}>
                {item}
              </button>
            ),
          )}
        </div>
        <button type="button" aria-label="Next page" className={nav} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <Icon d="M9 5l7 7-7 7" size={12} />
        </button>
      </div>
      <div className="flex items-center gap-2 lg:justify-self-end">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-ink-faint">Rows per page</span>
        <Select size="compact" aria-label="Rows per page" preserveOrder rootClassName="w-20"
          options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))} />
      </div>
    </div>
  );
}

/** Business Entities list, laid out and behaving as the Task Management "Business Entity" master list. */
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
  const [pageSize, setPageSize] = useState(10);
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

  // A new view starts from the top, sorted by its default column.
  useEffect(() => {
    setLetter('');
    setSort({ field: SORT_FIELD[view], dir: 'asc' });
    setPage(1);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => { setPage(1); }, [keyword, letter]);

  const filtered = useMemo(() => searchRows(feed.rows, keyword), [feed.rows, keyword]);
  // A search ranks best matches first; otherwise the chosen column sorts.
  const ordered = useMemo(() => (keyword ? filtered : sortRows(filtered, sort)), [filtered, keyword, sort]);
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = ordered.slice((safePage - 1) * pageSize, safePage * pageSize);

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

  if (!rights.ready) {
    return <div className="flex flex-1 items-center justify-center py-16"><Spinner label="Loading" /></div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <div className="page-gutter flex min-h-0 flex-1 flex-col gap-3 py-3">
        <div className="flex shrink-0 flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          <label className="flex h-10 flex-1 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)]">
            <Icon d={ICON.search} size={16} className="shrink-0 text-ink-faint" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search"
              placeholder="Search business entity records by name, code..."
              className="h-full min-w-0 flex-1 border-none bg-transparent p-0 text-xs font-medium text-ink outline-none placeholder:text-ink-faint" />
          </label>
          <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5" role="tablist" aria-label="View">
            {VIEW_MODES.map((mode) => (
              <button key={mode.id} type="button" role="tab" aria-selected={view === mode.id} onClick={() => setView(mode.id)}
                className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  view === mode.id ? 'bg-primary text-surface' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                }`}>
                <Icon d={mode.icon} size={12} />
                <span>{mode.label}</span>
              </button>
            ))}
          </div>
          {rights.isSave ? (
            <SolidButton className="h-9 px-4" onClick={onCreate}>
              <Icon d={ICON.plus} size={14} strokeWidth={2.5} /> Create Business Entity
            </SolidButton>
          ) : null}
        </div>

        {!company.ready ? (
          <div className="flex justify-center py-16"><Spinner label="Loading" /></div>
        ) : !company.enabled ? (
          <SpectrumRequiredNotice what="Business entities" />
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-[0_8px_30px_-12px_rgba(15,23,42,0.06)]">
            {feed.loading && feed.rows.length === 0 ? (
              <div className="flex min-h-[200px] items-center justify-center p-10"><Spinner label="Loading business entities" /></div>
            ) : feed.error && feed.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <p className="text-sm font-semibold text-ink">Failed to load business entities</p>
                <p className="text-xs text-ink-muted">Could not load this list. Retry runs the same search again.</p>
                <p className="text-xs text-accent">{feed.error}</p>
                <OutlineButton className="mt-2 h-9" onClick={() => setReloadKey((k) => k + 1)}>Retry</OutlineButton>
              </div>
            ) : ordered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon d={ICON.layers} size={20} /></span>
                <p className="text-sm font-semibold text-ink">{searching ? 'No results match your search' : 'No Companies Found'}</p>
                <p className="max-w-md text-xs text-ink-muted">
                  {searching
                    ? 'Try a different search term or clear the search to see all business entities.'
                    : 'No companies match your criteria. Try adjusting filters or click the Add button above to create a new one.'}
                </p>
                {searching ? <OutlineButton className="mt-2 h-9" onClick={() => setSearch('')}>Clear search</OutlineButton> : null}
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface-muted/50 px-4 py-2">
                  <span className="text-[11px] font-semibold text-ink-faint">Total {ordered.length} Records</span>
                  <OutlineButton active className="h-7 px-3" onClick={() => downloadCsv('Business_Entity_Report.csv', exportRows(view, ordered))}>
                    <Icon d={ICON.download} size={12} /> Export CSV
                  </OutlineButton>
                </div>
                <div className="flex min-h-0 flex-1 overflow-hidden">
                  <div ref={scrollRef} onScroll={onScroll}
                    onWheel={(e) => { if (e.currentTarget.scrollTop === 0 && e.deltaY < 0 && feed.hasPrev && !feed.loadingMore) void feed.loadPrev(); }}
                    className="relative min-h-0 min-w-0 flex-1 overflow-auto select-none"
                    aria-busy={feed.loading || Boolean(feed.loadingMore)}>
                    {feed.loadingMore === 'prev' ? <div className="flex justify-center py-2"><Spinner label="Loading earlier" /></div> : null}
                    {view === 'list' ? (
                      <EntityTable rows={pageRows as EntityListRow[]} {...handlers} {...sortProps} />
                    ) : view === 'album' ? (
                      <EntityAlbum rows={pageRows as EntityListRow[]} {...handlers} />
                    ) : view === 'contact-list' ? (
                      <ContactTable rows={pageRows as ContactListRow[]} onEdit={handlers.onEdit} {...sortProps} />
                    ) : view === 'contact-album' ? (
                      <ContactAlbum rows={pageRows as ContactListRow[]} onEdit={handlers.onEdit} />
                    ) : (
                      <AttachmentGroups rows={pageRows as AttachmentListRow[]} onEdit={handlers.onEdit} onPreview={setPreview} />
                    )}
                    {feed.loadingMore === 'next' ? <div className="flex justify-center py-3"><Spinner label="Loading more" /></div> : null}
                    {feed.error ? (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-accent" role="alert">
                        <span>Failed to load more business entities: {feed.error}</span>
                        <button type="button" className="font-bold underline" onClick={() => void feed.loadNext()}>Retry</button>
                      </div>
                    ) : null}
                  </div>

                  {/* A–Z jump: letters with entries are enabled; picking the active letter again clears it. */}
                  <nav aria-label="Jump to letter" className="flex w-7 shrink-0 flex-col items-center gap-px overflow-y-auto border-l border-line py-2">
                    {LETTERS.map((l) => {
                      const enabled = enabledLetters.has(l) || letter === l;
                      return (
                        <button key={l} type="button" disabled={!enabled || feed.loading} aria-pressed={letter === l} onClick={() => pickLetter(l)}
                          className={`h-5 w-5 rounded text-[9px] font-semibold transition-colors ${
                            letter === l ? 'bg-primary text-surface' : enabled ? 'text-primary hover:bg-primary-soft' : 'cursor-default text-ink-faint/50'
                          }`}>
                          {l}
                        </button>
                      );
                    })}
                  </nav>
                </div>
                <PaginationBar total={ordered.length} page={safePage} pageSize={pageSize} onPage={setPage}
                  onPageSize={(size) => { setPageSize(size); setPage(1); }} />
              </>
            )}
          </div>
        )}
      </div>

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

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-label="Image preview"
          onClick={() => setPreview(null)}>
          <img src={preview} alt="Attachment preview" className="max-h-full max-w-full rounded-lg object-contain shadow-overlay" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-surface/90 px-3 py-1 text-xs font-bold text-ink" onClick={() => setPreview(null)}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}
