// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Images,
  HardDrive,
  FolderOpen,
  Palette,
  Bot,
  ScanFace,
  Sparkles,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  FileImage,
  Clock,
  Activity,
  Trash2,
  Users,
} from 'lucide-react';
import { AssetAccessSection } from '@/components/dashboard/asset-access-section';

/* ─── Types ────────────────────────────────────────────── */

interface AnalyticsData {
  overview: {
    totalAssets: number;
    totalStorageBytes: number;
    totalFolders: number;
    totalDesigns: number;
    assetsWithAiTags: number;
    assetsWithFaces: number;
    assetsWithThumbnails: number;
    trashCount: number;
    memberCount: number;
  };
  mimeBreakdown: { mimeType: string; count: number }[];
  aiUsage: Record<
    string,
    { completed: number; failed: number; pending: number; total: number }
  >;
  aiTimeline: { date: string; type: string; count: number }[];
  recentUploads: {
    _id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    thumbnailBase64: string | null;
  }[];
  storageGrowth: { date: string; bytes: number; count: number }[];
}

/* ─── Helpers ──────────────────────────────────────────── */

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AI_TYPE_LABELS: Record<
  string,
  { label: string; icon: typeof Bot; color: string }
> = {
  auto_tag: {
    label: 'Auto Tag',
    icon: Bot,
    color:
      'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/20',
  },
  face_detect: {
    label: 'Face Detect',
    icon: ScanFace,
    color:
      'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  },
  bg_remove: {
    label: 'BG Remove',
    icon: Sparkles,
    color:
      'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  },
  upscale: {
    label: 'Upscale',
    icon: TrendingUp,
    color:
      'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  },
  expand: {
    label: 'Expand',
    icon: Sparkles,
    color:
      'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-500/10 border-pink-200 dark:border-pink-500/20',
  },
  generate: {
    label: 'Generate',
    icon: Sparkles,
    color:
      'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20',
  },
};

const MIME_COLORS: Record<string, string> = {
  'image/png': 'bg-blue-500',
  'image/jpeg': 'bg-amber-500',
  'image/webp': 'bg-emerald-500',
  'image/gif': 'bg-pink-500',
  'image/svg+xml': 'bg-violet-500',
};

/* ─── Component ────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  /* ─── Loading State ──────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-dash-text-muted dark:text-dash-text2" />
          <p className="text-sm text-dash-text2">Loading analytics…</p>
        </div>
      </div>
    );
  }

  /* ─── Error State ────────────────────────────────────── */
  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 dark:text-red-500" />
          <p className="text-sm text-dash-text2 dark:text-dash-text-muted">
            {error ?? 'Unknown error'}
          </p>
          <button
            onClick={fetchAnalytics}
            className="mt-2 rounded-lg bg-dash-inverted dark:bg-dash-muted px-4 py-2 text-xs font-medium text-white transition hover:bg-dash-inverted-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { overview, mimeBreakdown, aiUsage, recentUploads, storageGrowth } =
    data;

  const totalAiJobs = Object.values(aiUsage).reduce((s, v) => s + v.total, 0);
  const totalAiCompleted = Object.values(aiUsage).reduce(
    (s, v) => s + v.completed,
    0,
  );
  const totalAiFailed = Object.values(aiUsage).reduce(
    (s, v) => s + v.failed,
    0,
  );

  // Storage bar max
  const totalMimeAssets = mimeBreakdown.reduce((s, m) => s + m.count, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-dash-text">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-dash-text2">
            Overview of your assets, storage, bandwidth, and AI usage.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-xs font-medium text-dash-text2 transition hover:bg-dash-surface-hover"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* ─── Overview Cards ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          icon={Images}
          label="Total Assets"
          value={formatNumber(overview.totalAssets)}
          sub={`${overview.assetsWithThumbnails} with thumbnails`}
          color="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={HardDrive}
          label="Total Storage"
          value={formatBytes(overview.totalStorageBytes)}
          sub={`${overview.totalAssets} files`}
          color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={FolderOpen}
          label="Folders"
          value={formatNumber(overview.totalFolders)}
          sub="organized"
          color="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
        <StatCard
          icon={Palette}
          label="Designs"
          value={formatNumber(overview.totalDesigns)}
          sub="created in studio"
          color="bg-[var(--im-primary-light)] dark:bg-[var(--im-primary)]/10 text-[var(--im-primary)] dark:text-[var(--im-primary-light)]"
        />
        <StatCard
          icon={Trash2}
          label="In The Vault"
          value={formatNumber(overview.trashCount ?? 0)}
          sub="awaiting purge"
          color="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
        />
        <StatCard
          icon={Users}
          label="Members"
          value={formatNumber(overview.memberCount ?? 0)}
          sub="active team"
          color="bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
        />
      </div>

      {/* ─── AI Usage Section ────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-dash-text-muted" />
          <h2 className="text-lg font-semibold text-dash-text">AI Usage</h2>
          <span className="rounded-full bg-dash-muted px-2 py-0.5 text-xs font-medium text-dash-text2">
            {totalAiJobs} total jobs
          </span>
        </div>

        {/* AI Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={Bot}
            label="AI Jobs Completed"
            value={formatNumber(totalAiCompleted)}
            sub={
              totalAiFailed > 0 ? `${totalAiFailed} failed` : 'all successful'
            }
            color="bg-[var(--im-primary-light)] dark:bg-[var(--im-primary)]/10 text-[var(--im-primary)] dark:text-[var(--im-primary-light)]"
          />
          <StatCard
            icon={Bot}
            label="Auto-Tags Generated"
            value={formatNumber(overview.assetsWithAiTags)}
            sub={`of ${overview.totalAssets} assets`}
            color="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <StatCard
            icon={ScanFace}
            label="Face Detections"
            value={formatNumber(overview.assetsWithFaces)}
            sub="assets with faces found"
            color="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
        </div>

        {/* AI Breakdown by Type */}
        {Object.keys(aiUsage).length > 0 && (
          <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
            <h3 className="mb-4 text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
              Usage by Type
            </h3>
            <div className="space-y-3">
              {Object.entries(aiUsage).map(([type, stats]) => {
                const meta = AI_TYPE_LABELS[type] ?? {
                  label: type,
                  icon: Sparkles,
                  color:
                    'text-dash-text2 dark:text-dash-text-muted bg-dash-muted border-dash-border',
                };
                const Icon = meta.icon;
                const pct =
                  totalAiJobs > 0 ? (stats.total / totalAiJobs) * 100 : 0;

                return (
                  <div key={type} className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-dash-text">
                          {meta.label}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-dash-text2">
                          <span className="text-green-600 dark:text-green-400">
                            {stats.completed} done
                          </span>
                          {stats.failed > 0 && (
                            <span className="text-red-500 dark:text-red-400">
                              {stats.failed} failed
                            </span>
                          )}
                          {stats.pending > 0 && (
                            <span className="text-amber-500 dark:text-amber-400">
                              {stats.pending} pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-dash-muted">
                        <div
                          className="h-full rounded-full bg-[var(--im-primary)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-dash-text2">
                      {stats.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── Bottom Grid: MIME + Recent + Storage ────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* File Types */}
        <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
            <FileImage className="h-4 w-4 text-dash-text-muted" />
            File Types
          </h3>
          {mimeBreakdown.length === 0 ? (
            <p className="py-4 text-center text-xs text-dash-text-muted">
              No assets uploaded yet
            </p>
          ) : (
            <div className="space-y-2.5">
              {mimeBreakdown.map((m) => {
                const pct =
                  totalMimeAssets > 0 ? (m.count / totalMimeAssets) * 100 : 0;
                const barColor = MIME_COLORS[m.mimeType] ?? 'bg-dash-badge ';
                const ext =
                  m.mimeType.split('/')[1]?.toUpperCase() ?? m.mimeType;

                return (
                  <div key={m.mimeType}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-dash-text2 dark:text-dash-text-muted">
                        {ext}
                      </span>
                      <span className="text-dash-text-muted">
                        {m.count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-dash-muted">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Uploads */}
        <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
            <Clock className="h-4 w-4 text-dash-text-muted" />
            Recent Uploads
          </h3>
          {recentUploads.length === 0 ? (
            <p className="py-4 text-center text-xs text-dash-text-muted">
              No recent uploads
            </p>
          ) : (
            <div className="space-y-3">
              {recentUploads.map((a) => (
                <div key={a._id} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-dash-muted">
                    {a.thumbnailBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnailBase64}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileImage className="h-4 w-4 text-dash-text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-dash-text2 dark:text-dash-text-muted">
                      {a.name}
                    </p>
                    <p className="text-[11px] text-dash-text-muted">
                      {formatBytes(a.sizeBytes)} · {timeAgo(a.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage Growth (last 30 days) */}
        <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-dash-text2 dark:text-dash-text-muted">
            <TrendingUp className="h-4 w-4 text-dash-text-muted" />
            Storage Growth (30d)
          </h3>
          {storageGrowth.length === 0 ? (
            <p className="py-4 text-center text-xs text-dash-text-muted">
              No data yet
            </p>
          ) : (
            <div className="space-y-1.5">
              {(() => {
                const maxBytes = Math.max(...storageGrowth.map((d) => d.bytes));
                return storageGrowth.map((d) => {
                  const pct = maxBytes > 0 ? (d.bytes / maxBytes) * 100 : 0;
                  return (
                    <div key={d.date} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[11px] text-dash-text-muted">
                        {d.date.slice(5)}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-dash-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-14 text-right text-[11px] text-dash-text-muted">
                        {formatBytes(d.bytes)}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* ─── Asset Access Analytics (opt-in) ───────────────────── */}
      <AssetAccessSection />
    </div>
  );
}

/* ─── Stat Card Component ──────────────────────────────── */

interface StatCardProps {
  icon: typeof Images;
  label: string;
  value: string;
  sub: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, sub, color }: StatCardProps) {
  return (
    <div className="group rounded-xl border border-dash-border bg-dash-surface p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-dash-border-hover">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${color}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-dash-text2">{label}</p>
          <p className="text-xl font-bold tracking-tight text-dash-text">
            {value}
          </p>
          <p className="text-[11px] text-dash-text-muted">{sub}</p>
        </div>
      </div>
    </div>
  );
}
