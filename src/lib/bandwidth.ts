// SPDX-License-Identifier: Apache-2.0
/**
 * Bandwidth tracking utilities.
 * Records upload/download/transform/CDN bytes per org per day.
 * Uses atomic $inc updates for concurrent-safe aggregation.
 */

import { connectToDatabase } from '@/lib/db';
import { BandwidthLog, Organization } from '@/models';
import mongoose from 'mongoose';

/** Bandwidth event categories */
export type BandwidthCategory =
 | 'upload'
 | 'download'
 | 'transform'
 | 'cdn';

/** Get the start-of-day date (UTC) for daily bucketing */
function todayBucket(): Date {
 const now = new Date();
 return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Track bandwidth usage for an organization.
 * Uses upsert + $inc for concurrent-safe daily aggregation.
 */
export async function trackBandwidth(
 orgId: string | mongoose.Types.ObjectId,
 category: BandwidthCategory,
 bytes: number,
): Promise<void> {
 if (bytes <= 0) return;

 await connectToDatabase();

 const oid =
 typeof orgId === 'string' ? new mongoose.Types.ObjectId(orgId) : orgId;
 const date = todayBucket();

 // Build dynamic field update
 const categoryField = `${category}Bytes`; // e.g. uploadBytes, downloadBytes
 const inc: Record<string, number> = {
 [categoryField]: bytes,
 totalBytes: bytes,
 requestCount: 1,
 };

 // Atomic upsert: create daily bucket if absent, increment counters
 await BandwidthLog.updateOne(
 { orgId: oid, date },
 { $inc: inc },
 { upsert: true },
 );

 // Also increment org-level cumulative bandwidth
 await Organization.updateOne(
 { _id: oid },
 { $inc: { 'usage.bandwidth': bytes } },
 );
}

/**
 * Get bandwidth stats for a date range.
 * Returns daily breakdown sorted chronologically.
 */
export async function getBandwidthStats(
 orgId: string,
 days = 30,
): Promise<{
 daily: {
 date: string;
 uploadBytes: number;
 downloadBytes: number;
 transformBytes: number;
 cdnBytes: number;
 totalBytes: number;
 requestCount: number;
 }[];
 totals: {
 uploadBytes: number;
 downloadBytes: number;
 transformBytes: number;
 cdnBytes: number;
 totalBytes: number;
 requestCount: number;
 };
}> {
 await connectToDatabase();

 const oid = new mongoose.Types.ObjectId(orgId);
 const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

 const logs = await BandwidthLog.find({ orgId: oid, date: { $gte: since } })
 .sort({ date: 1 })
 .lean();

 const daily = logs.map((l) => ({
 date: l.date.toISOString().slice(0, 10),
 uploadBytes: l.uploadBytes,
 downloadBytes: l.downloadBytes,
 transformBytes: l.transformBytes,
 cdnBytes: l.cdnBytes,
 totalBytes: l.totalBytes,
 requestCount: l.requestCount,
 }));

 const totals = daily.reduce(
 (acc, d) => ({
 uploadBytes: acc.uploadBytes + d.uploadBytes,
 downloadBytes: acc.downloadBytes + d.downloadBytes,
 transformBytes: acc.transformBytes + d.transformBytes,
 cdnBytes: acc.cdnBytes + d.cdnBytes,
 totalBytes: acc.totalBytes + d.totalBytes,
 requestCount: acc.requestCount + d.requestCount,
 }),
 {
 uploadBytes: 0,
 downloadBytes: 0,
 transformBytes: 0,
 cdnBytes: 0,
 totalBytes: 0,
 requestCount: 0,
 },
 );

 return { daily, totals };
}
