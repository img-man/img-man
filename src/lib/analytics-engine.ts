// SPDX-License-Identifier: Apache-2.0
/**
 * Analytics Dashboard Engine — Sprint 14.3
 *
 * Pure-function aggregation helpers that transform raw log/usage data
 * into chart-ready structures for the analytics dashboard.
 *
 * Responsibilities:
 * - Aggregate bandwidth data into time-series (daily / weekly / monthly)
 * - Break down storage by file type / folder
 * - Summarise AI credit consumption by job type
 * - Rank top-accessed / top-downloaded assets
 * - Compute activity heatmaps (hour × day-of-week)
 * - Calculate growth & trend metrics
 *
 * No database calls — accepts plain objects and returns aggregated results.
 * Server Actions or route handlers feed data in and render the output.
 */

/* ─── Time-Series ────────────────────────────────────────────── */

/** Granularity for time-series aggregation */
export type TimeGranularity = 'daily' | 'weekly' | 'monthly';

/** A single data point in a bandwidth time-series */
export interface BandwidthDataPoint {
  date: string; // ISO date key: "2025-01-15", "2025-W03", or "2025-01"
  uploadBytes: number;
  downloadBytes: number;
  transformBytes: number;
  cdnBytes: number;
  totalBytes: number;
  requestCount: number;
}

/** Raw daily bandwidth record (input shape from BandwidthLog) */
export interface RawBandwidthRecord {
  date: Date | string;
  uploadBytes: number;
  downloadBytes: number;
  transformBytes: number;
  cdnBytes: number;
  totalBytes: number;
  requestCount: number;
}

/** Aggregate daily records into the chosen granularity */
export function aggregateBandwidthTimeSeries(
  records: RawBandwidthRecord[],
  granularity: TimeGranularity = 'daily',
): BandwidthDataPoint[] {
  const buckets = new Map<string, BandwidthDataPoint>();

  for (const r of records) {
    const d = typeof r.date === 'string' ? new Date(r.date) : r.date;
    const key = bucketKey(d, granularity);

    const existing = buckets.get(key);
    if (existing) {
      existing.uploadBytes += r.uploadBytes;
      existing.downloadBytes += r.downloadBytes;
      existing.transformBytes += r.transformBytes;
      existing.cdnBytes += r.cdnBytes;
      existing.totalBytes += r.totalBytes;
      existing.requestCount += r.requestCount;
    } else {
      buckets.set(key, {
        date: key,
        uploadBytes: r.uploadBytes,
        downloadBytes: r.downloadBytes,
        transformBytes: r.transformBytes,
        cdnBytes: r.cdnBytes,
        totalBytes: r.totalBytes,
        requestCount: r.requestCount,
      });
    }
  }

  return Array.from(buckets.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

/** Compute the bucket key for a given date + granularity */
function bucketKey(d: Date, g: TimeGranularity): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');

  switch (g) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'weekly':
      return `${year}-W${String(isoWeek(d)).padStart(2, '0')}`;
    case 'monthly':
      return `${year}-${month}`;
  }
}

/** Calculate ISO week number */
function isoWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/* ─── Storage Breakdown ──────────────────────────────────────── */

/** A single bucket in a storage breakdown */
export interface StorageBucket {
  label: string;
  bytes: number;
  count: number;
  percentage: number; // 0-100
}

/** Raw asset record for storage analysis */
export interface RawAssetRecord {
  fileSize: number;
  fileCategory?: string;
  mimeType?: string;
  folderId?: string;
  folderName?: string;
}

/** Break down total storage by file category */
export function storageByCategory(assets: RawAssetRecord[]): StorageBucket[] {
  const map = new Map<string, { bytes: number; count: number }>();
  let totalBytes = 0;

  for (const a of assets) {
    const cat = a.fileCategory || categorizeMime(a.mimeType || 'unknown');
    const entry = map.get(cat) ?? { bytes: 0, count: 0 };
    entry.bytes += a.fileSize;
    entry.count += 1;
    map.set(cat, entry);
    totalBytes += a.fileSize;
  }

  return Array.from(map.entries())
    .map(([label, { bytes, count }]) => ({
      label,
      bytes,
      count,
      percentage: totalBytes > 0 ? round((bytes / totalBytes) * 100, 2) : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/** Break down total storage by folder */
export function storageByFolder(assets: RawAssetRecord[]): StorageBucket[] {
  const map = new Map<string, { bytes: number; count: number }>();
  let totalBytes = 0;

  for (const a of assets) {
    const folder = a.folderName ?? a.folderId ?? 'Root';
    const entry = map.get(folder) ?? { bytes: 0, count: 0 };
    entry.bytes += a.fileSize;
    entry.count += 1;
    map.set(folder, entry);
    totalBytes += a.fileSize;
  }

  return Array.from(map.entries())
    .map(([label, { bytes, count }]) => ({
      label,
      bytes,
      count,
      percentage: totalBytes > 0 ? round((bytes / totalBytes) * 100, 2) : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

/** Categorise a MIME type into a human-readable category */
function categorizeMime(mime: string): string {
  if (mime.startsWith('image/')) return 'Images';
  if (mime.startsWith('video/')) return 'Videos';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime === 'application/pdf') return 'PDFs';
  if (
    mime.includes('svg') ||
    mime.includes('postscript') ||
    mime.includes('illustrator')
  )
    return 'Vectors';
  if (
    mime.includes('zip') ||
    mime.includes('gzip') ||
    mime.includes('tar') ||
    mime.includes('rar')
  )
    return 'Archives';
  return 'Other';
}

/* ─── AI Credits ─────────────────────────────────────────────── */

/** Raw AI job record for analytics */
export interface RawAiJobRecord {
  type: string;
  creditCost: number;
  status: string;
  createdAt: Date | string;
}

/** AI credit breakdown by job type */
export interface AiCreditBucket {
  jobType: string;
  totalCredits: number;
  jobCount: number;
  successCount: number;
  failureCount: number;
  avgCreditsPerJob: number;
}

/** Aggregate AI credit usage by job type */
export function aiCreditsByJobType(jobs: RawAiJobRecord[]): AiCreditBucket[] {
  const map = new Map<
    string,
    { total: number; count: number; success: number; failure: number }
  >();

  for (const j of jobs) {
    const entry = map.get(j.type) ?? {
      total: 0,
      count: 0,
      success: 0,
      failure: 0,
    };
    entry.total += j.creditCost;
    entry.count += 1;
    if (j.status === 'completed') entry.success += 1;
    if (j.status === 'failed') entry.failure += 1;
    map.set(j.type, entry);
  }

  return Array.from(map.entries())
    .map(([jobType, e]) => ({
      jobType,
      totalCredits: e.total,
      jobCount: e.count,
      successCount: e.success,
      failureCount: e.failure,
      avgCreditsPerJob: e.count > 0 ? round(e.total / e.count, 2) : 0,
    }))
    .sort((a, b) => b.totalCredits - a.totalCredits);
}

/** AI credit time-series (day-level granularity) */
export interface AiCreditTimePoint {
  date: string;
  credits: number;
  jobCount: number;
}

/** Aggregate AI credits into a daily time-series */
export function aiCreditsTimeSeries(jobs: RawAiJobRecord[]): AiCreditTimePoint[] {
  const map = new Map<string, { credits: number; jobCount: number }>();

  for (const j of jobs) {
    const d = typeof j.createdAt === 'string' ? new Date(j.createdAt) : j.createdAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const entry = map.get(key) ?? { credits: 0, jobCount: 0 };
    entry.credits += j.creditCost;
    entry.jobCount += 1;
    map.set(key, entry);
  }

  return Array.from(map.entries())
    .map(([date, e]) => ({ date, credits: e.credits, jobCount: e.jobCount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ─── Top Assets ─────────────────────────────────────────────── */

/** Raw access log for top-asset ranking */
export interface RawAccessRecord {
  assetId: string;
  assetName: string;
  bytes: number;
  accessType: 'view' | 'download' | 'transform' | 'cdn';
  timestamp: Date | string;
}

/** A ranked asset with access stats */
export interface TopAsset {
  assetId: string;
  assetName: string;
  totalBytes: number;
  accessCount: number;
  viewCount: number;
  downloadCount: number;
}

/** Rank assets by total bandwidth consumed */
export function topAssetsByBandwidth(
  records: RawAccessRecord[],
  limit = 10,
): TopAsset[] {
  const map = new Map<
    string,
    {
      name: string;
      bytes: number;
      total: number;
      views: number;
      downloads: number;
    }
  >();

  for (const r of records) {
    const entry = map.get(r.assetId) ?? {
      name: r.assetName,
      bytes: 0,
      total: 0,
      views: 0,
      downloads: 0,
    };
    entry.bytes += r.bytes;
    entry.total += 1;
    if (r.accessType === 'view') entry.views += 1;
    if (r.accessType === 'download') entry.downloads += 1;
    map.set(r.assetId, entry);
  }

  return Array.from(map.entries())
    .map(([assetId, e]) => ({
      assetId,
      assetName: e.name,
      totalBytes: e.bytes,
      accessCount: e.total,
      viewCount: e.views,
      downloadCount: e.downloads,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, limit);
}

/* ─── Activity Heatmap ───────────────────────────────────────── */

/**
 * Activity count per (hour, day-of-week) cell.
 * hours: 0-23 (UTC), days: 0 (Sun) - 6 (Sat)
 */
export interface HeatmapCell {
  hour: number;
  dayOfWeek: number;
  count: number;
}

/** Raw activity timestamp input */
export interface RawActivityTimestamp {
  createdAt: Date | string;
}

/** Build 24×7 activity heatmap from timestamps */
export function buildActivityHeatmap(
  entries: RawActivityTimestamp[],
): HeatmapCell[] {
  // Initialize all 168 cells
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );

  for (const e of entries) {
    const d =
      typeof e.createdAt === 'string' ? new Date(e.createdAt) : e.createdAt;
    grid[d.getUTCDay()][d.getUTCHours()] += 1;
  }

  const cells: HeatmapCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ hour, dayOfWeek: day, count: grid[day][hour] });
    }
  }
  return cells;
}

/** Get the peak activity hour (most events) */
export function peakActivityHour(heatmap: HeatmapCell[]): HeatmapCell | null {
  if (heatmap.length === 0) return null;
  return heatmap.reduce((max, cell) => (cell.count > max.count ? cell : max));
}

/* ─── Growth & Trends ────────────────────────────────────────── */

/** Period-over-period growth comparison */
export interface GrowthMetric {
  label: string;
  current: number;
  previous: number;
  change: number; // absolute
  changePercent: number; // -100 to +∞
  trend: 'up' | 'down' | 'flat';
}

/**
 * Compute growth metric from two period values.
 * @param label Human-readable name (e.g., "Bandwidth", "Uploads")
 * @param current Current period value
 * @param previous Previous period value
 */
export function computeGrowth(
  label: string,
  current: number,
  previous: number,
): GrowthMetric {
  const change = current - previous;
  const changePercent =
    previous > 0 ? round((change / previous) * 100, 2) : current > 0 ? 100 : 0;

  let trend: 'up' | 'down' | 'flat';
  if (Math.abs(changePercent) < 1) trend = 'flat';
  else if (change > 0) trend = 'up';
  else trend = 'down';

  return { label, current, previous, change, changePercent, trend };
}

/** Compute multiple growth metrics at once */
export function computeGrowthBatch(
  metrics: { label: string; current: number; previous: number }[],
): GrowthMetric[] {
  return metrics.map((m) => computeGrowth(m.label, m.current, m.previous));
}

/* ─── Dashboard Summary ──────────────────────────────────────── */

/** Input for a full dashboard summary */
export interface DashboardInput {
  bandwidthRecords: RawBandwidthRecord[];
  assets: RawAssetRecord[];
  aiJobs: RawAiJobRecord[];
  accessRecords: RawAccessRecord[];
  activityTimestamps: RawActivityTimestamp[];
  bandwidthGranularity?: TimeGranularity;
  topAssetsLimit?: number;
}

/** Full dashboard summary output */
export interface DashboardSummary {
  bandwidth: {
    timeSeries: BandwidthDataPoint[];
    totalBytes: number;
    totalRequests: number;
  };
  storage: {
    byCategory: StorageBucket[];
    byFolder: StorageBucket[];
    totalBytes: number;
    totalCount: number;
  };
  aiCredits: {
    byJobType: AiCreditBucket[];
    timeSeries: AiCreditTimePoint[];
    totalCredits: number;
    totalJobs: number;
  };
  topAssets: TopAsset[];
  activityHeatmap: HeatmapCell[];
  peakHour: HeatmapCell | null;
}

/** Build a complete dashboard summary from raw data */
export function buildDashboardSummary(input: DashboardInput): DashboardSummary {
  const bwTimeSeries = aggregateBandwidthTimeSeries(
    input.bandwidthRecords,
    input.bandwidthGranularity ?? 'daily',
  );

  const bwTotals = bwTimeSeries.reduce(
    (acc, p) => ({
      bytes: acc.bytes + p.totalBytes,
      requests: acc.requests + p.requestCount,
    }),
    { bytes: 0, requests: 0 },
  );

  const byCategory = storageByCategory(input.assets);
  const byFolder = storageByFolder(input.assets);
  const storageTotals = input.assets.reduce(
    (acc, a) => ({ bytes: acc.bytes + a.fileSize, count: acc.count + 1 }),
    { bytes: 0, count: 0 },
  );

  const byJobType = aiCreditsByJobType(input.aiJobs);
  const aiTimeSeries = aiCreditsTimeSeries(input.aiJobs);
  const aiTotals = byJobType.reduce(
    (acc, b) => ({
      credits: acc.credits + b.totalCredits,
      jobs: acc.jobs + b.jobCount,
    }),
    { credits: 0, jobs: 0 },
  );

  const topAssets = topAssetsByBandwidth(
    input.accessRecords,
    input.topAssetsLimit ?? 10,
  );

  const heatmap = buildActivityHeatmap(input.activityTimestamps);

  return {
    bandwidth: {
      timeSeries: bwTimeSeries,
      totalBytes: bwTotals.bytes,
      totalRequests: bwTotals.requests,
    },
    storage: {
      byCategory,
      byFolder,
      totalBytes: storageTotals.bytes,
      totalCount: storageTotals.count,
    },
    aiCredits: {
      byJobType,
      timeSeries: aiTimeSeries,
      totalCredits: aiTotals.credits,
      totalJobs: aiTotals.jobs,
    },
    topAssets,
    activityHeatmap: heatmap,
    peakHour: peakActivityHour(heatmap),
  };
}

/* ─── Date Range Helpers ─────────────────────────────────────── */

/** Preset date range options */
export type DateRangePreset = '7d' | '30d' | '90d' | '365d' | 'custom';

/** Resolve a preset to a { start, end } date range (UTC) */
export function resolveDateRange(
  preset: DateRangePreset,
  customStart?: Date,
  customEnd?: Date,
): { start: Date; end: Date } {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);

  if (preset === 'custom') {
    return {
      start: customStart ?? new Date(end.getTime() - 30 * 86_400_000),
      end: customEnd ?? end,
    };
  }

  const daysMap: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '365d': 365,
  };

  const days = daysMap[preset] ?? 30;
  const start = new Date(end.getTime() - days * 86_400_000);
  start.setUTCHours(0, 0, 0, 0);

  return { start, end };
}

/** Filter records within a date range */
export function filterByDateRange<T extends { date: Date | string }>(
  records: T[],
  start: Date,
  end: Date,
): T[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return records.filter((r) => {
    const t = typeof r.date === 'string' ? new Date(r.date).getTime() : r.date.getTime();
    return t >= startMs && t <= endMs;
  });
}

/* ─── Utility ────────────────────────────────────────────────── */

/** Round to N decimal places */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Format bytes into human-readable string */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(decimals)} ${sizes[i]}`;
}

/** Format a large number with K/M/B suffixes */
export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Day-of-week labels (Sunday-first) */
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Trend arrow / colour mapping for dashboard cards */
export const TREND_CONFIG = {
  up: { arrow: '↑', color: 'text-green-500', bgColor: 'bg-green-50' },
  down: { arrow: '↓', color: 'text-red-500', bgColor: 'bg-red-50' },
  flat: { arrow: '→', color: 'text-gray-500', bgColor: 'bg-gray-50' },
} as const;
