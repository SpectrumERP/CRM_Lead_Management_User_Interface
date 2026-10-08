import { ReactNode, useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import GlobalSearchBar from './GlobalSearchBar';
import QuickCreateMenu from './QuickCreateMenu';
// import { useNotifications } from '../contexts/NotificationsContext';
import { matchAppPage, navPaths, paths, taskAppUrl, type AppPage } from '../app/paths';
import { prefetchPage, prerenderApp } from '../app/prefetch';
import ModuleLauncher from './ModuleLauncher';
import { BreadcrumbActionsSlot } from './BreadcrumbActions';
import { toggleTheme, useTheme } from '../app/theme';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../auth/users';
import { getErrorTitle, PAGE_COPY } from '../constants/messages';
import { IconTooltip, CountBadge } from '../ui';
import { useFormRights } from '@/contexts/FormRightsContext';
import { FORM_NO } from '@/api/formRights';

/** Header global search is temporarily hidden. Flip to `true` to restore. */
const SHOW_HEADER_SEARCH = false;

/** Copilot / Edge style: rounded frame with left panel strip. */
function SidebarToggleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path strokeLinecap="round" d="M9 3.5v17" />
    </svg>
  );
}

/** Full screen (lucide maximize-2 / minimize-2), as in Task Management. */
function FullscreenIcon({ exit, size = 14 }: { exit?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {exit ? (
        <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
      ) : (
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      )}
    </svg>
  );
}

/** Focus-mode menu toggle (lucide panel-left / panel-left-close), as in Task Management. */
function PanelLeftIcon({ close, size = 15 }: { close?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      {close ? <path d="m16 15-3-3 3-3" /> : null}
    </svg>
  );
}

type Page = AppPage;

interface LayoutProps {
  children: ReactNode;
  detailName?: string;
}

const navItems = [
  // Contacts is kept here, commented out. Business Entities shows only with the Open right (form 1550).
  {
    id: 'dashboard' as Page,
    label: 'Dashboard',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'business-entities' as Page,
    label: 'Business Entities',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M9 21V7l6-4v18M9 11H3v10M15 21V11h6v10" />
      </svg>
    ),
  },
  // {
  //   id: 'contacts' as Page,
  //   label: 'Contacts',
  //   icon: (
  //     <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
  //       <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  //     </svg>
  //   ),
  // },
  {
    id: 'leads' as Page,
    label: 'Leads',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: 'opportunities' as Page,
    label: 'Opportunities',
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 15l4-4 3 3 5-7" />
      </svg>
    ),
  },
];

const settingsNavItem = {
  id: 'settings' as Page,
  label: 'Settings',
  icon: (
    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function SidebarHeader({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed?: boolean
  onToggleCollapsed?: () => void
}) {
  if (collapsed && onToggleCollapsed) {
    return (
      <header className="flex h-[calc(3.5rem+1px)] flex-shrink-0 items-center justify-center border-b border-white/10 px-2">
        <IconTooltip label="Expand menu" side="right">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="sidebar-item sidebar-item-collapsed"
            aria-label="Expand menu"
            aria-expanded={false}
          >
            <span
              className="relative grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/10 text-white transition-colors hover:bg-primary hover:text-white"
              aria-hidden
            >
              <SidebarToggleIcon size={15} />
            </span>
          </button>
        </IconTooltip>
      </header>
    )
  }

  return (
    <header className="flex h-[calc(3.5rem+1px)] flex-shrink-0 items-center border-b border-white/10 px-3">
      <img
        src="/spectrum-erp-logo-on-dark.png"
        alt="Spectrum ERP"
        className="block h-9 w-full object-contain object-left"
      />
    </header>
  )
}

function SidebarNavButton({
  active,
  label,
  icon,
  badge,
  collapsed,
  onClick,
  onPrefetch,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  badge?: ReactNode;
  collapsed?: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onPrefetch}
      className={`sidebar-item ${active ? 'active' : ''} ${collapsed ? 'sidebar-item-collapsed' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
    >
      <span
        className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-md ${active ? 'bg-[#C4161C] text-white' : 'bg-white/15'}`}
        aria-hidden
      >
        {icon}
        {collapsed && badge ? (
          <span className="absolute -right-1 -top-1">{badge}</span>
        ) : null}
      </span>
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {badge}
        </>
      ) : null}
    </button>
  );

  if (collapsed) {
    return (
      <IconTooltip label={label} className="w-full" side="right">
        {button}
      </IconTooltip>
    );
  }
  return button;
}

function AppSidebar({
  activePage,
  currentPage,
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  activePage: Page;
  currentPage: Page;
  onNavigate: (to: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const entityRights = useFormRights(FORM_NO.businessEntity);
  const visibleNavItems = navItems.filter((item) => item.id !== 'business-entities' || entityRights.isOpen);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarHeader collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />

      <nav className={`min-h-0 flex-1 overflow-y-auto py-2 ${collapsed ? 'px-1.5' : 'px-2.5'}`} aria-label="Main">
        {!collapsed ? (
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold tracking-[0.14em] text-white/40">
            Workspace
          </p>
        ) : null}
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => (
            <SidebarNavButton
              key={item.id}
              active={activePage === item.id}
              label={item.label}
              icon={item.icon}
              collapsed={collapsed}
              onClick={() => onNavigate(navPaths[item.id as keyof typeof navPaths])}
              onPrefetch={() => prefetchPage(item.id)}
            />
          ))}
        </div>

        {admin && (
          <div className={collapsed ? 'mt-3' : 'mt-4 border-t border-white/10 pt-3'}>
            {!collapsed ? (
              <p className="px-2 pb-1.5 text-[10px] font-bold tracking-[0.14em] text-white/40">
                Admin
              </p>
            ) : (
              <div className="mx-auto mb-1.5 h-px w-6 bg-white/15" aria-hidden />
            )}
            <div className="space-y-0.5">
              <SidebarNavButton
                active={currentPage === 'settings'}
                label={settingsNavItem.label}
                icon={settingsNavItem.icon}
                collapsed={collapsed}
                onClick={() => onNavigate(navPaths.settings)}
                onPrefetch={() => prefetchPage('settings')}
              />
              {/* Audit Log hidden for now.
              <SidebarNavButton
                active={currentPage === 'audit-log'}
                label="Audit Log"
                collapsed={collapsed}
                icon={(
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                onClick={() => onNavigate(navPaths['audit-log'])}
                onPrefetch={() => prefetchPage('audit-log')}
              />
              */}
            </div>
          </div>
        )}
      </nav>

      <div className={`flex-shrink-0 border-t border-white/10 ${collapsed ? 'p-1.5' : 'p-2.5'}`}>
        {/* Collapsed: name / role in a right-side tip, as in Task Management */}
        <IconTooltip
          label={collapsed ? [user?.name ?? 'User', user?.role].filter(Boolean).join(' · ') : ''}
          className="w-full"
          side="right"
        >
          <button
            type="button"
            onClick={() => onNavigate(paths.profile)}
            onPointerEnter={() => prefetchPage('my-profile')}
            className={`flex w-full items-center rounded-lg text-left transition-colors hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-2 py-2'
            }`}
            aria-label={`Open profile, ${user?.name ?? 'User'}`}
          >
            <div className="bg-brand flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
              {user?.initials ?? '—'}
            </div>
            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{user?.name ?? 'User'}</p>
                  <p className="truncate text-[11px] text-white/50">{user?.role ?? ''}</p>
                </div>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="shrink-0 text-white/40" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </>
            ) : null}
          </button>
        </IconTooltip>
      </div>
    </div>
  );
}

function CrumbSep({ className = '' }: { className?: string }) {
  return (
    <svg className={`mx-0.5 flex-shrink-0 text-ink-faint ${className}`.trim()} width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CrumbLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={`shrink-0 whitespace-nowrap rounded-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`.trim()}
    >
      {children}
    </Link>
  );
}

function CrumbHere({ children, className = '' }: { children: ReactNode; className?: string }) {
  const text = typeof children === 'string' ? children : ''
  const content = (
    <span className={`min-w-0 font-semibold leading-snug text-ink [overflow-wrap:anywhere] ${className}`.trim()}>
      {children}
    </span>
  )
  if (text.length > 56) {
    return (
      <IconTooltip label={text} className="min-w-0 max-w-full">
        {content}
      </IconTooltip>
    )
  }
  return content
}


export default function Layout({ children, detailName }: LayoutProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const admin = isAdmin(user?.role);
  const currentPage = matchAppPage(pathname);
  const bePages = ['create-business-entity', 'edit-business-entity', 'business-entity-detail'];
  const contactPages = ['create-contact', 'edit-contact', 'contact-detail'];
  // Notifications are hidden for now (no bell, no profile-menu item).
  // const { unreadCount } = useNotifications();
  const searchCallbacks = useMemo(() => ({
    onViewLead: (id: string) => navigate(paths.lead(id)),
    onViewContact: (id: string) => navigate(paths.contact(id)),
    onViewEntity: (id: string) => navigate(paths.entity(id)),
    onViewActivity: () => navigate(paths.activities),
    onViewMeeting: () => navigate(paths.meetings),
    onOpenResults: (query: string) => navigate(paths.search(query)),
  }), [navigate]);
  const [avatarOpen, setAvatarOpen] = useState(false);
  // Keeps the account menu mounted while its close animation runs (as Task Management's dropdown).
  const [avatarMenuMounted, setAvatarMenuMounted] = useState(false);
  useEffect(() => {
    if (avatarOpen) setAvatarMenuMounted(true);
  }, [avatarOpen]);
  const avatarRef = useRef<HTMLDivElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('fi-crm-sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fi-crm-sidebar-collapsed', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Full screen / focus mode (as in Task Management): browser full screen, desktop sidebar hidden —
  // a header button opens it fully (focusSidebarOpen). Leaving browser full screen (Esc) leaves focus mode too.
  const [focusMode, setFocusMode] = useState(false);
  const [focusSidebarOpen, setFocusSidebarOpen] = useState(false);
  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFocusMode(false);
        setFocusSidebarOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  async function toggleFocusMode() {
    if (focusMode) {
      setFocusMode(false);
      setFocusSidebarOpen(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
      return;
    }
    setFocusMode(true);
    setFocusSidebarOpen(false);
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    } catch {
      // Focus mode stays on when the browser blocks the Fullscreen API.
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setMobileSearchOpen(false);
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('nav-lock', navOpen);
    return () => document.body.classList.remove('nav-lock');
  }, [navOpen]);

  useEffect(() => {
    setNavOpen(false);
    setMobileSearchOpen(false);
  }, [pathname]);

  function go(to: string) {
    setNavOpen(false);
    navigate(to);
  }

  const activePage = (
    currentPage === 'create-lead' || currentPage === 'edit-lead' || currentPage === 'lead-detail' ? 'leads'
    : currentPage === 'opportunity-detail' || currentPage === 'edit-opportunity' || currentPage === 'create-opportunity' ? 'opportunities'
    : bePages.includes(currentPage) ? 'business-entities'
    : contactPages.includes(currentPage) ? 'contacts'
    : currentPage === 'search-results' ? ''
    : currentPage === 'audit-log' ? 'settings'
    : currentPage
  ) as Page;


  const pageLabel: Record<Page, string> = {
    dashboard: 'Dashboard',
    'business-entities': 'Business Entities',
    contacts: 'Contacts',
    leads: 'Leads',
    opportunities: 'Opportunities',
    'create-lead': 'Leads',
    'edit-lead': 'Leads',
    'lead-detail': 'Leads',
    'opportunity-detail': 'Opportunities',
    'edit-opportunity': 'Opportunities',
    'create-opportunity': 'Opportunities',
    activities: 'Activities',
    meetings: 'Meetings',
    'create-business-entity': 'Business Entities',
    'edit-business-entity': 'Business Entities',
    'business-entity-detail': 'Business Entities',
    'create-contact': 'Contacts',
    'edit-contact': 'Contacts',
    'contact-detail': 'Contacts',
    'search-results': 'Search Results',
    'settings': 'Settings',
    'notifications': 'Notifications',
    'audit-log': 'Audit Log',
    'my-profile': 'My Profile',
    login: 'Sign in',
    forbidden: getErrorTitle('FORBIDDEN'),
  };

  const nestedLeaf: Partial<Record<Page, string>> = {
    'create-lead': 'Create Lead',
    'edit-lead': 'Edit Lead',
    'lead-detail': detailName ?? 'Lead Detail',
    'opportunity-detail': detailName ?? 'Opportunity Detail',
    'edit-opportunity': 'Edit Opportunity',
    'create-opportunity': 'Create Opportunity',
    'create-business-entity': 'Create Business Entity',
    'edit-business-entity': 'Edit Entity',
    'business-entity-detail': detailName ?? 'Entity Detail',
    'create-contact': 'Add Contact',
    'edit-contact': 'Edit Contact',
    'contact-detail': detailName ?? 'Contact Detail',
    'audit-log': 'Audit Log',
  };
  const leaf = nestedLeaf[currentPage];
  const sectionPage = (activePage || currentPage) as Page;
  // Form pages portal their Cancel / Save into this slot (right end of the breadcrumb line).
  const [crumbActions, setCrumbActions] = useState<HTMLElement | null>(null);
  const crumbs: { label: string; to?: string }[] = leaf
    ? [
        { label: 'CRM', to: paths.dashboard },
        { label: pageLabel[sectionPage], to: navPaths[sectionPage as keyof typeof navPaths] ?? paths.dashboard },
        { label: leaf },
      ]
    : [];

  return (
    <BreadcrumbActionsSlot.Provider value={crumbs.length > 0 ? crumbActions : null}>
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ── Desktop sidebar ── */}
      <aside
        className={`hidden h-full flex-shrink-0 flex-col overflow-hidden bg-[#1E56A0] dark:bg-[#121A2B] dark:border-[#2A3548] transition-[width] duration-300 ease-out lg:flex ${
          focusMode
            ? focusSidebarOpen
              ? 'w-56 border-r border-white/10'
              : 'w-0 border-r-0'
            : `border-r border-white/10 ${sidebarCollapsed ? 'w-14' : 'w-56'}`
        }`}
        aria-hidden={focusMode && !focusSidebarOpen ? true : undefined}
        inert={focusMode && !focusSidebarOpen ? true : undefined}
      >
        {/* Focus mode (as in Task Management): fully open or hidden, sliding in / out — no icon rail.
            Fixed width inside, so the items do not squeeze while the panel animates. */}
        <div className={`flex h-full min-h-0 flex-col ${focusMode ? 'w-56 shrink-0' : 'w-full'}`}>
          <AppSidebar
            activePage={activePage}
            currentPage={currentPage}
            onNavigate={go}
            collapsed={sidebarCollapsed && !focusMode}
            onToggleCollapsed={focusMode ? undefined : toggleSidebarCollapsed}
          />
        </div>
      </aside>

      {/* ── Tablet/Mobile off-canvas drawer ── */}
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-[65] border-0 bg-ink/45 p-0 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        id="mobile-sidebar"
        className={`fixed inset-y-0 left-0 z-[70] flex w-56 flex-col overflow-hidden bg-[#1E56A0] dark:bg-[#121A2B] dark:border-[#2A3548] transition-transform duration-200 ease-out lg:hidden ${navOpen ? 'translate-x-0 shadow-overlay' : '-translate-x-full'}`}
        aria-hidden={!navOpen}
      >
        <AppSidebar
          activePage={activePage}
          currentPage={currentPage}
          onNavigate={go}
        />
      </aside>

      {/* ── Main ── */}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${navOpen ? 'pointer-events-none lg:pointer-events-auto' : ''}`}>
        {/* Top header */}
        <header className="z-40 flex-shrink-0 border-b border-line bg-surface">
          <div className="page-gutter flex min-h-14 items-center justify-between gap-2 py-0">
          {/* Menu — desktop: toggle / logo 1rem from the sidebar (gutter is 1.25rem), same as Task Management */}
          <div className="flex min-w-0 flex-1 items-center lg:-ml-1">
            {/* lg:hidden on the wrapper too — an empty wrapper would still add the row gap before the toggle */}
            <IconTooltip label="Open navigation" className="lg:hidden">
            <button
              type="button"
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-line-strong bg-primary-soft text-primary lg:hidden"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              aria-controls="mobile-sidebar"
              onClick={() => setNavOpen(true)}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            </IconTooltip>
            {sidebarCollapsed || focusMode ? (
              // Focus mode with the sidebar open: the logo is in the sidebar, not twice.
              focusMode && focusSidebarOpen ? null : (
              <Link
                to={paths.dashboard}
                className="hidden min-w-0 items-center lg:inline-flex"
                aria-label="Spectrum ERP home"
              >
                <img
                  src="/spectrum-erp-logo.png"
                  alt="Spectrum ERP"
                  className="block h-8 w-auto max-w-[10.5rem] object-contain object-left"
                />
              </Link>
              )
            ) : (
              <IconTooltip label="Collapse menu">
                <button
                  type="button"
                  onClick={toggleSidebarCollapsed}
                  className="hidden h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary text-white shadow-sm transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-primary-hover hover:bg-primary-hover active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:inline-flex"
                  aria-label="Collapse menu"
                  aria-expanded
                >
                  <SidebarToggleIcon size={15} />
                </button>
              </IconTooltip>
            )}
            {/* Spectrum ERP │ client (SteelMont) logo — vertical line, then the client logo; desktop/tablet only */}
            <div className="hidden shrink-0 items-center pl-3 gap-3 md:flex pr-3">
              <span aria-hidden className="h-8 w-px bg-line-strong" />
              <span className="client-logo-chip">
                <img src="/steelmont-logo.png" alt="SteelMont" className="client-logo block h-10 w-auto object-contain" />
              </span>
            </div>
            {/* Standalone: our ERP module launcher. Inside Spectrum ERP the host injects its own into the slot. */}
            {import.meta.env.VITE_CRM_ROUTE_BASE ? null : (
              <ModuleLauncher activeModule={activePage === 'dashboard' ? 'dashboard' : 'crm'} />
            )}
            {/* Spectrum ERP injects module launcher after logo / toggle. */}
            <div id="spectrum-module-launcher-slot" className="flex shrink-0 items-center" />
          </div>

            {/* Right actions */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-shrink-0 pointer-events-auto">
            {/* Order (as Task Management): (Open menu) · Quick create · Full screen · (Search) · Theme · Account.
                Desktop-only controls sit in their own wrappers, so no empty slot adds a gap on mobile. */}
            {focusMode ? (
              <div className="hidden items-center lg:flex">
              <IconTooltip label={focusSidebarOpen ? 'Close menu' : 'Open menu'}>
                <button
                  type="button"
                  onClick={() => setFocusSidebarOpen((open) => !open)}
                  aria-label={focusSidebarOpen ? 'Close left menu' : 'Open left menu'}
                  aria-expanded={focusSidebarOpen}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-primary-soft text-primary transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-primary active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <PanelLeftIcon close={focusSidebarOpen} />
                </button>
              </IconTooltip>
              </div>
            ) : null}

            <QuickCreateMenu />

            <div className="hidden items-center lg:flex">
            <IconTooltip label={focusMode ? 'Exit full screen' : 'Full screen'}>
              <button
                type="button"
                onClick={() => void toggleFocusMode()}
                aria-label={focusMode ? 'Exit full screen' : 'Full screen'}
                aria-pressed={focusMode}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-primary-soft text-primary transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-primary active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <FullscreenIcon exit={focusMode} />
              </button>
            </IconTooltip>
            </div>

            {SHOW_HEADER_SEARCH && searchCallbacks && (
              <IconTooltip label="Search">
              <button
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-lg lg:hidden ${
                  mobileSearchOpen ? 'bg-primary-soft text-primary' : 'text-ink-soft'
                }`}
                aria-label="Search"
                aria-expanded={mobileSearchOpen}
                onClick={() => { setMobileSearchOpen((o) => !o); setAvatarOpen(false); }}
              >
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
              </button>
              </IconTooltip>
            )}

            {/* Global Search */}
            {!SHOW_HEADER_SEARCH ? null : searchCallbacks ? (
              <div className="hidden lg:block">
                <GlobalSearchBar
                  onViewLead={searchCallbacks.onViewLead}
                  onViewContact={searchCallbacks.onViewContact}
                  onViewEntity={searchCallbacks.onViewEntity}
                  onViewActivity={searchCallbacks.onViewActivity}
                  onViewMeeting={searchCallbacks.onViewMeeting}
                  onOpenResults={searchCallbacks.onOpenResults}
                />
              </div>
            ) : (
              <div className="hidden items-center gap-2 rounded-lg border border-line bg-surface-hover px-3 py-1.5 text-xs text-ink-muted lg:flex">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
                </svg>
                <span>Quick search…</span>
                <span className="ml-4 rounded bg-line px-1 py-0.5 font-mono text-xs text-ink-soft">⌘K</span>
              </div>
            )}

            {/* Same order as Task Management: … Full screen, (Search), Theme, Account */}
            <ThemeToggleButton />

            {/* Avatar menu */}
            <div className="relative" ref={avatarRef}>
              <button
                type="button"
                aria-label="Account menu"
                aria-expanded={avatarOpen}
                onClick={() => setAvatarOpen((o) => !o)}
                // Same as Task Management's account button: grey wash while open, chevron turns up.
                className={`flex h-9 items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                  avatarOpen ? 'bg-surface-hover' : ''
                }`}
              >
                <div className="bg-brand flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                  {user?.initials ?? '—'}
                </div>
                <span className="hidden max-w-[140px] truncate text-[13px] font-semibold text-ink sm:block">{user?.name ?? 'User'}</span>
                <svg
                  className={`hidden shrink-0 text-ink-faint transition-transform duration-200 sm:block ${avatarOpen ? 'rotate-180' : ''}`}
                  width="13"
                  height="13"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {(avatarOpen || avatarMenuMounted) && (
                <div
                  data-state={avatarOpen ? 'open' : 'closed'}
                  onAnimationEnd={(e) => {
                    if (e.target === e.currentTarget && !avatarOpen) setAvatarMenuMounted(false);
                  }}
                  className="crm-menu-anim absolute top-full right-0 z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-overlay"
                >
                  <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
                    <div className="bg-brand flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                      {user?.initials ?? '—'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{user?.name ?? 'User'}</p>
                      <p className="truncate text-xs text-ink-muted">{user?.role ?? ''}</p>
                    </div>
                  </div>

                  {([
                    {
                      // lucide icons, as in Task Management's account menu
                      icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
                      label: 'My Profile',
                      action: () => { setAvatarOpen(false); navigate(paths.profile); },
                    },
                    ...(admin ? [{
                      icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
                      label: 'Account Settings',
                      action: () => { setAvatarOpen(false); navigate(paths.settings); },
                    }] : []),
                    // Notifications hidden from the profile menu for now.
                    // {
                    //   icon: <svg …bell… />,
                    //   label: 'Notifications',
                    //   action: () => { setAvatarOpen(false); navigate(paths.notifications); },
                    //   badge: unreadCount > 0 ? String(unreadCount > 9 ? '9+' : unreadCount) : undefined,
                    // },
                  ] as { icon: ReactNode; label: string; action: () => void; badge?: string }[]).map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink-soft outline-none transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover"
                    >
                      <span className="shrink-0 text-ink-faint">{item.icon}</span>
                      <span className="flex-1 text-xs font-medium">{item.label}</span>
                      {item.badge && (
                        <CountBadge value={item.badge} size="sm" tone="accent" />
                      )}
                    </button>
                  ))}

                  <div className="mt-1 border-t border-line-subtle">
                    <button
                      type="button"
                      onClick={() => { setAvatarOpen(false); logout(); navigate(paths.login); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-accent outline-none transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft"
                    >
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="m16 17 5-5-5-5" />
                        <path d="M21 12H9" />
                      </svg>
                      <span className="text-xs font-semibold">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Breadcrumb — second header line, only on nested pages (detail / create / edit).
              Top-level pages skip it: the sidebar highlight and page title already say where you are. */}
          {crumbs.length > 0 && (
          <nav
            className="page-gutter flex min-h-11 min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 border-t border-line-subtle py-1.5 text-xs text-ink-muted"
            aria-label="Breadcrumb"
          >
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <span
                  key={`${crumb.label}-${index}`}
                  className={`inline-flex items-center gap-1.5 ${last ? 'min-w-0 max-w-full' : 'shrink-0'}`}
                >
                  {index > 0 && <CrumbSep />}
                  {crumb.to && !last
                    ? <CrumbLink to={crumb.to}>{crumb.label}</CrumbLink>
                    : <CrumbHere>{crumb.label}</CrumbHere>}
                </span>
              );
            })}
            <div ref={setCrumbActions} className="ml-auto flex shrink-0 items-center empty:hidden" />
          </nav>
          )}
        </header>

        {SHOW_HEADER_SEARCH && mobileSearchOpen && searchCallbacks && (
          <div className="page-gutter flex-shrink-0 border-b border-line bg-surface py-2 pointer-events-auto lg:hidden">
            <GlobalSearchBar
              fullWidth
              onViewLead={(id) => { setMobileSearchOpen(false); searchCallbacks.onViewLead(id); }}
              onViewContact={(id) => { setMobileSearchOpen(false); searchCallbacks.onViewContact(id); }}
              onViewEntity={(id) => { setMobileSearchOpen(false); searchCallbacks.onViewEntity(id); }}
              onViewActivity={() => { setMobileSearchOpen(false); searchCallbacks.onViewActivity(); }}
              onViewMeeting={() => { setMobileSearchOpen(false); searchCallbacks.onViewMeeting(); }}
              onOpenResults={(q) => { setMobileSearchOpen(false); searchCallbacks.onOpenResults(q); }}
            />
          </div>
        )}

        {/* Content */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>

      <AppFooter />
    </div>
    </BreadcrumbActionsSlot.Provider>
  );
}

/** Copyright strip under the whole app (sidebar + content), same as Task Management. */
function AppFooter() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-line bg-surface px-5 text-[11px] text-ink-faint">
      <p className="truncate">
        © {new Date().getFullYear()} {PAGE_COPY.login.rights}
      </p>
      <p className="hidden shrink-0 font-semibold sm:block">Spectrum ERP</p>
    </footer>
  );
}

/** Light / dark switch — shows the theme you will switch to (as in Task Management). */
function ThemeToggleButton() {
  const theme = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Light theme' : 'Dark theme';
  return (
    <IconTooltip label={label}>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        onClick={toggleTheme}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-primary-soft text-primary transition-[background-color,border-color,color,transform] duration-200 ease-out hover:border-primary active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {isDark ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        )}
      </button>
    </IconTooltip>
  );
}
