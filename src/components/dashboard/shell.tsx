// SPDX-License-Identifier: Apache-2.0
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useCallback, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTheme } from 'next-themes';
import {
  Images,
  Palette,
  Sparkles,
  Search,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  LayoutDashboard,
  Recycle,
  Users,
  Layers,
  KeyRound,
  Link2,
  FileText,
  BookOpen,
  Shield,
  Sun,
  Moon,
  FlaskConical,
  HardDrive,
  Wrench,
  Copy,
  UserCircle,
  Map,
  Zap,
  Plug,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';
import { PageTransition } from '@/components/dashboard/page-transition';
import { BottomTabBar } from '@/components/dashboard/bottom-tab-bar';
import { TaskCenter } from '@/components/dashboard/task-center';
import { startTour } from '@/components/onboarding/tour-mounter';
import type { Action } from '@/lib/permissions';

type NavGroupKey = 'overview' | 'assets' | 'create' | 'ai' | 'delivery' | 'admin';

type NavItem = {
  label: string;
  href: string;
  icon: typeof Images;
  group: NavGroupKey;
  minAction?: Action;
  sectionKey?: string;
  keywords?: string[];
};

const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'assets', label: 'Assets' },
  { key: 'create', label: 'Create' },
  { key: 'ai', label: 'AI' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'admin', label: 'Admin' },
];

const navItems: {
  label: string;
  href: string;
  icon: typeof Images;
  group: NavGroupKey;
  minAction?: Action;
  sectionKey?: string;
  keywords?: string[];
}[] = [
  {
    label: 'Overview',
    href: '/dashboard/analytics',
    icon: LayoutDashboard,
    group: 'overview',
    sectionKey: 'dashboard',
    keywords: ['analytics', 'home'],
  },
  {
    label: 'Guides',
    href: '/dashboard/docs',
    icon: BookOpen,
    group: 'overview',
    keywords: ['docs', 'help', 'support'],
  },
  {
    label: 'Assets',
    href: '/dashboard',
    icon: Images,
    group: 'assets',
    keywords: ['library', 'uploads'],
  },
  {
    label: 'Duplicates',
    href: '/dashboard/duplicates',
    icon: Copy,
    group: 'assets',
    sectionKey: 'duplicates',
  },
  {
    label: 'People',
    href: '/dashboard/people',
    icon: UserCircle,
    group: 'assets',
    sectionKey: 'people',
  },
  {
    label: 'Smart Albums',
    href: '/dashboard/smart-albums',
    icon: Zap,
    group: 'assets',
    sectionKey: 'smart_albums',
  },
  {
    label: 'Map',
    href: '/dashboard/map',
    icon: Map,
    group: 'assets',
    sectionKey: 'map',
  },
  {
    label: 'Trash',
    href: '/dashboard/vault',
    icon: Recycle,
    group: 'assets',
    sectionKey: 'trash',
  },
  {
    label: 'Designs',
    href: '/dashboard/designs',
    icon: Palette,
    group: 'create',
    minAction: 'design',
    sectionKey: 'designs',
  },
  {
    label: 'PDF Suite',
    href: '/dashboard/pdf',
    icon: FileText,
    group: 'create',
    sectionKey: 'tools',
    keywords: ['pdf', 'documents'],
  },
  {
    label: 'Tools',
    href: '/dashboard/tools',
    icon: Wrench,
    group: 'create',
    sectionKey: 'tools',
  },
  {
    label: 'AI Studio',
    href: '/dashboard/ai',
    icon: Sparkles,
    group: 'ai',
    minAction: 'ai',
    sectionKey: 'ai_studio',
  },
  {
    label: 'Shares',
    href: '/dashboard/shares',
    icon: Link2,
    group: 'delivery',
    minAction: 'share',
    sectionKey: 'shares',
  },
  {
    label: 'API Playground',
    href: '/dashboard/api-playground',
    icon: FlaskConical,
    group: 'delivery',
    sectionKey: 'api_playground',
    keywords: ['api', 'developer'],
  },
  {
    label: 'Team',
    href: '/dashboard/settings/team',
    icon: Users,
    group: 'admin',
    minAction: 'manage_settings',
    sectionKey: 'team',
  },
  {
    label: 'Transforms',
    href: '/dashboard/settings/transforms',
    icon: Layers,
    group: 'admin',
    minAction: 'manage_settings',
    sectionKey: 'transforms',
  },
  {
    label: 'API Keys',
    href: '/dashboard/settings/api-keys',
    icon: KeyRound,
    group: 'admin',
    minAction: 'manage_api_keys',
    sectionKey: 'api_keys',
  },
  {
    label: 'Client Setup',
    href: '/dashboard/settings/integration',
    icon: Plug,
    group: 'admin',
    minAction: 'manage_api_keys',
    sectionKey: 'api_keys',
    keywords: ['embed', 'sdk', 'integration'],
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    group: 'admin',
    minAction: 'manage_settings',
    sectionKey: 'settings',
  },
  {
    label: 'Admin',
    href: '/dashboard/admin',
    icon: Shield,
    group: 'admin',
    minAction: 'manage_settings',
    keywords: ['platform', 'ops'],
  },
];

/* Format bytes as readable GB for sidebar */
function formatSidebarGB(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(0)} MB`;
  return '0 MB';
}

interface DashboardShellProps {
  user: { name: string; email: string; image: string };
  orgId: string;
  children: ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const pathname = usePathname();
  /* Auto-collapse sidebar when inside the design editor (/dashboard/designs/[id]) */
  const isDesignEditor = /^\/dashboard\/designs\/[^/]+$/.test(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [quickNavPathname, setQuickNavPathname] = useState<string | null>(null);
  const [quickNavQuery, setQuickNavQuery] = useState('');
  const { can, canAccessSection } = useRole();
  const { theme, setTheme } = useTheme();
  const [isThemeReady, setIsThemeReady] = useState(false);

  /* Storage usage for sidebar meter */
  const [storageUsed, setStorageUsed] = useState(0);

  const sidebarCollapsed = collapsed || isDesignEditor;
  const showQuickNav = quickNavPathname === pathname;

  const closeQuickNav = useCallback(() => {
    setQuickNavPathname(null);
    setQuickNavQuery('');
  }, []);

  const openQuickNav = useCallback(() => {
    setQuickNavPathname(pathname);
    setQuickNavQuery('');
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (showQuickNav) {
          closeQuickNav();
        } else {
          openQuickNav();
        }
      }

      if (event.key === 'Escape') {
        closeQuickNav();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeQuickNav, openQuickNav, showQuickNav]);

  /* Fetch storage usage on mount */
  useEffect(() => {
    fetch('/api/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.storage) setStorageUsed(d.storage.usedBytes ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIsThemeReady(true);
  }, []);

  const isDarkTheme = isThemeReady && theme === 'dark';

  const visibleNavItems = useMemo(
    () =>
      navItems.filter(
        (item) =>
          (!item.minAction || can(item.minAction)) &&
          (!item.sectionKey || canAccessSection(item.sectionKey)),
      ),
    [can, canAccessSection],
  );

  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: visibleNavItems.filter((item) => item.group === group.key),
      })).filter((group) => group.items.length > 0),
    [visibleNavItems],
  );

  const filteredQuickNavItems = useMemo(() => {
    const normalizedQuery = quickNavQuery.trim().toLowerCase();
    const quickNavItems = visibleNavGroups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        groupLabel: group.label,
      })),
    );

    if (!normalizedQuery) {
      return quickNavItems;
    }

    return quickNavItems.filter((item) =>
      [item.label, item.groupLabel, ...(item.keywords ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [quickNavQuery, visibleNavGroups]);

  const getTourId = (item: NavItem) => {
    if (item.href === '/dashboard/pdf') {
      return 'nav-pdf-suite';
    }

    if (item.sectionKey) {
      return `nav-${item.sectionKey}`;
    }

    if (item.href === '/dashboard') {
      return 'nav-assets';
    }

    return undefined;
  };

  const isNavItemActive = (item: NavItem) =>
    item.href === '/dashboard'
      ? pathname === '/dashboard'
      : pathname.startsWith(item.href);

  return (
    <div className="flex h-screen bg-dash-bg text-dash-text transition-colors">
      {showQuickNav && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={closeQuickNav}
        >
          <div
            className="mx-auto mt-20 w-[min(92vw,40rem)] overflow-hidden rounded-3xl border border-dash-border bg-dash-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-dash-border px-4 py-3">
              <div className="flex items-center gap-3 rounded-2xl border border-dash-border bg-dash-muted px-3 py-2.5">
                <Search className="h-4 w-4 text-dash-text-muted" />
                <input
                  autoFocus
                  value={quickNavQuery}
                  onChange={(event) => setQuickNavQuery(event.target.value)}
                  placeholder="Jump to a page, setting, or tool"
                  className="w-full bg-transparent text-sm text-dash-text outline-none placeholder:text-dash-text-muted"
                />
                <span className="rounded-md border border-dash-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-dash-text-muted">
                  Ctrl K
                </span>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredQuickNavItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-dash-text2">
                  No matching navigation item.
                </div>
              ) : (
                filteredQuickNavItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeQuickNav}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-dash-muted"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-dash-muted text-[var(--im-primary)]">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-dash-text">{item.label}</p>
                        <p className="text-xs text-dash-text-muted">{item.groupLabel}</p>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        suppressHydrationWarning
        className={`hidden shrink-0 flex-col border-r border-dash-sidebar-border bg-dash-sidebar transition-all duration-200 md:flex ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo + Collapse toggle */}
        <div
          className="relative flex h-14 items-center border-b border-dash-sidebar-border px-3"
          suppressHydrationWarning
        >
          <div
            className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}
            suppressHydrationWarning
          >
            <span className="rounded-md bg-[var(--im-primary)] px-2 py-0.5 text-xs font-bold tracking-widest text-[var(--im-primary-fg)]">
              IM
            </span>
            {!sidebarCollapsed && (
              <span className="text-sm font-semibold text-dash-text">
                ImageMan
              </span>
            )}
          </div>

          {/* Collapse / Expand toggle — centered on border */}
          <button
            onClick={() => {
              if (!isDesignEditor) {
                setCollapsed((current) => !current);
              }
            }}
            className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--im-primary)]/30 bg-[var(--im-primary)] text-[var(--im-primary-fg)] shadow-md transition hover:brightness-110 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-70"
            title={isDesignEditor ? 'Sidebar is locked while editing' : sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            disabled={isDesignEditor}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-3 w-3" />
            ) : (
              <PanelLeftClose className="h-3 w-3" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <button
            onClick={openQuickNav}
            className={`flex w-full items-center gap-2 rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-left text-xs text-dash-text-muted transition hover:border-[var(--im-primary)]/40 hover:text-dash-text ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
            title={sidebarCollapsed ? 'Quick find' : undefined}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1">Quick find</span>
                <span className="rounded-md border border-dash-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-dash-text-muted">
                  Ctrl K
                </span>
              </>
            )}
          </button>

          <div className="mt-3 space-y-4">
            {visibleNavGroups.map((group) => (
              <div key={group.key} className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-dash-text-muted">
                    {group.label}
                  </p>
                )}

                {group.items.map((item) => {
                  const active = isNavItemActive(item);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour-id={getTourId(item)}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                        active
                          ? 'bg-primary/10 font-semibold text-primary shadow-[inset_2px_0_0_0_var(--im-primary)]'
                          : 'text-dash-text2 hover:bg-dash-sidebar-hover hover:text-dash-text'
                      } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-all duration-200 ${active ? 'text-primary drop-shadow-[0_0_4px_var(--im-primary)]' : 'text-dash-text-muted group-hover:text-dash-text'}`}
                      />
                      {!sidebarCollapsed && <span>{item.label}</span>}

                      {sidebarCollapsed && (
                        <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-dash-inverted dark:bg-dash-muted px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* User section */}
        <div className="border-t border-dash-sidebar-border p-2">
          {/* Storage used. Self-hosted — your bucket, no ceiling to draw. */}
          <div
            className={`mb-2 rounded-lg px-3 py-2 ${sidebarCollapsed ? 'px-1.5' : ''}`}
            title={`${formatSidebarGB(storageUsed)} stored in your own bucket`}
          >
            {sidebarCollapsed ? (
              <p className="text-center text-[9px] text-dash-text-muted">
                {formatSidebarGB(storageUsed)}
              </p>
            ) : (
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-dash-text2">
                  <HardDrive className="h-3 w-3 text-dash-text-muted" />
                  Storage used
                </span>
                <span className="font-medium text-dash-text-muted">
                  {formatSidebarGB(storageUsed)}
                </span>
              </div>
            )}
          </div>
          {/* Dark/Light mode toggle */}
          <button
            onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-dash-text-muted transition-all duration-200 hover:bg-primary/10 hover:text-primary mb-1 ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
            title={
              sidebarCollapsed
                ? isDarkTheme
                  ? 'Light mode'
                  : 'Dark mode'
                : undefined
            }
            suppressHydrationWarning
          >
            {isDarkTheme ? (
              <Sun className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 hover:rotate-45" />
            ) : (
              <Moon className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 hover:-rotate-12" />
            )}
            {!sidebarCollapsed && (
              <span suppressHydrationWarning>
                {isDarkTheme ? 'Light Mode' : 'Dark Mode'}
              </span>
            )}
          </button>

          <div
            className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : 'px-1'}`}
          >
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-dash-muted text-xs font-semibold text-dash-text2">
                {user.name.charAt(0)}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-dash-text">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-dash-text-muted">
                  {user.email}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className={`group relative mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-dash-text-muted transition hover:bg-dash-sidebar-hover hover:text-dash-text ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
            title={sidebarCollapsed ? 'Sign out' : undefined}
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Sign out</span>}
            {sidebarCollapsed && (
              <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-dash-inverted dark:bg-dash-muted px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                Sign out
              </span>
            )}
          </button>
          <button
            onClick={() => startTour()}
            className={`group relative mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-dash-text-muted transition hover:bg-dash-sidebar-hover hover:text-dash-text ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
            title={sidebarCollapsed ? 'Replay tour' : undefined}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Replay tour</span>}
            {sidebarCollapsed && (
              <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-dash-inverted dark:bg-dash-muted px-2 py-1 text-xs font-medium text-white shadow-lg group-hover:block">
                Replay tour
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        id="main-content"
        tabIndex={-1}
        className={`flex-1 bg-dash-bg focus:outline-none pb-16 md:pb-0 ${isDesignEditor ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        <PageTransition>{children}</PageTransition>
      </main>

      {!isDesignEditor && <TaskCenter compactOffset />}

      {/* Mobile bottom tab bar — visible only at <768px */}
      {!isDesignEditor && <BottomTabBar />}
    </div>
  );
}
