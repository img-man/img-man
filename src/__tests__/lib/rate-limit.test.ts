// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mock external deps ──────────────────────────────────────── */

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/models', () => ({
 RateLimitEntry: {
 findOneAndUpdate: vi.fn(),
 findOne: vi.fn(),
 },
}));

import { checkRateLimit, getRateLimitUsage } from '@/lib/rate-limit';
import { RateLimitEntry } from '@/models';

const mockFindOneAndUpdate = vi.mocked(RateLimitEntry.findOneAndUpdate) as unknown as ReturnType<typeof vi.fn>;
const mockFindOne = vi.mocked(RateLimitEntry.findOne) as unknown as ReturnType<typeof vi.fn>;

describe('Rate Limiter', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 describe('checkRateLimit', () => {
 it('allows requests under the limit', async () => {
 mockFindOneAndUpdate.mockResolvedValue({ count: 5 });

 const result = await checkRateLimit('apikey:test', 60);
 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(55);
 expect(result.limit).toBe(60);
 });

 it('allows exactly at the limit', async () => {
 mockFindOneAndUpdate.mockResolvedValue({ count: 60 });

 const result = await checkRateLimit('apikey:test', 60);
 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(0);
 });

 it('blocks requests over the limit', async () => {
 mockFindOneAndUpdate.mockResolvedValue({ count: 61 });

 const result = await checkRateLimit('apikey:test', 60);
 expect(result.allowed).toBe(false);
 expect(result.remaining).toBe(0);
 expect(result.retryAfterSeconds).toBeGreaterThan(0);
 });

 it('handles null entry gracefully', async () => {
 mockFindOneAndUpdate.mockResolvedValue(null);

 const result = await checkRateLimit('apikey:test', 60);
 expect(result.allowed).toBe(true);
 expect(result.remaining).toBe(59);
 });
 });

 describe('getRateLimitUsage', () => {
 it('returns current usage', async () => {
 mockFindOne.mockReturnValue({
 lean: vi.fn().mockResolvedValue({ count: 25 }),
 });

 const result = await getRateLimitUsage('apikey:test', 60);
 expect(result.used).toBe(25);
 expect(result.remaining).toBe(35);
 expect(result.limit).toBe(60);
 });

 it('returns zero when no entry', async () => {
 mockFindOne.mockReturnValue({
 lean: vi.fn().mockResolvedValue(null),
 });

 const result = await getRateLimitUsage('apikey:test', 60);
 expect(result.used).toBe(0);
 expect(result.remaining).toBe(60);
 });
 });
});
