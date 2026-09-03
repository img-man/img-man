// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Images,
  HardDrive,
  Users,
  Activity,
  ChevronDown,
  Folder,
  Eye,
  Sparkles,
} from 'lucide-react';
import { useRole } from '@/components/dashboard/role-context';
import { ROLE_LEVEL } from '@/lib/permissions';

/* ─── Types ─────────────────────────────────────────────────── */

interface FolderRule {
 path: string;
 role: string;
 resourceType: string;
}

interface FolderStat {
 folderId: string;
 name: string;
 path: string;
 role: string;
 assetCount: number;
 totalSizeBytes: number;
 recentUploads: number; // last 7 days
 shareCount: number;
}

interface DashboardStats {
 totalAssets: number;
 totalSizeBytes: number;
 totalFolders: number;
 recentUploads: number;
 aiJobsRun: number;
 totalShares: number;
}

/* ─── Helpers ───────────────────────────────────────────────── */

function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function isFolderUnderRule(folderPath: string, rulePath: string): boolean {
  if (rulePath === '/' || rulePath === '') return true;
  if (folderPath === rulePath) return true;
  return folderPath.startsWith(rulePath.endsWith('/') ? rulePath : `${rulePath}/`);
}

/* ─── Props ─────────────────────────────────────────────────── */

interface EmbedDashboardOverviewProps {
 accessRules: FolderRule[];
 onNavigateToFolder?: (folderId: string) => void;
 /**
  * Embed access token (imgt_...). Passed explicitly because this
  * component's useEffect fires before the parent EmbedDashboardShell
  * has a chance to install its `window.fetch` Authorization patch,
  * which previously caused initial 401s on /api/v1/folders and
  * /api/v1/ai/jobs and surfaced as "access restricted" inside the iframe.
  */
 authToken?: string;
}

/* ─── Component ─────────────────────────────────────────────── */

export function EmbedDashboardOverview({
 accessRules,
 onNavigateToFolder,
 authToken,
}: EmbedDashboardOverviewProps) {
 const [selectedFolder, setSelectedFolder] = useState<string>('all');
 const [dropdownOpen, setDropdownOpen] = useState(false);
 const [folderStats, setFolderStats] = useState<FolderStat[]>([]);
 const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
 const [loading, setLoading] = useState(true);

  const { role } = useRole();

  // Fetch folder-level stats for all accessible folders
  useEffect(() => {
  const authHeaders: HeadersInit = authToken
  ? { Authorization: `Bearer ${authToken}` }
  : {};
  async function fetchStats() {
  setLoading(true);
  try {
  // Fetch folders, ai jobs and global asset stats (for fallback)
  const [foldersRes, aiJobsRes, globalAssetsRes] = await Promise.all([
  fetch('/api/v1/folders', { headers: authHeaders }),
  fetch('/api/v1/ai/jobs?limit=1', { headers: authHeaders }),
  fetch('/api/v1/assets?limit=0&includeStats=true', { headers: authHeaders }),
  ]);
  const foldersData = foldersRes.ok ? await foldersRes.json() : {};
  const allFolders: { _id: string; name: string; path: string; accessMode?: string }[] = foldersData.folders ?? [];
  const aiData = aiJobsRes.ok ? await aiJobsRes.json() : {};
  const totalAiJobs = aiData.pagination?.total ?? 0;
  const globalAssetsData = globalAssetsRes.ok ? await globalAssetsRes.json() : {};
  const globalTotal = globalAssetsData.total ?? 0;
  const globalSizeBytes = globalAssetsData.totalSizeBytes ?? 0;

  // Determine which folders are accessible
  let accessibleFolders: typeof allFolders = [];
  if (accessRules.length === 0) {
  // No explicit rules: owner/admin sees all, otherwise only flexible folders
  const level = (ROLE_LEVEL as Record<string, number>)[role] ?? 0;
  if (level >= 3) {
  accessibleFolders = allFolders;
  } else {
  accessibleFolders = allFolders.filter((f) => (f.accessMode ?? 'flexible') !== 'restricted');
  // Fallback: if filtering yields 0 but folders exist (e.g. accessMode missing), show all
  if (accessibleFolders.length === 0 && allFolders.length > 0) {
  accessibleFolders = allFolders;
  }
  }
  } else {
  const seen = new Set<string>();
  for (const rule of accessRules) {
  if (rule.resourceType !== 'folder') continue;
  for (const folder of allFolders) {
  if (isFolderUnderRule(folder.path, rule.path) && !seen.has(folder._id)) {
  seen.add(folder._id);
  accessibleFolders.push(folder);
  }
  }
  }
  // If prefix matching yielded nothing (stale paths), fall back to exact match
  if (accessibleFolders.length === 0) {
  for (const rule of accessRules) {
  if (rule.resourceType !== 'folder') continue;
  const folder = allFolders.find((f) => f.path === rule.path);
  if (folder && !seen.has(folder._id)) {
  seen.add(folder._id);
  accessibleFolders.push(folder);
  }
  }
  }
  }

  // Build a map rulePath+role for display: longest matching rule wins
  function roleForFolder(folderPath: string): string {
  let bestRole = 'viewer';
  let bestLen = -1;
  for (const r of accessRules) {
  if (r.resourceType !== 'folder') continue;
  if (isFolderUnderRule(folderPath, r.path) && r.path.length > bestLen) {
  bestLen = r.path.length;
  bestRole = r.role;
  }
  }
  if (bestLen === -1 && accessRules.length === 0) return role ?? 'viewer';
  return bestRole;
  }

  // Fetch per-folder stats
  const stats: FolderStat[] = [];
  for (const folder of accessibleFolders) {
  try {
  const assetsRes = await fetch(
  `/api/v1/assets?folderId=${folder._id}&limit=0&includeStats=true`,
  { headers: authHeaders },
  );
  const assetsData = assetsRes.ok ? await assetsRes.json() : {};
  stats.push({
  folderId: folder._id,
  name: folder.name,
  path: folder.path,
  role: roleForFolder(folder.path),
  assetCount: assetsData.total ?? assetsData.assets?.length ?? 0,
  totalSizeBytes: assetsData.totalSizeBytes ?? 0,
  recentUploads: 0,
  shareCount: 0,
  });
  } catch {
  stats.push({
  folderId: folder._id,
  name: folder.name,
  path: folder.path,
  role: roleForFolder(folder.path),
  assetCount: 0,
  totalSizeBytes: 0,
  recentUploads: 0,
  shareCount: 0,
  });
  }
  }

  setFolderStats(stats);

  // Aggregate dashboard stats — fall back to global org totals when per-folder sums are 0
  const summedAssets = stats.reduce((sum, s) => sum + s.assetCount, 0);
  const summedSize = stats.reduce((sum, s) => sum + s.totalSizeBytes, 0);
  setDashboardStats({
  totalAssets: summedAssets || globalTotal,
  totalSizeBytes: summedSize || globalSizeBytes,
  totalFolders: stats.length || allFolders.length,
  recentUploads: stats.reduce((sum, s) => sum + s.recentUploads, 0),
  aiJobsRun: totalAiJobs,
  totalShares: stats.reduce((sum, s) => sum + s.shareCount, 0),
  });
  } catch (err) {
  console.error('[EmbedDashboard] Failed to fetch stats:', err);
  } finally {
  setLoading(false);
  }
  }

  fetchStats();
  }, [accessRules, authToken, role]);

 // Current stats based on selection
 const currentStats = useMemo(() => {
 if (selectedFolder === 'all') return dashboardStats;
 const folder = folderStats.find((f) => f.folderId === selectedFolder);
 if (!folder) return dashboardStats;
 return {
 totalAssets: folder.assetCount,
 totalSizeBytes: folder.totalSizeBytes,
 totalFolders: 1,
 recentUploads: folder.recentUploads,
 aiJobsRun: dashboardStats?.aiJobsRun ?? 0,
 totalShares: folder.shareCount,
 };
 }, [selectedFolder, dashboardStats, folderStats]);

 const selectedFolderName = useMemo(() => {
 if (selectedFolder === 'all') return 'All Resources';
 return folderStats.find((f) => f.folderId === selectedFolder)?.name ?? 'Unknown';
 }, [selectedFolder, folderStats]);

 const handleFolderSelect = useCallback((folderId: string) => {
 setSelectedFolder(folderId);
 setDropdownOpen(false);
 }, []);

 if (loading) {
 return (
 <div className="flex h-full items-center justify-center">
 <div className="flex flex-col items-center gap-3">
 <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--im-primary)] border-t-transparent" />
 <p className="text-sm text-dash-text2">Loading dashboard…</p>
 </div>
 </div>
 );
 }

 return (
 <div className="h-full overflow-y-auto p-6">
 {/* Header with folder dropdown */}
 <div className="mb-6 flex items-center justify-between">
 <div>
 <h1 className="text-xl font-semibold text-dash-text dark:text-dash-inverted-text">
 Dashboard
 </h1>
 <p className="mt-0.5 text-sm text-dash-text2 ">
 Overview of your managed resources
 </p>
 </div>

 {/* Resource scope dropdown */}
 {folderStats.length > 0 && (
 <div className="relative">
 <button
 onClick={() => setDropdownOpen(!dropdownOpen)}
 className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface dark:bg-dash-inverted-hover px-3 py-2 text-sm font-medium text-dash-text2 dark:text-dash-text-muted hover:bg-dash-muted transition"
 >
 <Folder className="h-4 w-4 text-dash-text-muted" />
 <span className="max-w-[160px] truncate">{selectedFolderName}</span>
 <ChevronDown className={`h-4 w-4 text-dash-text-muted transition ${dropdownOpen ? 'rotate-180' : ''}`} />
 </button>

 {dropdownOpen && (
 <>
 <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
 <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-dash-border bg-dash-surface dark:bg-dash-inverted-hover shadow-xl overflow-hidden">
 <button
 onClick={() => handleFolderSelect('all')}
 className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
 selectedFolder === 'all'
 ? 'bg-[var(--im-primary-light)] text-[var(--im-primary)] font-medium'
 : 'text-dash-text2 dark:text-dash-text-muted hover:bg-dash-muted '
 }`}
 >
 <Activity className="h-4 w-4" />
 All Resources
 </button>
 <div className="border-t border-dash-border " />
 {folderStats.map((folder) => (
 <button
 key={folder.folderId}
 onClick={() => handleFolderSelect(folder.folderId)}
 className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
 selectedFolder === folder.folderId
 ? 'bg-[var(--im-primary-light)] text-[var(--im-primary)] font-medium'
 : 'text-dash-text2 dark:text-dash-text-muted hover:bg-dash-muted '
 }`}
 >
 <div className="flex items-center gap-2 min-w-0">
 <Folder className="h-4 w-4 shrink-0" />
 <span className="truncate">{folder.name}</span>
 </div>
 <span className="shrink-0 rounded bg-dash-muted px-1.5 py-0.5 text-[10px] font-medium text-dash-text2 ">
 {folder.role}
 </span>
 </button>
 ))}
 </div>
 </>
 )}
 </div>
 )}
 </div>

 {/* Stat cards */}
 <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
 <StatCard
 icon={Images}
 label="Total Assets"
 value={String(currentStats?.totalAssets ?? 0)}
 color="blue"
 />
 <StatCard
 icon={HardDrive}
 label="Storage Used"
 value={formatStorageSize(currentStats?.totalSizeBytes ?? 0)}
 color="emerald"
 />
 <StatCard
 icon={Users}
 label="Active Shares"
 value={String(currentStats?.totalShares ?? 0)}
 color="violet"
 />
 <StatCard
 icon={Sparkles}
 label="AI Jobs"
 value={String(currentStats?.aiJobsRun ?? 0)}
 color="amber"
 />
 </div>

 {/* Folder cards */}
 {folderStats.length > 0 && (
 <div>
 <h2 className="mb-3 text-sm font-semibold text-dash-text dark:text-dash-inverted-text">
 Managed Folders
 </h2>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
 {folderStats.map((folder) => (
 <button
 key={folder.folderId}
 onClick={() => onNavigateToFolder?.(folder.folderId)}
 className="group flex items-center gap-3 rounded-xl border border-dash-border bg-dash-surface dark:bg-dash-inverted-hover/50 p-4 text-left transition hover:border-[var(--im-primary)]/50 hover:shadow-md"
 >
 <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--im-primary-light)]">
 <Folder className="h-5 w-5 text-[var(--im-primary)]" />
 </div>
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm font-medium text-dash-text dark:text-dash-inverted-text group-hover:text-[var(--im-primary)]">
 {folder.name}
 </p>
 <div className="mt-0.5 flex items-center gap-2 text-xs text-dash-text2">
 <span>{folder.assetCount} assets</span>
 <span className="rounded bg-dash-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
 {folder.role}
 </span>
 </div>
 </div>
 <Eye className="h-4 w-4 shrink-0 text-dash-text-muted group-hover:text-[var(--im-primary)]" />
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Empty state */}
 {folderStats.length === 0 && (
 <div className="flex flex-col items-center justify-center py-16 text-center">
 <Folder className="h-12 w-12 text-dash-text-muted mb-3" />
 <h3 className="text-sm font-medium text-dash-text dark:text-dash-inverted-text">
 No folders assigned
 </h3>
 <p className="mt-1 max-w-sm text-xs text-dash-text2">
 Your admin has not assigned any folder access rules to your account yet.
 </p>
 </div>
 )}
 </div>
 );
}

/* ─── StatCard ──────────────────────────────────────────────── */

const colorMap: Record<string, string> = {
 blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
 emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
 violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
 amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
};

function StatCard({
 icon: Icon,
 label,
 value,
 color,
}: {
 icon: typeof Images;
 label: string;
 value: string;
 color: string;
}) {
 return (
 <div className="rounded-xl border border-dash-border bg-dash-surface dark:bg-dash-inverted-hover/50 p-4">
 <div className="flex items-center justify-between">
 <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colorMap[color] ?? colorMap.blue}`}>
 <Icon className="h-4 w-4" />
 </div>
 </div>
 <p className="mt-3 text-2xl font-bold text-dash-text dark:text-dash-inverted-text">{value}</p>
 <p className="mt-0.5 text-xs text-dash-text2">{label}</p>
 </div>
 );
}
