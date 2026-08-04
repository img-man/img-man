// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

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
 getSignedDownloadUrl: vi.fn().mockResolvedValue('https://storage.example.com/signed'),
}));

vi.mock('@/models', () => ({
 Asset: {
 find: vi.fn(),
 countDocuments: vi.fn(),
 },
 Organization: {
 findById: vi.fn(),
 findByIdAndUpdate: vi.fn(),
 },
}));

import { GET, PATCH } from '@/app/api/v1/faces/[faceHash]/route';
import { authenticateApiRequest } from '@/lib/api-auth';
import { Asset, Organization } from '@/models';
import { NextRequest } from 'next/server';

const mockAuth = vi.mocked(authenticateApiRequest) as unknown as ReturnType<typeof vi.fn>;
const mockAssetFind = vi.mocked(Asset.find) as unknown as ReturnType<typeof vi.fn>;
const mockAssetCount = vi.mocked(Asset.countDocuments) as unknown as ReturnType<typeof vi.fn>;
const mockOrgFindById = vi.mocked(Organization.findById) as unknown as ReturnType<typeof vi.fn>;
const mockOrgUpdate = vi.mocked(Organization.findByIdAndUpdate) as unknown as ReturnType<typeof vi.fn>;

const AUTH_CTX = {
 keyId: 'key1',
 orgId: 'org1',
 keyName: 'Test',
 permissions: ['read', 'write'] as ('read' | 'write')[],
 allowedDomains: [] as string[],
 rateLimit: 60,
 folderScope: undefined,
};

const CTX = { params: Promise.resolve({ faceHash: 'abc123hash' }) };

function makeGetReq(params?: Record<string, string>): NextRequest {
 const url = new URL('http://localhost/api/v1/faces/abc123hash');
 if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
 return new NextRequest(url);
}

function makePatchReq(body: Record<string, unknown>): NextRequest {
 return new NextRequest(new URL('http://localhost/api/v1/faces/abc123hash'), {
 method: 'PATCH',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 } as never);
}

/* ─── Tests ──────────────────────────────────────────────────── */

describe('V1 Faces [faceHash] API', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockAuth.mockResolvedValue(AUTH_CTX);
 });

 /* ─── GET ─────────────────────────────────────────── */

 describe('GET /api/v1/faces/[faceHash]', () => {
 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
 const res = await GET(makeGetReq(), CTX);
 expect(res.status).toBe(401);
 });

 it('returns paginated assets with face info', async () => {
 const mockAssets = [
 {
 _id: 'a1',
 name: 'photo1.jpg',
 storageKey: 'assets/org1/photo1.jpg',
 thumbnailStorageKey: 'thumbs/org1/t1.webp',
 thumbnailBase64: null,
 mimeType: 'image/jpeg',
 width: 800,
 height: 600,
 tags: ['wedding'],
 folderId: 'f1',
 createdAt: '2024-01-01',
 faces: [
 { faceHash: 'abc123hash', confidence: 0.95, boundingBox: { x: 10, y: 10, w: 50, h: 50 }, emotion: 'happy' },
 { faceHash: 'other', confidence: 0.8 },
 ],
 },
 ];

 mockAssetFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(mockAssets),
 }),
 }),
 }),
 });
 mockAssetCount.mockResolvedValue(1);
 mockOrgFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 personNames: { abc123hash: 'Jane Doe' },
 }),
 }),
 });

 const res = await GET(makeGetReq(), CTX);
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.faceHash).toBe('abc123hash');
 expect(data.displayName).toBe('Jane Doe');
 expect(data.assets).toHaveLength(1);
 expect(data.assets[0].face.faceHash).toBe('abc123hash');
 expect(data.assets[0].face.emotion).toBe('happy');
 expect(data.total).toBe(1);
 expect(data.totalPages).toBe(1);
 });

 it('returns null displayName when not named', async () => {
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
 mockOrgFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue({ personNames: {} }),
 }),
 });

 const res = await GET(makeGetReq(), CTX);
 const data = await res.json();

 expect(data.displayName).toBeNull();
 expect(data.assets).toEqual([]);
 });

 it('handles page and limit params', async () => {
 mockAssetFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 }),
 }),
 });
 mockAssetCount.mockResolvedValue(100);
 mockOrgFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(null),
 }),
 });

 const res = await GET(makeGetReq({ page: '3', limit: '10' }), CTX);
 const data = await res.json();

 expect(data.page).toBe(3);
 expect(data.limit).toBe(10);
 expect(data.totalPages).toBe(10);
 });

 it('clamps limit to max 100', async () => {
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
 mockOrgFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(null),
 }),
 });

 const res = await GET(makeGetReq({ limit: '500' }), CTX);
 const data = await res.json();
 expect(data.limit).toBe(100);
 });

 it('handles thumbnailBase64 fallback when no thumbnail key', async () => {
 const mockAssets = [
 {
 _id: 'a1', name: 'p.jpg',
 storageKey: 'assets/org1/p.jpg',
 thumbnailStorageKey: null,
 thumbnailBase64: 'data:image/webp;base64,thumb',
 mimeType: 'image/jpeg',
 width: 100, height: 100,
 tags: [], folderId: null, createdAt: '2024-01-01',
 faces: [{ faceHash: 'abc123hash', confidence: 0.9 }],
 },
 ];

 mockAssetFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(mockAssets),
 }),
 }),
 }),
 });
 mockAssetCount.mockResolvedValue(1);
 mockOrgFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(null),
 }),
 });

 const res = await GET(makeGetReq(), CTX);
 const data = await res.json();

 expect(data.assets[0].thumbnailUrl).toBe('data:image/webp;base64,thumb');
 });
 });

 /* ─── PATCH ───────────────────────────────────────── */

 describe('PATCH /api/v1/faces/[faceHash]', () => {
 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
 const res = await PATCH(makePatchReq({ displayName: 'Jane' }), CTX);
 expect(res.status).toBe(401);
 });

 it('returns 400 when displayName is undefined', async () => {
 const res = await PATCH(makePatchReq({}), CTX);
 expect(res.status).toBe(400);
 const data = await res.json();
 expect(data.code).toBe('VALIDATION_ERROR');
 });

 it('sets a display name', async () => {
 mockOrgUpdate.mockResolvedValue({});

 const res = await PATCH(makePatchReq({ displayName: 'Jane Doe' }), CTX);
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.faceHash).toBe('abc123hash');
 expect(data.displayName).toBe('Jane Doe');
 expect(mockOrgUpdate).toHaveBeenCalledWith(
 'org1',
 { $set: { 'personNames.abc123hash': 'Jane Doe' } },
 );
 });

 it('removes display name when empty string', async () => {
 mockOrgUpdate.mockResolvedValue({});

 const res = await PATCH(makePatchReq({ displayName: '' }), CTX);
 const data = await res.json();

 expect(data.displayName).toBeNull();
 expect(mockOrgUpdate).toHaveBeenCalledWith(
 'org1',
 { $unset: { 'personNames.abc123hash': '' } },
 );
 });

 it('removes display name when null', async () => {
 mockOrgUpdate.mockResolvedValue({});

 const res = await PATCH(makePatchReq({ displayName: null }), CTX);
 const data = await res.json();

 expect(data.displayName).toBeNull();
 });
 });
});
