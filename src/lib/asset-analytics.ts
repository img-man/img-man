// SPDX-License-Identifier: Apache-2.0
/**
 * Asset Analytics — recording, encoding and rollup helpers.
 *
 * Design goals
 * ────────────
 *  1. **Single document per entity** — `AssetAnalytics` keys on `assetId`,
 *     `OrgAnalytics` keys on `orgId`. Always upsert, never insert duplicates.
 *  2. **Never block the response** — `recordAssetAccess()` is fire-and-forget;
 *     callers may `void recordAssetAccess(...)` from request handlers.
 *  3. **Storage-efficient raw section** — each per-view record is JSON-then-
 *     base64 encoded into a tiny `{ createdAt, b }` shape, capped per asset.
 *  4. **Decoded summaries** — opportunistically rotate the rolling weekly
 *     buckets (keep latest 4–5) and, once a month boundary is crossed,
 *     consolidate the older weekly buckets into a permanent `monthly` entry.
 *
 * No external scheduler is required: rollups happen inline on writes (cheap
 * branch when nothing to do) so the system is self-healing in serverless.
 */

import mongoose, { type Types } from 'mongoose';
import { connectToDatabase } from '@/lib/db';
import {
  AssetAnalytics,
  OrgAnalytics,
  Organization,
  type IAnalyticsBucket,
  type IAnalyticsRawRecord,
} from '@/models';

/* ────────────────────────────────────────────────────────────────
 * Public types
 * ──────────────────────────────────────────────────────────────── */

export interface AssetAccessRecord {
  /** HTTP status returned to the client (200, 304, 404, 500…). */
  status: number;
  /** Whether the access counts as a failure (>=400 by default). */
  failed?: boolean;
  /** Bytes served back to the client (best-effort). */
  bytesServed?: number;
  /** ISO country code resolved from the request (geo header or IP DB). */
  country?: string | null;
  /** City, when available (geo header). */
  city?: string | null;
  /** Region/state, when available. */
  region?: string | null;
  /** Trimmed referer host. */
  referer?: string | null;
  /** Truncated User-Agent string. */
  userAgent?: string | null;
  /** Stable hash of the source IP — used for cheap unique-viewer estimation. */
  ipHash?: string | null;
  /** Compact transform descriptor, e.g. `w=200,fit=cover`. */
  transformKey?: string | null;
  /** Server-side latency in milliseconds. */
  latencyMs?: number;
}

export interface DecodedRawRecord extends AssetAccessRecord {
  createdAt: Date;
}

/* ────────────────────────────────────────────────────────────────
 * Encoding helpers — keep raw section tiny.
 * ──────────────────────────────────────────────────────────────── */

/**
 * Encode a single access record to a compact base64 JSON blob with single-
 * letter keys to minimise storage. Pair with `decodeRawRecord`.
 */
export function encodeRawRecord(record: AssetAccessRecord): string {
  const compact: Record<string, unknown> = {
    s: record.status,
    f: record.failed ? 1 : 0,
  };
  if (record.bytesServed != null) compact.b = record.bytesServed;
  if (record.country) compact.co = record.country;
  if (record.city) compact.ci = record.city;
  if (record.region) compact.re = record.region;
  if (record.referer) compact.r = record.referer;
  if (record.userAgent) compact.u = record.userAgent;
  if (record.ipHash) compact.i = record.ipHash;
  if (record.transformKey) compact.t = record.transformKey;
  if (record.latencyMs != null) compact.l = record.latencyMs;
  return Buffer.from(JSON.stringify(compact), 'utf8').toString('base64');
}

export function decodeRawRecord(entry: IAnalyticsRawRecord): DecodedRawRecord {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(Buffer.from(entry.b, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    // Corrupt entry — return a minimal record so callers don't crash.
  }

  return {
    createdAt: entry.createdAt,
    status: typeof parsed.s === 'number' ? parsed.s : 0,
    failed: parsed.f === 1,
    bytesServed: typeof parsed.b === 'number' ? parsed.b : undefined,
    country: typeof parsed.co === 'string' ? parsed.co : null,
    city: typeof parsed.ci === 'string' ? parsed.ci : null,
    region: typeof parsed.re === 'string' ? parsed.re : null,
    referer: typeof parsed.r === 'string' ? parsed.r : null,
    userAgent: typeof parsed.u === 'string' ? parsed.u : null,
    ipHash: typeof parsed.i === 'string' ? parsed.i : null,
    transformKey: typeof parsed.t === 'string' ? parsed.t : null,
    latencyMs: typeof parsed.l === 'number' ? parsed.l : undefined,
  };
}

/* ────────────────────────────────────────────────────────────────
 * Time helpers
 * ──────────────────────────────────────────────────────────────── */

/** ISO-week number (1–53) per ISO-8601 (Mon-start). */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function weekKey(date: Date): string {
  const { year, week } = isoWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Start of ISO week (Monday 00:00 UTC) containing `date`. */
export function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (dayNum - 1));
  return d;
}

export function endOfIsoWeek(date: Date): Date {
  const start = startOfIsoWeek(date);
  return new Date(start.getTime() + 7 * 86400000 - 1);
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - 1);
}

/* ────────────────────────────────────────────────────────────────
 * Bucket helpers
 * ──────────────────────────────────────────────────────────────── */

const MAX_WEEKLY_BUCKETS = 5;

function emptyBucket(key: string, start: Date, end: Date): IAnalyticsBucket {
  return {
    key,
    startDate: start,
    endDate: end,
    views: 0,
    failures: 0,
    bytesServed: 0,
    uniqueViewers: 0,
    byCountry: {},
    byReferer: {},
    byStatus: {},
    byTransform: {},
  };
}

function bumpKey(map: Record<string, number>, key: string | null | undefined, by: number) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + by;
}

function addRecordToBucket(bucket: IAnalyticsBucket, record: AssetAccessRecord) {
  bucket.views += 1;
  if (record.failed) bucket.failures += 1;
  bucket.bytesServed += record.bytesServed ?? 0;
  bumpKey(bucket.byCountry, record.country, 1);
  bumpKey(bucket.byReferer, record.referer, 1);
  bumpKey(bucket.byStatus, String(record.status), 1);
  bumpKey(bucket.byTransform, record.transformKey ?? 'original', 1);
}

/**
 * Apply rolling-window rollups to a doc's `weekly` and `monthly` arrays.
 * - Adds the new record into the current week bucket (creates one if needed).
 * - When more than `MAX_WEEKLY_BUCKETS` weekly buckets exist, the oldest
 *   weekly buckets are folded into the matching `monthly` entry.
 * Mutates the supplied `weekly` / `monthly` arrays in place.
 */
export function rollupBuckets(args: {
  weekly: IAnalyticsBucket[];
  monthly: IAnalyticsBucket[];
  record: AssetAccessRecord;
  now: Date;
}): void {
  const { weekly, monthly, record, now } = args;

  const wKey = weekKey(now);
  let current = weekly.find((b) => b.key === wKey);
  if (!current) {
    current = emptyBucket(wKey, startOfIsoWeek(now), endOfIsoWeek(now));
    weekly.push(current);
    weekly.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }
  addRecordToBucket(current, record);

  // Roll any weekly buckets older than the cap into their month summary.
  while (weekly.length > MAX_WEEKLY_BUCKETS) {
    const oldest = weekly.shift()!;
    foldBucketIntoMonthly(monthly, oldest);
  }
}

function foldBucketIntoMonthly(monthly: IAnalyticsBucket[], src: IAnalyticsBucket) {
  const mKey = monthKey(src.startDate);
  let target = monthly.find((b) => b.key === mKey);
  if (!target) {
    target = emptyBucket(mKey, startOfMonth(src.startDate), endOfMonth(src.startDate));
    monthly.push(target);
    monthly.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }
  target.views += src.views;
  target.failures += src.failures;
  target.bytesServed += src.bytesServed;
  target.uniqueViewers += src.uniqueViewers;
  for (const [k, v] of Object.entries(src.byCountry)) bumpKey(target.byCountry, k, v);
  for (const [k, v] of Object.entries(src.byReferer)) bumpKey(target.byReferer, k, v);
  for (const [k, v] of Object.entries(src.byStatus)) bumpKey(target.byStatus, k, v);
  for (const [k, v] of Object.entries(src.byTransform)) bumpKey(target.byTransform, k, v);
}

/* ────────────────────────────────────────────────────────────────
 * Enabled-flag cache (avoid Org lookup on every /i/:id hit).
 * ──────────────────────────────────────────────────────────────── */

interface CachedFlag {
  value: boolean;
  retentionDays: number;
  maxRaw: number;
  expiresAt: number;
}

const ANALYTICS_FLAG_TTL_MS = 60_000;
const flagCache = new Map<string, CachedFlag>();

export function _resetAnalyticsFlagCache() {
  flagCache.clear();
}

async function getAnalyticsConfig(orgId: string): Promise<CachedFlag> {
  const cached = flagCache.get(orgId);
  if (cached && cached.expiresAt > Date.now()) return cached;

  await connectToDatabase();
  const org = await Organization.findById(orgId).select('analyticsConfig').lean();
  const cfg = (org as { analyticsConfig?: { enabled?: boolean; rawRetentionDays?: number; maxRawRecordsPerAsset?: number } } | null)?.analyticsConfig;

  const entry: CachedFlag = {
    value: cfg?.enabled === true,
    retentionDays: cfg?.rawRetentionDays ?? 35,
    maxRaw: cfg?.maxRawRecordsPerAsset ?? 500,
    expiresAt: Date.now() + ANALYTICS_FLAG_TTL_MS,
  };
  flagCache.set(orgId, entry);
  return entry;
}

export async function isAnalyticsEnabled(orgId: string): Promise<boolean> {
  return (await getAnalyticsConfig(orgId)).value;
}

/* ────────────────────────────────────────────────────────────────
 * Public recorder — fire and forget.
 * ──────────────────────────────────────────────────────────────── */

export interface RecordAssetAccessInput {
  assetId: string | Types.ObjectId;
  orgId: string | Types.ObjectId;
  record: AssetAccessRecord;
}

/**
 * Record a single asset access. Fully isolated: all errors are swallowed and
 * logged so a logging failure can never break the user-facing response.
 *
 * Caller convention:
 *   void recordAssetAccess({ ... });
 */
export async function recordAssetAccess(input: RecordAssetAccessInput): Promise<void> {
  try {
    const orgIdStr = String(input.orgId);
    const cfg = await getAnalyticsConfig(orgIdStr);
    if (!cfg.value) return;

    const assetObjectId = new mongoose.Types.ObjectId(String(input.assetId));
    const orgObjectId = new mongoose.Types.ObjectId(orgIdStr);
    const now = new Date();
    const failed = input.record.failed ?? input.record.status >= 400;
    const normalized: AssetAccessRecord = { ...input.record, failed };

    await applyRecordToAssetDoc({
      assetId: assetObjectId,
      orgId: orgObjectId,
      record: normalized,
      now,
      maxRaw: cfg.maxRaw,
      retentionDays: cfg.retentionDays,
    });

    await applyRecordToOrgDoc({
      assetId: assetObjectId,
      orgId: orgObjectId,
      record: normalized,
      now,
      maxRaw: cfg.maxRaw,
      retentionDays: cfg.retentionDays,
    });
  } catch (err) {
    // Never throw out of the recorder.
    console.warn('[analytics] recordAssetAccess failed:', err);
  }
}

/* ────────────────────────────────────────────────────────────────
 * Internal: per-asset write
 * ──────────────────────────────────────────────────────────────── */

async function applyRecordToAssetDoc(args: {
  assetId: Types.ObjectId;
  orgId: Types.ObjectId;
  record: AssetAccessRecord;
  now: Date;
  maxRaw: number;
  retentionDays: number;
}) {
  const { assetId, orgId, record, now, maxRaw, retentionDays } = args;
  await connectToDatabase();

  const doc = await AssetAnalytics.findOneAndUpdate(
    { assetId },
    { $setOnInsert: { assetId, orgId, schemaVersion: 1 } },
    { new: true, upsert: true },
  );
  if (!doc) return;

  // Totals
  doc.totals.views = (doc.totals.views ?? 0) + 1;
  if (record.failed) {
    doc.totals.failures = (doc.totals.failures ?? 0) + 1;
    doc.totals.lastFailureAt = now;
  }
  doc.totals.bytesServed = (doc.totals.bytesServed ?? 0) + (record.bytesServed ?? 0);
  doc.totals.lastAccessedAt = now;

  // Plain aggregates (lifetime).
  bumpKey(doc.byCountry as Record<string, number>, record.country, 1);
  bumpKey(doc.byReferer as Record<string, number>, record.referer, 1);
  bumpKey(doc.byStatus as Record<string, number>, String(record.status), 1);
  bumpKey(doc.byTransform as Record<string, number>, record.transformKey ?? 'original', 1);

  // Raw — capped + retention pruned.
  doc.raw.push({ createdAt: now, b: encodeRawRecord(record) });
  pruneRaw(doc.raw, maxRaw, retentionDays, now);

  // Rollups.
  rollupBuckets({ weekly: doc.weekly, monthly: doc.monthly, record, now });

  doc.markModified('byCountry');
  doc.markModified('byReferer');
  doc.markModified('byStatus');
  doc.markModified('byTransform');
  doc.markModified('weekly');
  doc.markModified('monthly');
  await doc.save();
}

/* ────────────────────────────────────────────────────────────────
 * Internal: per-org write
 * ──────────────────────────────────────────────────────────────── */

async function applyRecordToOrgDoc(args: {
  assetId: Types.ObjectId;
  orgId: Types.ObjectId;
  record: AssetAccessRecord;
  now: Date;
  maxRaw: number;
  retentionDays: number;
}) {
  const { assetId, orgId, record, now, maxRaw, retentionDays } = args;
  await connectToDatabase();

  const doc = await OrgAnalytics.findOneAndUpdate(
    { orgId },
    { $setOnInsert: { orgId, schemaVersion: 1 } },
    { new: true, upsert: true },
  );
  if (!doc) return;

  doc.totals.views = (doc.totals.views ?? 0) + 1;
  if (record.failed) {
    doc.totals.failures = (doc.totals.failures ?? 0) + 1;
    doc.totals.lastFailureAt = now;
  }
  doc.totals.bytesServed = (doc.totals.bytesServed ?? 0) + (record.bytesServed ?? 0);
  doc.totals.lastAccessedAt = now;

  bumpKey(doc.byCountry as Record<string, number>, record.country, 1);
  bumpKey(doc.byReferer as Record<string, number>, record.referer, 1);
  bumpKey(doc.byStatus as Record<string, number>, String(record.status), 1);
  bumpKey(doc.byTransform as Record<string, number>, record.transformKey ?? 'original', 1);

  // Top assets — keep at most 50, sorted desc by views.
  const top = doc.topAssets ?? [];
  let entry = top.find((t) => String(t.assetId) === String(assetId));
  if (!entry) {
    entry = { assetId, views: 0, failures: 0, lastAccessedAt: null };
    top.push(entry);
  }
  entry.views += 1;
  if (record.failed) entry.failures += 1;
  entry.lastAccessedAt = now;
  top.sort((a, b) => b.views - a.views);
  doc.topAssets = top.slice(0, 50);

  doc.raw.push({ createdAt: now, b: encodeRawRecord(record) });
  pruneRaw(doc.raw, Math.max(maxRaw, 1000), retentionDays, now);

  rollupBuckets({ weekly: doc.weekly, monthly: doc.monthly, record, now });

  doc.markModified('byCountry');
  doc.markModified('byReferer');
  doc.markModified('byStatus');
  doc.markModified('byTransform');
  doc.markModified('weekly');
  doc.markModified('monthly');
  doc.markModified('topAssets');
  await doc.save();
}

/* ────────────────────────────────────────────────────────────────
 * Raw-array housekeeping
 * ──────────────────────────────────────────────────────────────── */

export function pruneRaw(
  raw: IAnalyticsRawRecord[],
  maxRecords: number,
  retentionDays: number,
  now: Date,
): void {
  const cutoff = now.getTime() - retentionDays * 86400000;

  // Drop expired-by-time entries (assumes raw is roughly chronological).
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    if (raw[i].createdAt.getTime() < cutoff) raw.splice(i, 1);
  }

  // Cap by count — keep most recent.
  if (raw.length > maxRecords) {
    raw.splice(0, raw.length - maxRecords);
  }
}

/* ────────────────────────────────────────────────────────────────
 * Request → AssetAccessRecord helpers (used by handlers)
 * ──────────────────────────────────────────────────────────────── */

import { createHash } from 'node:crypto';

export function buildTransformKey(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const k of Object.keys(params).sort()) {
    const v = params[k];
    if (v === null || v === undefined || v === '' || v === false) continue;
    parts.push(`${k}=${v}`);
  }
  return parts.length ? parts.join(',') : 'original';
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`imageman::${ip}`).digest('base64').slice(0, 16);
}

export function trimReferer(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).host || null;
  } catch {
    return referer.slice(0, 80);
  }
}
