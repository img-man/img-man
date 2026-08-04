// SPDX-License-Identifier: Apache-2.0
/**
 * Transform Cache Layer
 *
 * Manages derived (transformed) image caching in GCS + MongoDB.
 * - Cache key = SHA-256 hash of (orgId + storageKey + transformString)
 * - Derived images stored in GCS under `derived/` prefix
 * - MongoDB DerivedAsset tracks metadata + LRU access times
 */

import crypto from 'crypto';
import { DerivedAsset } from '@/models/index';
import { getGcsBucket } from '@/lib/storage';
import type { NegotiatedFormat } from './processor';

/* ─── Cache Key Generation ───────────────────────────────────── */

/**
 * Generate a deterministic cache key for a transformed image.
 */
export function generateCacheKey(
 orgId: string,
 storageKey: string,
 transformString: string,
): string {
 const input = `${orgId}:${storageKey}:${transformString}`;
 return crypto.createHash('sha256').update(input).digest('hex').slice(0, 40);
}

/**
 * Get the GCS storage path for a derived asset.
 */
export function derivedStoragePath(cacheKey: string, format: NegotiatedFormat): string {
 // Partition into 2-char prefix directories for filesystem friendliness
 const prefix = cacheKey.slice(0, 2);
 return `derived/${prefix}/${cacheKey}.${format}`;
}

/* ─── Cache Lookup ───────────────────────────────────────────── */

export interface CacheHit {
 storagePath: string;
 format: string;
 width: number;
 height: number;
 sizeBytes: number;
}

/**
 * Look up a cached derived asset.
 * Updates lastAccessedAt on hit (LRU tracking).
 *
 * @returns CacheHit if found, null if miss.
 */
export async function getCachedTransform(
 cacheKey: string,
): Promise<CacheHit | null> {
 const doc = await DerivedAsset.findOneAndUpdate(
 { cacheKey },
 { $set: { lastAccessedAt: new Date() } },
 { new: true },
 ).lean();

 if (!doc) return null;

 return {
 storagePath: doc.storagePath,
 format: doc.format,
 width: doc.width,
 height: doc.height,
 sizeBytes: doc.sizeBytes,
 };
}

/**
 * Read a cached derived image buffer from GCS.
 */
export async function readCachedBuffer(storagePath: string): Promise<Buffer | null> {
 try {
 const [buffer] = await getGcsBucket().file(storagePath).download();
 return buffer;
 } catch {
 // File may have been evicted from GCS but DB record exists
 return null;
 }
}

/* ─── Cache Write ────────────────────────────────────────────── */

/**
 * Store a derived image in GCS and create a MongoDB tracking record.
 */
export async function cacheTransform(params: {
 orgId: string;
 originalAssetId: string;
 transformString: string;
 cacheKey: string;
 buffer: Buffer;
 format: NegotiatedFormat;
 width: number;
 height: number;
}): Promise<void> {
 const { orgId, originalAssetId, transformString, cacheKey, buffer, format, width, height } =
 params;

 const storagePath = derivedStoragePath(cacheKey, format);

 // Upload to GCS
 const file = getGcsBucket().file(storagePath);
 await file.save(buffer, {
 metadata: {
 contentType: `image/${format}`,
 cacheControl: 'public, max-age=31536000, immutable',
 metadata: {
 originalAssetId,
 transformString,
 cacheKey,
 },
 },
 });

 // Upsert MongoDB record
 await DerivedAsset.findOneAndUpdate(
 { cacheKey },
 {
 $set: {
 orgId,
 originalAssetId,
 transformString,
 storagePath,
 format,
 width,
 height,
 sizeBytes: buffer.length,
 lastAccessedAt: new Date(),
 },
 },
 { upsert: true, new: true },
 );
}

/* ─── Cache Invalidation ─────────────────────────────────────── */

/**
 * Invalidate all derived assets for a given original asset.
 * Called when the original is re-uploaded or deleted.
 */
export async function invalidateAssetCache(originalAssetId: string): Promise<number> {
 const docs = await DerivedAsset.find({ originalAssetId }).lean();

 if (docs.length === 0) return 0;

 // Delete from GCS in parallel
 const bucket = getGcsBucket();
 await Promise.all(
 docs.map(async (doc) => {
 try {
 await bucket.file(doc.storagePath).delete();
 } catch {
 // Ignore — file may already be gone
 }
 }),
 );

 // Delete MongoDB records
 const result = await DerivedAsset.deleteMany({ originalAssetId });
 return result.deletedCount ?? 0;
}

/**
 * Invalidate all derived assets for an organization.
 * Called when org storage is wiped or migrated.
 */
export async function invalidateOrgCache(orgId: string): Promise<number> {
 const docs = await DerivedAsset.find({ orgId }).lean();

 if (docs.length === 0) return 0;

 const bucket = getGcsBucket();
 await Promise.all(
 docs.map(async (doc) => {
 try {
 await bucket.file(doc.storagePath).delete();
 } catch {
 // Ignore
 }
 }),
 );

 const result = await DerivedAsset.deleteMany({ orgId });
 return result.deletedCount ?? 0;
}

/* ─── LRU Eviction ───────────────────────────────────────────── */

/**
 * Evict derived assets older than `maxAgeDays` that haven't been accessed.
 * Returns the count of evicted items.
 */
export async function evictStaleCache(
 orgId: string,
 maxAgeDays = 30,
): Promise<number> {
 const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

 const docs = await DerivedAsset.find({
 orgId,
 lastAccessedAt: { $lt: cutoff },
 }).lean();

 if (docs.length === 0) return 0;

 const bucket = getGcsBucket();
 await Promise.all(
 docs.map(async (doc) => {
 try {
 await bucket.file(doc.storagePath).delete();
 } catch {
 // Ignore
 }
 }),
 );

 const result = await DerivedAsset.deleteMany({
 orgId,
 lastAccessedAt: { $lt: cutoff },
 });
 return result.deletedCount ?? 0;
}
