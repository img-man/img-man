// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────
const {
 mockRequirePerm,
 mockUploadBuffer,
 mockTrackBandwidth,
 mockAssetCreate,
 mockOrgFindById,
 mockOrgUpdateOne,
 mockFetch,
} = vi.hoisted(() => ({
 mockRequirePerm: vi.fn(),
 mockUploadBuffer: vi.fn(),
 mockTrackBandwidth: vi.fn(),
 mockAssetCreate: vi.fn(),
 mockOrgFindById: vi.fn(),
 mockOrgUpdateOne: vi.fn(),
 mockFetch: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
 requirePermission: mockRequirePerm,
}));

vi.mock('@/lib/storage', () => ({
 uploadBuffer: mockUploadBuffer,
}));

vi.mock('@/lib/bandwidth', () => ({
 trackBandwidth: mockTrackBandwidth,
}));

vi.mock('@/models', () => ({
 Asset: {
 create: mockAssetCreate,
 },
 Organization: {
 findById: mockOrgFindById,
 updateOne: mockOrgUpdateOne,
 },
}));

import { POST } from '@/app/api/assets/import/route';
import { NextRequest } from 'next/server';

const ctx = { userId: 'u1', orgId: 'org1', role: 'editor', email: 'a@b.com', name: 'A' };

function makeReq(body: Record<string, unknown>) {
 return new NextRequest('http://localhost/api/assets/import', {
 method: 'POST',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 });
}

function createMockResponse(contentType: string, size: number) {
 const buf = Buffer.alloc(size, 0);
 return {
 ok: true,
 headers: {
 get: (name: string) => {
 if (name === 'content-type') return contentType;
 if (name === 'content-length') return String(size);
 return null;
 },
 },
 arrayBuffer: vi.fn().mockResolvedValue(buf.buffer),
 };
}

describe('Batch URL Import', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockRequirePerm.mockResolvedValue(ctx);
 mockOrgFindById.mockReturnValue({
 lean: vi.fn().mockResolvedValue({ _id: 'org1', storageConfig: { bucket: 'test-bucket' } }),
 });
 mockOrgUpdateOne.mockResolvedValue({ modifiedCount: 1 });
 global.fetch = mockFetch as unknown as typeof fetch;
 });

 /* ─── Success cases ─────────────────────────────────── */

 it('should import a single URL successfully', async () => {
 mockFetch.mockResolvedValue(createMockResponse('image/png', 1024));
 mockUploadBuffer.mockResolvedValue(undefined);
 mockAssetCreate.mockResolvedValue({ _id: 'asset1', filename: 'image.png' });
 mockTrackBandwidth.mockResolvedValue(undefined);

 const res = await POST(makeReq({
 urls: ['https://example.com/image.png'],
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.imported).toBe(1);
 expect(data.errors).toBe(0);
 expect(data.results).toHaveLength(1);
 expect(data.results[0].status).toBe('success');
 });

 it('should import multiple URLs and track bandwidth', async () => {
 mockFetch.mockResolvedValue(createMockResponse('image/jpeg', 2048));
 mockUploadBuffer.mockResolvedValue(undefined);
 mockAssetCreate.mockResolvedValue({ _id: 'asset1', filename: 'photo.jpg' });
 mockTrackBandwidth.mockResolvedValue(undefined);

 const res = await POST(makeReq({
 urls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.imported).toBe(2);
 expect(data.totalBytes).toBeGreaterThan(0);
 expect(mockTrackBandwidth).toHaveBeenCalled();
 });

 /* ─── Mixed success/failure ──────────────────────────── */

 it('should report partial failures', async () => {
 mockFetch
 .mockResolvedValueOnce(createMockResponse('image/png', 1024))
 .mockResolvedValueOnce({ ok: false, status: 404, headers: { get: () => null } });
 mockUploadBuffer.mockResolvedValue(undefined);
 mockAssetCreate.mockResolvedValue({ _id: 'asset1' });
 mockTrackBandwidth.mockResolvedValue(undefined);
 // Also need Organization.updateOne for bandwidth tracking
 mockOrgFindById.mockReturnValue({
 lean: vi.fn().mockResolvedValue({ _id: 'org1', storageConfig: { bucket: 'test-bucket' } }),
 });

 const res = await POST(makeReq({
 urls: ['https://example.com/good.png', 'https://example.com/missing.png'],
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.imported).toBe(1);
 expect(data.errors).toBe(1);
 expect(data.results[1].status).toBe('error');
 });

 /* ─── Validation ─────────────────────────────────────── */

 it('should reject requests without urls array', async () => {
 const res = await POST(makeReq({}));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('urls');
 });

 it('should reject empty urls array', async () => {
 const res = await POST(makeReq({ urls: [] }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toBeDefined();
 });

 it('should reject more than 50 URLs', async () => {
 const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/${i}.png`);

 const res = await POST(makeReq({ urls }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('50');
 });

 /* ─── Auth ───────────────────────────────────────────── */

 it('should return 401 when not authenticated', async () => {
 mockRequirePerm.mockRejectedValue(
 new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
 );

 const res = await POST(makeReq({
 urls: ['https://example.com/img.png'],
 }));

 // requirePermission throws the Response directly
 expect(res.status).toBe(401);
 });
});
