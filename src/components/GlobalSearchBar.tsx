import { useState, useRef, useEffect, useCallback } from 'react';
import { searchAll, SearchGroup, SearchResult, getTotalResults } from '../data/search';
import { shallowEqual, useCrmSelectorWhen } from '../contexts/CrmStoreContext';
import { IconTooltip, SkeletonList } from '../ui';

const TYPE_ICON: Record<string, React.ReactNode> = {
  lead: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  contact: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  entity: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V7l6-4v18M9 11H3v10M15 21V11h6v10" />
    </svg>
  ),
  activity: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  meeting: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  document: (
    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  lead:     { bg: '#eef2fb', color: '#2955a3' },
  contact:  { bg: '#f5f3ff', color: '#7c3aed' },
  entity:   { bg: '#edfbf1', color: '#1a8040' },
  activity: { bg: '#fffbeb', color: '#b45309' },
  meeting:  { bg: '#fff0f0', color: '#c41e1e' },
  document: { bg: '#f0f4fb', color: '#4a5d82' },
};

const RECENT_SEARCHES_DEFAULT = [
  'TCS ERP Suite', 'Rajesh Sharma', 'Infosys API Gateway', 'HDFC Core Banking', 'Sun Pharma QMS',
];

interface Props {
  onViewLead: (id: string) => void;
  onViewContact: (id: string) => void;
  onViewEntity: (id: string) => void;
  onViewActivity: () => void;
  onViewMeeting: () => void;
  onOpenResults: (query: string) => void;
  fullWidth?: boolean;
}

const EMPTY_CATALOG = {
  leads: [],
  contacts: [],
  entities: [],
  activities: [],
  meetings: [],
  documents: [],
};

export default function GlobalSearchBar({ onViewLead, onViewContact, onViewEntity, onViewActivity, onViewMeeting, onOpenResults, fullWidth }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const catalog = useCrmSelectorWhen(
    open,
    (state) => ({
      leads: state.leads,
      contacts: state.contacts,
      entities: state.entities,
      activities: state.activities,
      meetings: state.meetings,
      documents: state.documents,
    }),
    EMPTY_CATALOG,
    shallowEqual,
  );
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(RECENT_SEARCHES_DEFAULT);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);

  const doSearch = useCallback((q: string) => {
    if (q.length < 2) { setGroups([]); setLoading(false); return; }
    setLoading(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setGroups(searchAll(q, catalogRef.current, 5));
      setLoading(false);
    }, 180);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setActiveIdx(-1);
    doSearch(v);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleClear() {
    setQuery('');
    setGroups([]);
    setLoading(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  function handleResultClick(result: SearchResult) {
    addRecent(query);
    setOpen(false);
    setQuery('');
    setGroups([]);
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

  function handleViewAll(q: string) {
    addRecent(q);
    setOpen(false);
    onOpenResults(q);
  }

  function addRecent(q: string) {
    if (!q.trim() || q.length < 2) return;
    setRecentSearches((prev) => [q, ...prev.filter((s) => s !== q)].slice(0, 6));
  }

  function handleRecentClick(term: string) {
    setQuery(term);
    doSearch(term);
    inputRef.current?.focus();
  }

  const total = getTotalResults(groups);
  const showDropdown = open;
  const showRecent = open && query.length < 2;
  const showResults = open && query.length >= 2;

  // All flat results for keyboard nav
  const allResults: SearchResult[] = groups.flatMap((g) => g.results);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, -1)); }
    if (e.key === 'Enter') {
      if (activeIdx >= 0 && allResults[activeIdx]) { handleResultClick(allResults[activeIdx]); }
      else if (query.length >= 2) { handleViewAll(query); }
    }
  }

  return (
    <div ref={containerRef} className={`relative ${fullWidth ? 'w-full' : ''}`} style={fullWidth ? undefined : { width: 320 }}>
      {/* Input */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all"
        style={{
          background: open ? '#fff' : '#f0f4fb',
          border: open ? '1.5px solid #2955a3' : '1px solid #dce4f2',
          boxShadow: open ? '0 0 0 3px rgba(41,85,163,0.1)' : 'none',
        }}
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: open ? '#2955a3' : '#9aaccc', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search leads, contacts, entities…"
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: '#0c1a3a', minWidth: 0 }}
        />
        {query ? (
          <IconTooltip label="Clear search">
            <button type="button" onClick={handleClear} aria-label="Clear search" style={{ color: '#9aaccc', flexShrink: 0 }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </IconTooltip>
        ) : (
          <span
            className="text-xs rounded px-1 py-0.5 font-mono flex-shrink-0"
            style={{ background: '#dce4f2', color: '#4a5d82', fontSize: 9 }}
          >
            ⌘K
          </span>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-full left-0 mt-1.5 rounded-xl overflow-hidden z-[80]"
          style={{
            width: fullWidth ? '100%' : 480,
            maxWidth: 'min(480px, calc(100vw - 2.5rem))',
            maxHeight: 'min(520px, calc(100dvh - 120px))',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #dce4f2',
            boxShadow: '0 12px 40px rgba(12,26,58,0.15)',
          }}
        >
          {/* Recent searches */}
          {showRecent && (
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold tracking-widest" style={{ color: '#9aaccc', letterSpacing: '0.08em', fontSize: 10 }}>
                  Recent Searches
                </p>
                {recentSearches.length > 0 && (
                  <button onClick={() => setRecentSearches([])} className="text-xs" style={{ color: '#9aaccc' }}>Clear</button>
                )}
              </div>
              {recentSearches.length === 0 ? (
                <p className="text-xs py-2" style={{ color: '#c8d4e8' }}>No recent searches</p>
              ) : (
                <div className="space-y-0.5">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleRecentClick(term)}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-left transition-colors"
                      style={{ color: '#4a5d82' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f8ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: '#c8d4e8', flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="truncate">{term}</span>
                    </button>
                  ))}
                </div>
              )}
              <div style={{ borderTop: '1px solid #f0f4fb', marginTop: 8, paddingTop: 8 }}>
                <p className="text-xs" style={{ color: '#c8d4e8' }}>Type at least 2 characters to search</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {showResults && loading && (
            // Result rows: a record's tile, its name and its kind.
            <SkeletonList rows={4} lead="square" label="Searching" className="px-2 py-2" rowClassName="flex items-center gap-3 px-2 py-2" />
          )}

          {/* No results */}
          {showResults && !loading && groups.length === 0 && (
            <div className="flex flex-col items-center py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full mb-3 flex items-center justify-center" style={{ background: '#f0f4fb' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#9aaccc" strokeWidth={1.5}>
                  <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: '#0c1a3a' }}>No results for "{query}"</p>
              <p className="text-xs mt-1" style={{ color: '#9aaccc' }}>Try a different search term or check the spelling</p>
            </div>
          )}

          {/* Results */}
          {showResults && !loading && groups.length > 0 && (
            <>
              {/* Top bar */}
              <div
                className="flex items-center justify-between px-3 py-2 sticky top-0"
                style={{ background: '#f8faff', borderBottom: '1px solid #f0f4fb' }}
              >
                <p className="text-xs font-semibold" style={{ color: '#7a8494' }}>
                  <span className="font-bold" style={{ color: '#0c1a3a' }}>{total}</span> result{total !== 1 ? 's' : ''} for "{query}"
                </p>
                <button
                  onClick={() => handleViewAll(query)}
                  className="text-xs font-semibold"
                  style={{ color: '#2955a3' }}
                >
                  View all results →
                </button>
              </div>

              {groups.map((group) => {
                const tc = TYPE_COLOR[group.type];
                let resultOffset = 0;
                for (const g of groups) {
                  if (g.type === group.type) break;
                  resultOffset += g.results.length;
                }
                return (
                  <div key={group.type}>
                    {/* Group header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2"
                      style={{ background: '#f8faff', borderBottom: '1px solid #f0f4fb', borderTop: '1px solid #f0f4fb' }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ background: tc.bg, color: tc.color }}
                      >
                        {TYPE_ICON[group.type]}
                      </div>
                      <span className="text-xs font-bold tracking-wider" style={{ color: '#4a5d82', letterSpacing: '0.07em', fontSize: 10 }}>
                        {group.label}
                      </span>
                      <span className="text-xs font-bold ml-1" style={{ color: tc.color }}>{group.total}</span>
                    </div>

                    {/* Result rows */}
                    {group.results.map((result, ri) => {
                      const isActive = activeIdx === resultOffset + ri;
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                          style={{ background: isActive ? '#f0f4fb' : '#fff', borderBottom: '1px solid #f8faff' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f8ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isActive ? '#f0f4fb' : '#fff')}
                        >
                          {/* Type dot */}
                          <div
                            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: tc.bg, color: tc.color }}
                          >
                            {TYPE_ICON[group.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs font-semibold truncate"
                              style={{ color: '#0c1a3a' }}
                              dangerouslySetInnerHTML={{ __html: highlight(result.title, query) }}
                            />
                            <p className="text-xs truncate mt-0.5" style={{ color: '#7a8494' }}>
                              {result.subtitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {result.badge && (
                              <span
                                className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: result.badgeBg, color: result.badgeColor, fontSize: 10 }}
                              >
                                {result.badge}
                              </span>
                            )}
                            {result.badge2 && (
                              <span
                                className="text-xs font-semibold px-1.5 py-0.5 rounded-full hidden xl:inline-block"
                                style={{ background: result.badge2Bg, color: result.badge2Color, fontSize: 10 }}
                              >
                                {result.badge2}
                              </span>
                            )}
                          </div>
                          <p className="text-xs flex-shrink-0 hidden xl:block" style={{ color: '#c8d4e8', fontSize: 10 }}>
                            {result.meta}
                          </p>
                        </button>
                      );
                    })}

                    {/* View all for this group */}
                    {group.total > 5 && (
                      <button
                        onClick={() => handleViewAll(query)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold transition-colors"
                        style={{ color: tc.color, background: tc.bg + '60' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = tc.bg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = tc.bg + '60')}
                      >
                        View all {group.total} {group.label.toLowerCase()} →
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Footer */}
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ background: '#f8faff', borderTop: '1px solid #f0f4fb' }}
              >
                <div className="flex items-center gap-3 text-xs" style={{ color: '#c8d4e8' }}>
                  <span>↑↓ navigate</span>
                  <span>⏎ open</span>
                  <span>Esc close</span>
                </div>
                <button onClick={() => handleViewAll(query)} className="text-xs font-bold" style={{ color: '#2955a3' }}>
                  Full results page →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function highlight(text: string, query: string): string {
  if (!query || query.length < 2) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:#fef9c3;color:#92400e;border-radius:2px;padding:0 1px">$1</mark>',
  );
}
