// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/* ── Mock external deps ──────────────────────────────────────── */

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => {
 return {
 authenticateApiRequest: vi.fn(),
 isErrorResponse: vi.fn((v: unknown) => v instanceof NextResponse),
 addCorsHeaders: vi.fn((res: unknown) => res),
 applyFolderScope: vi.fn().mockResolvedValue(null),
 };
});

vi.mock('@/lib/storage', () => ({
 getSignedDownloadUrl: vi.fn().mockResolvedValue('https://signed.url'),
 getSignedUploadUrl: vi.fn().mockResolvedValue('https://upload.url'),
}));

vi.mock('@/models', () => ({
 Asset: {
 find: vi.fn(),
 findOne: vi.fn(),
 findOneAndUpdate: vi.fn(),
 countDocuments: vi.fn(),
 create: vi.fn(),
 },
 Organization: {
 findById: vi.fn(),
 },
}));

import { GET, POST } from '@/app/api/v1/assets/route';
import { authenticateApiRequest } from '@/lib/api-auth';
import { Asset, Organization } from '@/models';

const mockAuth = vi.mocked(authenticateApiRequest) as unknown as ReturnType<typeof vi.fn>;
const mockAssetFind = vi.mocked(Asset.find) as unknown as ReturnType<typeof vi.fn>;
const mockAssetFindOne = vi.mocked(Asset.findOne) as unknown as ReturnType<typeof vi.fn>;
const mockAssetFindOneAndUpdate = vi.mocked(Asset.findOneAndUpdate) as unknown as ReturnType<typeof vi.fn>;
const mockAssetCount = vi.mocked(Asset.countDocuments) as unknown as ReturnType<typeof vi.fn>;
const mockAssetCreate = vi.mocked(Asset.create) as unknown as ReturnType<typeof vi.fn>;
const mockOrgFindById = vi.mocked(Organization.findById) as unknown as ReturnType<typeof vi.fn>;

const AUTH_CTX = {
 keyId: 'key1',
 orgId: 'org1',
 keyName: 'Test',
 permissions: ['read', 'write'] as ('read' | 'write')[],
 allowedDomains: [] as string[],
 rateLimit: 60,
};

function makeReq(url: string, init?: RequestInit): NextRequest {
 return new NextRequest(new URL(url, 'http://localhost'), init as never);
}

describe('REST API v1 — Assets', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockAuth.mockResolvedValue(AUTH_CTX);
 mockOrgFindById.mockReturnValue({
 lean: vi.fn().mockResolvedValue({ slug: 'acme' }),
 });
 });

 // ─── GET /api/v1/assets ──────────────────────────────────────
 describe('GET /api/v1/assets', () => {
 it('returns paginated assets', async () => {
 const assets = [
 {
 _id: 'a1',
 name: 'test.png',
 mimeType: 'image/png',
 storageKey: 'uploads/test.png',
 width: 800,
 height: 600,
 sizeBytes: 1024,
 tags: ['photo'],
 thumbnailBase64: 'data:image/png;base64,...',
 createdAt: new Date(),
 updatedAt: new Date(),
 },
 ];
 mockAssetFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(assets),
 }),
 }),
 }),
 });
 mockAssetCount.mockResolvedValue(1);

 const req = makeReq('http://localhost/api/v1/assets?page=1&limit=10');
 const res = await GET(req);
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.assets).toHaveLength(1);
 expect(data.total).toBe(1);
 expect(data.page).toBe(1);
 expect(data.totalPages).toBe(1);
 });

 it('applies search filter', async () => {
 mockAssetFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 }),
 }),
 });
 mockAssetCount.mockResolvedValue(0);

 const req = makeReq('http://localhost/api/v1/assets?q=sunset');
 await GET(req);

 expect(mockAssetFind).toHaveBeenCalledWith(
 expect.objectContaining({
 $text: { $search: 'sunset' },
 }),
 expect.objectContaining({ score: { $meta: 'textScore' } }),
 );
 });
 });

 // ─── POST /api/v1/assets ─────────────────────────────────────
 describe('POST /api/v1/assets', () => {
 it('rejects missing name', async () => {
 const req = makeReq('http://localhost/api/v1/assets', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({}),
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 });

 it('creates asset with signed upload URL', async () => {
 mockAssetCreate.mockResolvedValue({
 _id: 'asset1',
 name: 'photo.jpg',
 storageKey: 'uploads/acme/photo.jpg',
 toObject: vi.fn().mockReturnValue({ _id: 'asset1', name: 'photo.jpg' }),
 });

 const req = makeReq('http://localhost/api/v1/assets', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: 'photo.jpg',
 contentType: 'image/jpeg',
 sizeBytes: 2048,
 }),
 });
 const res = await POST(req);
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.assetId).toBe('asset1');
 expect(data.uploadUrl).toBeTruthy();
 });
 });
});

// ─── Single asset routes ────────────────────────────────────────
describe('REST API v1 — Assets [id]', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockAuth.mockResolvedValue(AUTH_CTX);
 });

 it('GET returns 404 for missing asset', async () => {
 // Import dynamically to use fresh mocks
 const { GET: getById } = await import('@/app/api/v1/assets/[id]/route');
 mockAssetFindOne.mockReturnValue({
 lean: vi.fn().mockResolvedValue(null),
 });

 const req = makeReq('http://localhost/api/v1/assets/missing');
 const res = await getById(req, { params: Promise.resolve({ id: 'missing' }) });
 expect(res.status).toBe(404);
 });

 it('PATCH updates asset metadata', async () => {
 const { PATCH } = await import('@/app/api/v1/assets/[id]/route');
 mockAssetFindOneAndUpdate.mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 _id: 'a1',
 name: 'Updated',
 tags: ['new-tag'],
 }),
 });

 const req = makeReq('http://localhost/api/v1/assets/a1', {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ name: 'Updated', tags: ['new-tag'] }),
 });
 const res = await PATCH(req, { params: Promise.resolve({ id: 'a1' }) });
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.asset.name).toBe('Updated');
 });

 it('DELETE soft-deletes an asset', async () => {
 const { DELETE } = await import('@/app/api/v1/assets/[id]/route');
 mockAssetFindOneAndUpdate.mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 _id: 'a1',
 isDeleted: true,
 }),
 });

 const req = makeReq('http://localhost/api/v1/assets/a1', { method: 'DELETE' });
 const res = await DELETE(req, { params: Promise.resolve({ id: 'a1' }) });
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.message).toBe('Asset deleted');
 });
});
