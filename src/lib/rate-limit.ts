// SPDX-License-Identifier: Apache-2.0
/**
 * Sliding-window rate limiter backed by MongoDB.
 *
 * Each entry tracks request count within a 1-minute window.
 * TTL index auto-cleans expired windows.
 */

import { connectToDatabase } from '@/lib/db';
import { RateLimitEntry } from '@/models';

const WINDOW_SIZE_MS = 60 * 1000; // 1 minute

export interface RateLimitResult {
 allowed: boolean;
 remaining: number;
 limit: number;
 retryAfterSeconds: number;
}

/**
 * Check and increment rate limit for a given key.
 * Returns whether the request is allowed and remaining quota.
 */
export async function checkRateLimit(
 key: string,
 limit: number,
): Promise<RateLimitResult> {
 await connectToDatabase();

 const now = new Date();
 const windowStart = new Date(
 Math.floor(now.getTime() / WINDOW_SIZE_MS) * WINDOW_SIZE_MS,
 );
 const expiresAt = new Date(windowStart.getTime() + WINDOW_SIZE_MS * 2); // TTL cleanup

 // Atomic upsert + increment
 const entry = await RateLimitEntry.findOneAndUpdate(
 { key, windowStart },
 {
 $inc: { count: 1 },
 $setOnInsert: { expiresAt },
 },
 { upsert: true, returnDocument: 'after' },
 );

 const currentCount = entry?.count ?? 1;

 if (currentCount > limit) {
 const windowEnd = windowStart.getTime() + WINDOW_SIZE_MS;
 const retryAfterSeconds = Math.ceil((windowEnd - now.getTime()) / 1000);

 return {
 allowed: false,
 remaining: 0,
 limit,
 retryAfterSeconds: Math.max(1, retryAfterSeconds),
 };
 }

 return {
 allowed: true,
 remaining: Math.max(0, limit - currentCount),
 limit,
 retryAfterSeconds: 0,
 };
}

/**
 * Get current usage for a rate limit key (no increment).
 */
export async function getRateLimitUsage(
 key: string,
 limit: number,
): Promise<{ used: number; remaining: number; limit: number }> {
 await connectToDatabase();

 const now = new Date();
 const windowStart = new Date(
 Math.floor(now.getTime() / WINDOW_SIZE_MS) * WINDOW_SIZE_MS,
 );

 const entry = await RateLimitEntry.findOne({ key, windowStart }).lean();
 const used = entry?.count ?? 0;

 return {
 used,
 remaining: Math.max(0, limit - used),
 limit,
 };
}

/** Default rate limits by organization plan. */
export const PLAN_RATE_LIMITS = {
 free: { requestsPerMin: 60, uploadsPerMin: 10, aiOpsPerMin: 5 },
 pro: { requestsPerMin: 300, uploadsPerMin: 50, aiOpsPerMin: 20 },
 enterprise: { requestsPerMin: 1000, uploadsPerMin: 200, aiOpsPerMin: 100 },
} as const;
