import { useState, useMemo, useEffect } from 'react';
import { searchAll, SearchResult, SearchResultType, getTotalResults } from '../data/search';
import { shallowEqual, useCrmSelector } from '../contexts/CrmStoreContext';
import { compareAlpha, CountBadge, Select } from '../ui';

type TabType = 'all' | SearchResultType;

const TABS: { id: TabType; label: string; color: string }[] = [
  { id: 'all',      label: 'All Results',       color: '#0c1a3a' },
  { id: 'lead',     label: 'Leads',             color: '#2955a3' },
  { id: 'entity',   label: 'Business Entities', color: '#1a8040' },
  { id: 'contact',  label: 'Contacts',          color: '#7c3aed' },
  { id: 'activity', label: 'Activities',        color: '#b45309' },
  { id: 'meeting',  label: 'Meetings',          color: '#c41e1e' },
  { id: 'document', label: 'Documents',         color: '#4a5d82' },
];

interface Props {
  query: string;
  onViewLead: (id: string) => void;
  onViewContact: (id: string) => void;
  onViewEntity: (id: string) => void;
  onViewActivity: () => void;
  onViewMeeting: () => void;
  onNewSearch: (q: string) => void;
}

const TYPE_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  lead:     { bg: '#eef2fb', color: '#2955a3', border: '#c7d6f0' },
  contact:  { bg: '#f5f3ff', color: '#7c3aed', border: '#e9d5ff' },
  entity:   { bg: '#edfbf1', color: '#1a8040', border: '#bbf0cf' },
  activity: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  meeting:  { bg: '#fff0f0', color: '#c41e1e', border: '#fca5a5' },
  document: { bg: '#f0f4fb', color: '#4a5d82', border: '#dce4f2' },
};

const TYPE_LABEL: Record<string, string> = {
  lead: 'Lead', contact: 'Contact', entity: 'Business Entity',
  activity: 'Activity', meeting: 'Meeting', document: 'Document',
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  lead: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  contact: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  entity: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V7l6-4v18M9 11H3v10M15 21V11h6v10" />
    </svg>
  ),
  activity: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  meeting: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  document: (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

function highlight(text: string, query: string): string {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:#fef9c3;color:#92400e;border-radius:2px;padding:0 1px">$1</mark>',
  );
}

function ResultCard({
  result,
  query,
  onNavigate,
}: {
  result: SearchResult;
  query: string;
  onNavigate: (r: SearchResult) => void;
}) {
  const tc = TYPE_COLOR[result.type];
  return (
    <button
      onClick={() => onNavigate(result)}
      className="w-full flex items-start gap-3 px-4 py-3.5 rounded-xl text-left transition-all group"
      style={{ background: '#fff', border: '1px solid #dce4f2' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = tc.color;
        e.currentTarget.style.boxShadow = `0 2px 12px ${tc.color}18`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#dce4f2';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Type icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
      >
        {TYPE_ICON[result.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className="text-sm font-semibold"
            style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}
            dangerouslySetInnerHTML={{ __html: highlight(result.title, query) }}
          />
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
          >
            {TYPE_LABEL[result.type]}
          </span>
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: '#7a8494' }}>{result.subtitle}</p>
        {result.meta && (
          <p className="text-xs mt-0.5" style={{ color: '#a0aab8', fontSize: 10 }}>{result.meta}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {result.badge && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: result.badgeBg, color: result.badgeColor }}
          >
            {result.badge}
          </span>
        )}
        {result.badge2 && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: result.badge2Bg, color: result.badge2Color }}
          >
            {result.badge2}
          </span>
        )}
      </div>

      <svg
        className="mt-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity self-start"
        width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={tc.color} strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

type SortBy = 'relevance' | 'name' | 'date-desc' | 'date-asc';
type SearchState = 'loading' | 'error' | 'done';

export default function SearchResults({
  query: initialQuery,
  onViewLead,
  onViewContact,
  onViewEntity,
  onViewActivity,
  onViewMeeting,
  onNewSearch,
}: Props) {
  const { leads, contacts, entities, activities, meetings, documents } = useCrmSelector(
    (state) => ({
      leads: state.leads,
      contacts: state.contacts,
      entities: state.entities,
      activities: state.activities,
      meetings: state.meetings,
      documents: state.documents,
    }),
    shallowEqual,
  );
  const [localQuery, setLocalQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchState, setSearchState] = useState<SearchState>('done');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [filterType, setFilterType] = useState<SearchResultType | ''>('');

  useEffect(() => {
    setLocalQuery(initialQuery);
    setSearchState('done');
  }, [initialQuery]);

  const groups = useMemo(
    () => searchAll(initialQuery, { leads, contacts, entities, activities, meetings, documents }, 1000),
    [initialQuery, leads, contacts, entities, activities, meetings, documents],
  );
  const total = getTotalResults(groups);
  const allResults = useMemo(() => groups.flatMap((g) => g.results), [groups]);

  const visibleResults: SearchResult[] = useMemo(() => {
    let results: SearchResult[];
    if (activeTab === 'all') {
      results = filterType ? allResults.filter((r) => r.type === filterType) : allResults;
    } else {
      results = groups.find((g) => g.type === activeTab)?.results ?? [];
    }
    if (sortBy === 'name') results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    if (sortBy === 'date-desc') results = [...results].sort((a, b) => (b.sortDate ?? '').localeCompare(a.sortDate ?? ''));
    if (sortBy === 'date-asc') results = [...results].sort((a, b) => (a.sortDate ?? '').localeCompare(b.sortDate ?? ''));
    return results;
  }, [activeTab, allResults, filterType, groups, sortBy]);

  const tabCounts: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = { all: total };
    for (const g of groups) m[g.type] = g.total;
    return m;
  }, [groups, total]);

  function handleNavigate(result: SearchResult) {
    switch (result.type) {
      case 'lead': onViewLead(result.navigateId); break;
      case 'contact': onViewContact(result.navigateId); break;
      case 'entity': onViewEntity(result.navigateId); break;
      case 'activity': onViewActivity(); break;
      case 'meeting': onViewMeeting(); break;
      case 'document':
        if (result.relatedRecordType === 'lead') onViewLead(result.relatedRecordId ?? result.navigateId);
        else if (result.relatedRecordType === 'entity') onViewEntity(result.relatedRecordId ?? result.navigateId);
        break;
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (localQuery.trim()) onNewSearch(localQuery.trim());
  }

  const hasFilters = filterType !== '' || activeTab !== 'all' || sortBy !== 'relevance';

  const loading = searchState === 'loading';
  const isError = searchState === 'error';

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Search header ── */}
      <div className="page-gutter flex-shrink-0 py-5" style={{ background: '#fff', borderBottom: '1px solid #dce4f2' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>
              Search Results
            </h1>
            {!loading && !isError && (
              <p className="text-sm mt-0.5" style={{ color: '#7a8494' }}>
                {total > 0 ? (
                  <>
                    <span className="font-bold" style={{ color: '#0c1a3a' }}>{total}</span> result{total !== 1 ? 's' : ''} for{' '}
                    <span className="font-bold" style={{ color: '#2955a3' }}>"{initialQuery}"</span>
                  </>
                ) : (
                  <>No results for <span className="font-bold" style={{ color: '#c41e1e' }}>"{initialQuery}"</span></>
                )}
              </p>
            )}
          </div>

          {/* Re-search bar */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 ml-auto">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2"
                width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                style={{ color: '#9aaccc' }}
              >
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={localQuery}
                onChange={(e) => setLocalQuery(e.target.value)}
                className="form-input pl-9 text-sm"
                style={{ width: 280 }}
                placeholder="Refine your search…"
              />
              {localQuery && (
                <button
                  type="button"
                  onClick={() => setLocalQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#a0aab8' }}
                >
                  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: '#2955a3', boxShadow: '0 2px 8px rgba(41,85,163,0.25)' }}
            >
              Search
            </button>
          </form>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 -mb-px overflow-x-auto" style={{ borderBottom: '2px solid #edf1fa' }}>
          {TABS.map((tab) => {
            const count = tabCounts[tab.id];
            if (tab.id !== 'all' && !count) return null;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setFilterType(''); }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap flex-shrink-0"
                style={
                  isActive
                    ? { color: tab.color, borderBottom: `2px solid ${tab.color}`, marginBottom: -2 }
                    : { color: '#7a8494' }
                }
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <CountBadge
                    value={count}
                    size="sm"
                    style={
                      isActive
                        ? { background: TYPE_COLOR[tab.id]?.bg ?? '#f0f4fb', color: tab.color }
                        : { background: '#f0f4fb', color: '#9aaccc' }
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Filter + sort bar ── */}
      <div
        className="page-gutter flex flex-shrink-0 flex-wrap items-center gap-3 py-3"
        style={{ background: '#f8faff', borderBottom: '1px solid #dce4f2' }}
      >
        {activeTab === 'all' && (
          <Select
            size="compact"
            aria-label="Result type"
            className="min-w-36"
            value={filterType}
            onValueChange={(v) => setFilterType(v as SearchResultType | '')}
            options={[
              { value: '', label: 'All Types' },
              ...[
                { value: 'activity', label: 'Activities' },
                { value: 'entity', label: 'Business Entities' },
                { value: 'contact', label: 'Contacts' },
                { value: 'document', label: 'Documents' },
                { value: 'lead', label: 'Leads' },
                { value: 'meeting', label: 'Meetings' },
              ].sort((left, right) => compareAlpha(left.label, right.label)),
            ]}
          />
        )}

        <Select
          size="compact"
          aria-label="Sort results"
          className="min-w-40"
          preserveOrder
          value={sortBy}
          onValueChange={(v) => setSortBy(v as SortBy)}
          options={[
            { value: 'relevance', label: 'Sort: Relevance' },
            { value: 'name', label: 'Sort: Name (A–Z)' },
            { value: 'date-desc', label: 'Sort: Newest First' },
            { value: 'date-asc', label: 'Sort: Oldest First' },
          ]}
        />

        {hasFilters && (
          <button
            onClick={() => { setActiveTab('all'); setFilterType(''); setSortBy('relevance'); }}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold"
            style={{ color: '#c41e1e', background: '#fff5f5', border: '1px solid #fdd' }}
          >
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs" style={{ color: '#9aaccc' }}>
          {!loading && !isError && `${visibleResults.length} result${visibleResults.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* ── Results ── */}
      <div className="page-gutter flex-1 py-6">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent mb-4"
              style={{
                borderColor: '#dce4f2',
                borderTopColor: '#2955a3',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p className="text-sm font-medium" style={{ color: '#0c1a3a' }}>Searching across all records…</p>
            <p className="text-xs mt-1" style={{ color: '#9aaccc' }}>
              Leads · Business Entities · Contacts · Activities · Meetings · Documents
            </p>
            {/* Skeleton rows */}
            <div className="w-full max-w-2xl mt-8 space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl"
                  style={{ background: 'linear-gradient(90deg, #f0f4fb 25%, #e8edf8 50%, #f0f4fb 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error state */}
        {!loading && isError && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-full mb-4 flex items-center justify-center"
              style={{ background: '#fef2f2' }}
            >
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#c41e1e" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h2 className="text-base font-bold mb-2" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>
              Search Unavailable
            </h2>
            <p className="text-sm mb-5" style={{ color: '#7a8494', maxWidth: 360 }}>
              An error occurred while searching. Please try again or contact your administrator if the problem persists.
            </p>
            <button
              onClick={() => { setSearchState('loading'); setTimeout(() => setSearchState('done'), 400); }}
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: '#2955a3', color: '#fff' }}
            >
              Retry Search
            </button>
          </div>
        )}

        {/* No results */}
        {!loading && !isError && total === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-16 h-16 rounded-full mb-4 flex items-center justify-center"
              style={{ background: '#f0f4fb' }}
            >
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#9aaccc" strokeWidth={1.5}>
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <h2 className="text-base font-bold mb-2" style={{ color: '#0c1a3a', fontFamily: 'DM Sans, sans-serif' }}>
              No results found
            </h2>
            <p className="text-sm mb-5" style={{ color: '#7a8494', maxWidth: 360 }}>
              Nothing matched <strong>"{initialQuery}"</strong>. Try a different keyword, check your spelling, or search a broader term.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['TCS', 'Rajesh', 'ERP', 'HDFC', 'Follow-up', 'Infosys'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onNewSearch(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
                  style={{ background: '#eef2fb', color: '#2955a3', border: '1px solid #c7d6f0' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#dce9fb')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#eef2fb')}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty filtered tab */}
        {!loading && !isError && total > 0 && visibleResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="w-12 h-12 rounded-full mb-3 flex items-center justify-center"
              style={{ background: '#f0f4fb' }}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#9aaccc" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <p className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>
              No {filterType ? TYPE_LABEL[filterType] : ''} results
            </p>
            <p className="text-xs mt-1" style={{ color: '#9aaccc' }}>
              Try removing filters or changing the tab
            </p>
            <button
              onClick={() => { setActiveTab('all'); setFilterType(''); }}
              className="mt-3 text-xs font-semibold"
              style={{ color: '#2955a3' }}
            >
              Show all results
            </button>
          </div>
        )}

        {/* Results — grouped (All tab, no type filter) */}
        {!loading && !isError && visibleResults.length > 0 && activeTab === 'all' && !filterType && (
          <div className="space-y-7">
            {groups.map((group) => {
              const tc = TYPE_COLOR[group.type];
              return (
                <div key={group.type}>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}
                    >
                      {TYPE_ICON[group.type]}
                    </div>
                    <span className="text-xs font-bold tracking-wider" style={{ color: tc.color, letterSpacing: '0.07em' }}>
                      {group.label}
                    </span>
                    <CountBadge
                      value={group.total}
                      size="sm"
                      style={{ background: tc.bg, color: tc.color }}
                    />
                    <div className="flex-1 h-px" style={{ background: tc.border }} />
                  </div>
                  <div className="space-y-2">
                    {group.results.map((r) => (
                      <ResultCard key={r.id} result={r} query={initialQuery} onNavigate={handleNavigate} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Results — flat list (tab/filter active) */}
        {!loading && !isError && visibleResults.length > 0 && (activeTab !== 'all' || filterType) && (
          <div className="space-y-2">
            {visibleResults.map((r) => (
              <ResultCard key={r.id} result={r} query={initialQuery} onNavigate={handleNavigate} />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
    </div>
  );
}
