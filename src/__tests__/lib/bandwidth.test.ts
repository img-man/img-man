// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────
const {
 mockBandwidthLogUpdateOne,
 mockBandwidthLogFind,
 mockOrgUpdateOne,
} = vi.hoisted(() => ({
 mockBandwidthLogUpdateOne: vi.fn(),
 mockBandwidthLogFind: vi.fn(),
 mockOrgUpdateOne: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/models', () => ({
 BandwidthLog: {
 updateOne: mockBandwidthLogUpdateOne,
 find: mockBandwidthLogFind,
 },
 Organization: {
 updateOne: mockOrgUpdateOne,
 },
}));

// Mock mongoose so ObjectId doesn't require a real 24-char hex
vi.mock('mongoose', () => {
 class FakeObjectId {
 value: string;
 constructor(id: string) { this.value = id; }
 toString() { return this.value; }
 }
 return { default: { Types: { ObjectId: FakeObjectId } }, Types: { ObjectId: FakeObjectId } };
});

import { trackBandwidth, getBandwidthStats } from '@/lib/bandwidth';

const ORG_ID = 'org123';

describe('Bandwidth Tracking Library', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockBandwidthLogUpdateOne.mockResolvedValue({ modifiedCount: 1 });
 mockOrgUpdateOne.mockResolvedValue({ modifiedCount: 1 });
 });

 /* ─── trackBandwidth ─────────────────────────────── */

 describe('trackBandwidth', () => {
 it('should track upload bytes atomically', async () => {
 await trackBandwidth(ORG_ID, 'upload', 1024);

 expect(mockBandwidthLogUpdateOne).toHaveBeenCalledWith(
 expect.objectContaining({ orgId: expect.objectContaining({ value: ORG_ID }) }),
 { $inc: { uploadBytes: 1024, totalBytes: 1024, requestCount: 1 } },
 { upsert: true },
 );
 expect(mockOrgUpdateOne).toHaveBeenCalledWith(
 { _id: expect.objectContaining({ value: ORG_ID }) },
 { $inc: { 'usage.bandwidth': 1024 } },
 );
 });

 it('should track download bytes', async () => {
 await trackBandwidth(ORG_ID, 'download', 2048);

 expect(mockBandwidthLogUpdateOne).toHaveBeenCalledWith(
 expect.objectContaining({ orgId: expect.objectContaining({ value: ORG_ID }) }),
 { $inc: { downloadBytes: 2048, totalBytes: 2048, requestCount: 1 } },
 { upsert: true },
 );
 });

 it('should track transform bytes', async () => {
 await trackBandwidth(ORG_ID, 'transform', 512);

 expect(mockBandwidthLogUpdateOne).toHaveBeenCalledWith(
 expect.objectContaining({ orgId: expect.objectContaining({ value: ORG_ID }) }),
 { $inc: { transformBytes: 512, totalBytes: 512, requestCount: 1 } },
 { upsert: true },
 );
 });

 it('should track cdn bytes', async () => {
 await trackBandwidth(ORG_ID, 'cdn', 4096);

 expect(mockBandwidthLogUpdateOne).toHaveBeenCalledWith(
 expect.objectContaining({ orgId: expect.objectContaining({ value: ORG_ID }) }),
 { $inc: { cdnBytes: 4096, totalBytes: 4096, requestCount: 1 } },
 { upsert: true },
 );
 });

 it('should skip zero or negative bytes', async () => {
 await trackBandwidth(ORG_ID, 'upload', 0);
 expect(mockBandwidthLogUpdateOne).not.toHaveBeenCalled();

 await trackBandwidth(ORG_ID, 'upload', -10);
 expect(mockBandwidthLogUpdateOne).not.toHaveBeenCalled();
 });
 });

 /* ─── getBandwidthStats ──────────────────────────── */

 describe('getBandwidthStats', () => {
 it('should return daily breakdown and totals', async () => {
 const mockLogs = [
 {
 date: new Date('2025-07-01'),
 uploadBytes: 100,
 downloadBytes: 200,
 transformBytes: 50,
 cdnBytes: 150,
 totalBytes: 500,
 requestCount: 10,
 },
 {
 date: new Date('2025-07-02'),
 uploadBytes: 300,
 downloadBytes: 400,
 transformBytes: 100,
 cdnBytes: 200,
 totalBytes: 1000,
 requestCount: 20,
 },
 ];

 mockBandwidthLogFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(mockLogs),
 }),
 });

 const result = await getBandwidthStats(ORG_ID, 30);

 expect(result.daily).toHaveLength(2);
 expect(result.daily[0].date).toBe('2025-07-01');
 expect(result.daily[1].date).toBe('2025-07-02');
 expect(result.totals.uploadBytes).toBe(400);
 expect(result.totals.downloadBytes).toBe(600);
 expect(result.totals.totalBytes).toBe(1500);
 expect(result.totals.requestCount).toBe(30);
 });

 it('should return empty stats for no data', async () => {
 mockBandwidthLogFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 });

 const result = await getBandwidthStats(ORG_ID, 7);

 expect(result.daily).toHaveLength(0);
 expect(result.totals.totalBytes).toBe(0);
 expect(result.totals.requestCount).toBe(0);
 });

 it('should clamp days parameter', async () => {
 mockBandwidthLogFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 });

 await getBandwidthStats(ORG_ID, 30);

 expect(mockBandwidthLogFind).toHaveBeenCalledWith(
 expect.objectContaining({
 orgId: expect.objectContaining({ value: ORG_ID }),
 date: expect.objectContaining({ $gte: expect.any(Date) }),
 }),
 );
 });
 });
});
