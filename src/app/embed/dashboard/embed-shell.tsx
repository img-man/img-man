// SPDX-License-Identifier: Apache-2.0
'use client';

import {
	useState,
	useEffect,
	useMemo,
	useCallback,
	useRef,
	lazy,
	Suspense,
	type ReactNode,
} from 'react';
import {
 Images,
 Palette,
 Sparkles,
 Link2,
 Users,
 LayoutDashboard,
 PanelLeftClose,
 PanelLeftOpen,
 Sun,
 Moon,
 Loader2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRole } from '@/components/dashboard/role-context';
import { TaskCenter } from '@/components/dashboard/task-center';
import { EMBED_BREAKPOINTS } from '@/components/dashboard/embed-container';
import { EmbedScopeProvider } from './embed-scope-context';
import { EmbedDashboardOverview } from './embed-dashboard-overview';
import type { Action } from '@/lib/permissions';

/* ─── Lazy-loaded content panels (real dashboard pages) ──────── */

const AssetsPage = lazy(() => import('@/app/dashboard/page'));
const DesignsPage = lazy(() => import('@/app/dashboard/designs/page'));
const AiStudioPage = lazy(() => import('@/app/dashboard/ai/page'));
const SharesPage = lazy(() => import('@/app/dashboard/shares/page'));
const TeamPage = lazy(() => import('@/app/dashboard/settings/team/page'));

/* ─── Tab definitions ───────────────────────────────────────── */

interface EmbedTab {
 key: string;
 label: string;
 icon: typeof Images;
 minAction?: Action;
 sectionKey?: string;
}

const EMBED_TABS: EmbedTab[] = [
 { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, sectionKey: 'dashboard' },
 { key: 'assets', label: 'Assets', icon: Images, sectionKey: 'vault' },
 { key: 'designs', label: 'Designs', icon: Palette, minAction: 'design', sectionKey: 'designs' },
 { key: 'ai_studio', label: 'AI Studio', icon: Sparkles, minAction: 'ai', sectionKey: 'ai_studio' },
 { key: 'shares', label: 'Shares', icon: Link2, minAction: 'share', sectionKey: 'shares' },
 { key: 'team', label: 'Team', icon: Users, minAction: 'manage_settings', sectionKey: 'settings' },
];

/* ─── Props ──────────────────────────────────────────────────── */

interface EmbedDashboardShellProps {
 user: { name: string; email: string; image: string };
 token: string;
 allowedSections?: string[];
 folderScope?: string;
 brand?: string | null;
 accessRules?: { path: string; role: string; resourceType: string }[];
 logoUrl?: string | null;
 orgName?: string;
 embedConfig?: { showLogo: boolean; showName: boolean };
 aiFeatureConfig?: Record<string, { mode?: string }> | null;
}

/* ─── Loading fallback ──────────────────────────────────────── */

function ContentLoader() {
 return (
 <div className="flex h-full items-center justify-center">
 <div className="flex flex-col items-center gap-3">
 <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
 <p className="text-sm text-dash-text2 ">Loading…</p>
 </div>
 </div>
 );
}

/* ─── Component ─────────────────────────────────────────────── */

export function EmbedDashboardShell({
 user,
 token,
 allowedSections,
 folderScope,
 brand,
 accessRules = [],
 logoUrl,
 orgName,
 embedConfig = { showLogo: true, showName: true },
 aiFeatureConfig = null,
}: EmbedDashboardShellProps) {
 const { can, canAccessSection, sectionAccess } = useRole();
 const { theme, setTheme } = useTheme();
 const shellRef = useRef<HTMLDivElement>(null);
 const [collapsed, setCollapsed] = useState(false);
 const [logoError, setLogoError] = useState(false);
 const [containerWidth, setContainerWidth] = useState<number>(
 EMBED_BREAKPOINTS.wide,
 );

 useEffect(() => {
 if (!shellRef.current || typeof ResizeObserver === 'undefined') return;

 const observer = new ResizeObserver(([entry]) => {
 const nextWidth = Math.round(entry.contentRect.width);
 if (nextWidth > 0) setContainerWidth(nextWidth);
 });

 observer.observe(shellRef.current);
 return () => observer.disconnect();
 }, []);

 /* ── Patch window.fetch to inject Bearer token on /api/ calls ── */
 useEffect(() => {
 if (!token) return;

 const originalFetch = window.fetch.bind(window);

 window.fetch = function patchedFetch(
 input: RequestInfo | URL,
 init?: RequestInit,
 ): Promise<Response> {
 const url =
 typeof input === 'string'
 ? input
 : input instanceof URL
 ? input.toString()
 : input instanceof Request
 ? input.url
 : '';

 // Only inject for same-origin /api/ calls (not external)
 const isSameOriginApi =
 url.startsWith('/api/') ||
 url.startsWith(`${window.location.origin}/api/`);

 if (isSameOriginApi) {
 const newInit = { ...(init ?? {}) };
 const headers = new Headers(newInit.headers);

 if (!headers.has('Authorization')) {
 headers.set('Authorization', `Bearer ${token}`);
 }

 newInit.headers = headers;
 return originalFetch(input, newInit);
 }

 return originalFetch(input, init);
 };

 return () => {
 window.fetch = originalFetch;
 };
 }, [token]);

 /* ── Filter visible tabs by role + allowed sections ── */
 const visibleTabs = useMemo(
 () => {
 // Derive allowed section keys from membership sectionAccess
 const membershipSections = Object.keys(sectionAccess).length > 0
 ? Object.keys(sectionAccess)
 : null;

 return EMBED_TABS.filter((tab) => {
 // URL param allowedSections uses embed tab keys (assets, designs, etc.)
 if (allowedSections?.length && !allowedSections.includes(tab.key)) {
 return false;
 }
 // Membership sectionAccess uses img-man section keys (vault, designs, etc.)
 // Match via tab.sectionKey which maps embed keys → img-man keys
 if (membershipSections && tab.sectionKey && !membershipSections.includes(tab.sectionKey)) {
 return false;
 }
 // Role-based action check
 if (tab.minAction && !can(tab.minAction)) return false;
 // Section-based visibility check (uses canAccessSection which checks minRole)
 if (tab.sectionKey && !canAccessSection(tab.sectionKey)) return false;
 return true;
 });
 },
 [allowedSections, sectionAccess, can, canAccessSection],
 );

 const [activeTab, setActiveTab] = useState(() => visibleTabs[0]?.key ?? 'assets');
 const isCompactContainer = containerWidth < EMBED_BREAKPOINTS.compact;
 const isNarrowContainer = containerWidth < EMBED_BREAKPOINTS.large;
 const isRailMode = containerWidth < EMBED_BREAKPOINTS.wide;
 const sidebarCollapsed = collapsed || isRailMode;
 const showSidebar = !isNarrowContainer;
 const showBottomTabs = isNarrowContainer;

 const activeTabValid = visibleTabs.some((t) => t.key === activeTab);
 const firstVisibleKey = visibleTabs[0]?.key ?? 'assets';
 const resolvedActiveTab = activeTabValid ? activeTab : firstVisibleKey;
 const activeTabMeta = visibleTabs.find((tab) => tab.key === resolvedActiveTab) ?? visibleTabs[0];

 /* ── Render content for active tab ── */
 /* ── Helper: navigate from dashboard overview to asset tab with folder ── */
 const handleNavigateToFolder = useCallback(() => {
 // Switch to assets tab — the folder scope will be handled by the assets page
 setActiveTab('assets');
 }, []);

 function renderContent(): ReactNode {
 switch (resolvedActiveTab) {
 case 'dashboard':
 return (
 <EmbedDashboardOverview
 accessRules={accessRules}
 onNavigateToFolder={handleNavigateToFolder}
 authToken={token}
 />
 );
 case 'assets':
 return <AssetsPage />;
 case 'designs':
 return <DesignsPage />;
 case 'ai_studio':
 return <AiStudioPage />;
 case 'shares':
 return <SharesPage />;
 case 'team':
 return <TeamPage />;
 default:
 return (
 <div className="flex h-full items-center justify-center text-dash-text2">
 Select a section from the sidebar.
 </div>
 );
 }
 }

 /* ── Render ── */
 return (
 <EmbedScopeProvider folderScope={folderScope ?? null}>
 <div
 ref={shellRef}
 className="flex h-screen bg-dash-muted dark:bg-dash-deep text-dash-text dark:text-dash-inverted-text transition-colors overflow-hidden"
 >
 {/* Sidebar */}
 {showSidebar && (
 <aside
 suppressHydrationWarning
 className={`shrink-0 flex-col border-r border-dash-border bg-dash-surface dark:bg-dash-inverted transition-all duration-200 ${
 sidebarCollapsed ? 'w-14' : 'w-52'
 }`}
 >
 {/* Brand header */}
 <div className="relative flex h-12 items-center border-b border-dash-border px-3" suppressHydrationWarning>
 <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center w-full' : ''}`} suppressHydrationWarning>
 {embedConfig.showLogo && logoUrl && !logoError ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img
 src={logoUrl}
 alt={orgName ?? 'Logo'}
 className="h-7 w-7 rounded-md object-contain"
 onError={() => setLogoError(true)}
 />
 ) : (
 <span className="flex h-7 w-7 items-center justify-center rounded-md bg-(--im-primary) text-xs font-bold text-(--im-primary-fg)">
 {(brand ?? orgName ?? 'IM').charAt(0).toUpperCase()}
 </span>
 )}
 {!sidebarCollapsed && (
 <span className="text-sm font-semibold text-dash-text dark:text-dash-inverted-text truncate">
 {embedConfig.showName && orgName
 ? orgName.replace(/workspace/gi, 'Gallery')
 : (brand ?? 'ImageMan')}
 </span>
 )}
 </div>

 <button
 onClick={() => setCollapsed((c) => !c)}
 className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 border-(--im-primary)/30 bg-(--im-primary) text-(--im-primary-fg) shadow-md transition hover:brightness-110 hover:scale-110"
 title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
 >
 {sidebarCollapsed ? (
 <PanelLeftOpen className="h-3 w-3" />
 ) : (
 <PanelLeftClose className="h-3 w-3" />
 )}
 </button>
 </div>

 {/* Navigation */}
 <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
 {visibleTabs.map((tab) => {
 const active = tab.key === resolvedActiveTab;
 const Icon = tab.icon;
 return (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key)}
 className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
 active
 ? 'bg-(--im-primary-light) font-semibold text-(--im-primary)'
 : 'text-dash-text2 hover:bg-dash-muted dark:hover:bg-dash-inverted-hover hover:text-dash-text dark:hover:text-dash-inverted-text'
 } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
 title={sidebarCollapsed ? tab.label : undefined}
 >
 <Icon
 className={`h-4 w-4 shrink-0 ${
 active ? 'text-(--im-primary)' : 'text-dash-text2 '
 }`}
 />
 {!sidebarCollapsed && <span>{tab.label}</span>}

 {/* Tooltip when collapsed */}
 {sidebarCollapsed && (
 <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-dash-inverted dark:bg-dash-muted px-2 py-1 text-xs font-medium text-white dark:text-dash-text shadow-lg group-hover:block">
 {tab.label}
 </span>
 )}
 </button>
 );
 })}
 </nav>

 {/* Footer: user + theme */}
 <div className="border-t border-dash-border p-2">
 {/* Dark / Light toggle */}
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-dash-text2 transition hover:bg-dash-muted dark:hover:bg-dash-inverted-hover hover:text-dash-text dark:hover:text-dash-inverted-text mb-1 ${
 sidebarCollapsed ? 'justify-center px-0' : ''
 }`}
 title={sidebarCollapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
 suppressHydrationWarning
 >
 {theme === 'dark' ? <Sun className="h-3.5 w-3.5 shrink-0" /> : <Moon className="h-3.5 w-3.5 shrink-0" />}
 {!sidebarCollapsed && (
 <span suppressHydrationWarning>
 {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
 </span>
 )}
 </button>

 {/* User info (no sign-out for embed) */}
 <div className={`flex items-center gap-2 ${sidebarCollapsed ? 'justify-center' : 'px-1'}`}>
 {user.image ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={user.image} alt="" className="h-6 w-6 rounded-full" />
 ) : (
 <div className="flex h-6 w-6 items-center justify-center rounded-full bg-dash-badge text-[10px] font-semibold text-dash-text2 dark:text-dash-inverted-text">
 {user.name?.charAt(0) ?? '?'}
 </div>
 )}
 {!sidebarCollapsed && (
 <div className="min-w-0 flex-1">
 <p className="truncate text-xs font-medium text-dash-text dark:text-dash-inverted-text">{user.name}</p>
 <p className="truncate text-[10px] text-dash-text2 ">{user.email}</p>
 </div>
 )}
 </div>

 {/* img-man copyright */}
 {!sidebarCollapsed && (
 <p className="mt-2 text-center text-[9px] text-dash-text-muted ">
 Powered by <span className="font-semibold">ImageMan</span>
 </p>
 )}
 </div>
 </aside>
 )}

 {showBottomTabs && (
 <div className="absolute inset-x-0 top-0 z-20 border-b border-dash-border bg-dash-surface/95 px-3 py-2 backdrop-blur dark:bg-dash-inverted/95">
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="truncate text-xs font-semibold text-dash-text">
 {embedConfig.showName && orgName
 ? orgName.replace(/workspace/gi, 'Gallery')
 : (brand ?? 'ImageMan')}
 </p>
 <p className="truncate text-[11px] text-dash-text-muted">
 {activeTabMeta?.label ?? 'Workspace'}
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
 className="rounded-lg border border-dash-border p-2 text-dash-text-muted transition hover:bg-dash-muted hover:text-dash-text"
 title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
 >
 {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
 </button>
 </div>
 </div>
 {isCompactContainer && visibleTabs.length > 0 && (
 <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
 {visibleTabs.map((tab) => {
 const active = tab.key === resolvedActiveTab;
 return (
 <button
 key={`chip-${tab.key}`}
 onClick={() => setActiveTab(tab.key)}
 className={`rounded-full px-3 py-1 text-[11px] whitespace-nowrap transition ${
 active
 ? 'bg-(--im-primary-light) font-semibold text-(--im-primary)'
 : 'bg-dash-muted text-dash-text2'
 }`}
 >
 {tab.label}
 </button>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* Mobile tab bar (visible on small screens) */}
 {showBottomTabs && (
 <div className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-dash-border bg-dash-surface dark:bg-dash-inverted">
 {visibleTabs.map((tab) => {
 const active = tab.key === resolvedActiveTab;
 const Icon = tab.icon;
 return (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key)}
 className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition ${
 active
 ? 'text-(--im-primary) font-semibold'
 : 'text-dash-text2 '
 }`}
 >
 <Icon className="h-4 w-4" />
 <span>{tab.label}</span>
 </button>
 );
 })}
 </div>
 )}

 {/* Main content */}
 <main className={`flex-1 overflow-hidden ${showBottomTabs ? 'pt-14 pb-14' : ''} ${showBottomTabs && isCompactContainer ? 'pt-24' : ''}`}>
 <Suspense fallback={<ContentLoader />}>
 {renderContent()}
 </Suspense>
 </main>

 <TaskCenter
 authToken={token}
 compactOffset
 // Disable AI polling only when org has explicitly disabled every
 // feature. Missing/empty config defaults to enabled (model default).
 aiEnabled={
 !aiFeatureConfig ||
 Object.keys(aiFeatureConfig).length === 0 ||
 Object.values(aiFeatureConfig).some(
 (f) => !f || f.mode !== 'disabled',
 )
 }
 />
 </div>
 </EmbedScopeProvider>
 );
}
