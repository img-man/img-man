// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * Central org-wide Asset Access analytics panel.
 *
 * Shown on /dashboard/analytics. Lets owners/admins enable the feature
 * (writes to `Organization.analyticsConfig.enabled`) and renders the
 * precomputed `OrgAnalytics` document. Reads only — never recomputes.
 */

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Eye, Globe2, Loader2 } from 'lucide-react';

interface Bucket {
  key: string;
  startDate: string;
  endDate: string;
  views: number;
  failures: number;
  bytesServed: number;
  byCountry: Record<string, number>;
  byReferer: Record<string, number>;
  byStatus: Record<string, number>;
  byTransform: Record<string, number>;
}

interface AccessResponse {
  enabled: boolean;
  totals?: {
    views: number;
    failures: number;
    bytesServed: number;
    lastAccessedAt: string | null;
    lastFailureAt: string | null;
  };
  byCountry?: Record<string, number>;
  byReferer?: Record<string, number>;
  byStatus?: Record<string, number>;
  byTransform?: Record<string, number>;
  weekly?: Bucket[];
  monthly?: Bucket[];
  topAssets?: Array<{
    assetId: string;
    views: number;
    failures: number;
    lastAccessedAt: string | null;
    name?: string | null;
    mimeType?: string | null;
    thumbnailBase64?: string | null;
  }>;
  rawCount?: number;
  updatedAt?: string;
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(b: number) {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${u[i]}`;
}

function topEntries(map: Record<string, number> | undefined, n = 5) {
  return Object.entries(map ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

export function AssetAccessSection() {
  const [data, setData] = useState<AccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/access?topAssetsHydrate=1');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      setToggling(true);
      try {
        const res = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analyticsConfig: { enabled } }),
        });
        if (res.ok) await fetchData();
      } finally {
        setToggling(false);
      }
    },
    [fetchData],
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-dash-border bg-dash-surface p-5">
        <div className="flex items-center gap-2 text-sm text-dash-text2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading access analytics…
        </div>
      </div>
    );
  }

  if (!data?.enabled) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
            <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-dash-text">
              Asset Access Analytics
            </h3>
            <p className="mt-1 text-xs text-dash-text2">
              Track per-asset views, failures, location and referer for every
              <code className="mx-1 rounded bg-dash-muted px-1 py-0.5 text-[10px]">/i/&lt;id&gt;</code>
              hit. Summaries are precomputed so dashboard reads stay fast.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Enabling this adds an extra database write per public asset
                access. On high-traffic accounts this <strong>may slow
                down</strong> asset rendering. You can disable it at any time.
              </span>
            </div>
            <button
              onClick={() => void setEnabled(true)}
              disabled={toggling}
              className="mt-3 rounded-lg bg-[var(--im-primary)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {toggling ? 'Enabling…' : 'Enable Asset Access Analytics'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totals = data.totals ?? {
    views: 0,
    failures: 0,
    bytesServed: 0,
    lastAccessedAt: null,
    lastFailureAt: null,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-dash-text-muted" />
          <h2 className="text-lg font-semibold text-dash-text">Asset Access</h2>
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            tracking
          </span>
        </div>
        <button
          onClick={() => void setEnabled(false)}
          disabled={toggling}
          className="rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-xs text-dash-text2 hover:bg-dash-surface-hover disabled:opacity-50"
        >
          Disable
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total views" value={formatNumber(totals.views)} />
        <Stat
          label="Failures"
          value={formatNumber(totals.failures)}
          tone={totals.failures > 0 ? 'red' : 'default'}
        />
        <Stat label="Bytes served" value={formatBytes(totals.bytesServed)} />
        <Stat
          label="Last access"
          value={
            totals.lastAccessedAt
              ? new Date(totals.lastAccessedAt).toLocaleString()
              : '—'
          }
        />
      </div>

      {/* Top assets / countries / referers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Top assets" icon={Eye}>
          {(data.topAssets ?? []).length === 0 ? (
            <Empty>No tracked accesses yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {(data.topAssets ?? []).slice(0, 8).map((a) => (
                <li key={a.assetId} className="flex items-center gap-2">
                  <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-dash-muted">
                    {a.thumbnailBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnailBase64}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-dash-text">
                      {a.name ?? a.assetId.slice(-8)}
                    </p>
                    <p className="text-[10px] text-dash-text-muted">
                      {a.views} views · {a.failures} failures
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Top countries" icon={Globe2}>
          <KeyValueBars entries={topEntries(data.byCountry, 8)} />
        </Panel>

        <Panel title="Top referers" icon={Activity}>
          <KeyValueBars entries={topEntries(data.byReferer, 8)} />
        </Panel>
      </div>

      {/* Weekly + Monthly */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Last 5 weeks" icon={Activity}>
          <BucketTable buckets={data.weekly ?? []} />
        </Panel>
        <Panel title="Monthly history" icon={Activity}>
          <BucketTable buckets={data.monthly ?? []} />
        </Panel>
      </div>

      {data.updatedAt && (
        <p className="text-[11px] text-dash-text-muted">
          Last updated {new Date(data.updatedAt).toLocaleString()} · {data.rawCount ?? 0} raw records retained
        </p>
      )}
    </div>
  );
}

/* ─── Helpers ───────────────────────────────────────────────── */

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'red';
}) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
      <p className="text-[11px] font-medium text-dash-text2">{label}</p>
      <p
        className={`mt-1 text-lg font-bold tracking-tight ${
          tone === 'red'
            ? 'text-red-600 dark:text-red-400'
            : 'text-dash-text'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-dash-text2 dark:text-dash-text-muted">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-2 text-center text-[11px] text-dash-text-muted">
      {children}
    </p>
  );
}

function KeyValueBars({ entries }: { entries: [string, number][] }) {
  if (entries.length === 0) return <Empty>No data yet.</Empty>;
  const max = Math.max(...entries.map(([, v]) => v));
  return (
    <ul className="space-y-1.5">
      {entries.map(([k, v]) => (
        <li key={k}>
          <div className="flex items-center justify-between text-[11px]">
            <span className="truncate text-dash-text2">{k}</span>
            <span className="text-dash-text-muted">{v}</span>
          </div>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-dash-muted">
            <div
              className="h-full rounded-full bg-[var(--im-primary)]"
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function BucketTable({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return <Empty>No buckets yet.</Empty>;
  return (
    <table className="w-full text-[11px]">
      <thead className="text-dash-text-muted">
        <tr>
          <th className="px-1 py-1 text-left font-medium">Period</th>
          <th className="px-1 py-1 text-right font-medium">Views</th>
          <th className="px-1 py-1 text-right font-medium">Failures</th>
          <th className="px-1 py-1 text-right font-medium">Bytes</th>
        </tr>
      </thead>
      <tbody className="text-dash-text2">
        {buckets.map((b) => (
          <tr key={b.key} className="border-t border-dash-border">
            <td className="px-1 py-1">{b.key}</td>
            <td className="px-1 py-1 text-right">{b.views}</td>
            <td className="px-1 py-1 text-right">{b.failures}</td>
            <td className="px-1 py-1 text-right">{formatBytes(b.bytesServed)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
