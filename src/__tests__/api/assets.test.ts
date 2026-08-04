// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies before importing the route
vi.mock('@/lib/session', () => ({
 getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/models', () => {
 const findMock = vi.fn();
 const countDocumentsMock = vi.fn();
 return {
 Asset: {
 find: findMock,
 countDocuments: countDocumentsMock,
 },
 User: {
 findOne: vi.fn(),
 },
 };
});

vi.mock('@/lib/storage', () => ({
 getSignedDownloadUrl: vi.fn(),
}));

import { GET } from '@/app/api/assets/route';
import { getSession } from '@/lib/session';
import { Asset, User } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';
import { NextRequest } from 'next/server';

const mockGetSession = vi.mocked(getSession);
const mockUserFindOne = vi.mocked(User.findOne);
const mockAssetFind = vi.mocked(Asset.find);
const mockAssetCountDocuments = vi.mocked(Asset.countDocuments);
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl);

function makeRequest(url: string) {
 return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/assets', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('returns 401 when not authenticated', async () => {
 mockGetSession.mockResolvedValue(null);

 const res = await GET(makeRequest('/api/assets'));
 const json = await res.json();

 expect(res.status).toBe(401);
 expect(json.error).toBe('Unauthorized');
 });

 it('returns 400 when user has no organization', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve({ email: 'test@imageman.dev' }),
 } as never);

 const res = await GET(makeRequest('/api/assets'));
 const json = await res.json();

 expect(res.status).toBe(400);
 expect(json.error).toBe('No organization');
 });

 it('returns paginated assets without signed URLs (base64 inline)', async () => {
 const orgId = 'org123';
 const mockAsset = {
 _id: 'asset1',
 name: 'test.png',
 storageKey: 'orgs/org123/test.png',
 mimeType: 'image/png',
 sizeBytes: 1024,
 tags: ['photo'],
 thumbnailBase64: 'data:image/webp;base64,abc123',
 createdAt: new Date().toISOString(),
 };

 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve({ email: 'test@imageman.dev', orgId }),
 } as never);

 const chainMock = {
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([mockAsset]),
 };
 mockAssetFind.mockReturnValue(chainMock as never);
 mockAssetCountDocuments.mockResolvedValue(1 as never);

 const res = await GET(makeRequest('/api/assets?page=1&limit=10'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.assets).toHaveLength(1);
 // Assets list API no longer generates signed URLs — grid uses inline base64
 expect(json.assets[0].url).toBeUndefined();
 expect(json.assets[0].thumbnailBase64).toBe('data:image/webp;base64,abc123');
 expect(json.page).toBe(1);
 expect(json.limit).toBe(10);
 expect(json.total).toBe(1);
 expect(json.totalPages).toBe(1);
 // Verify NO signed URL generation was called
 expect(mockGetSignedUrl).not.toHaveBeenCalled();
 });

 it('applies folderId filter when provided', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () =>
 Promise.resolve({ email: 'test@imageman.dev', orgId: 'org1' }),
 } as never);

 const chainMock = {
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([]),
 };
 mockAssetFind.mockReturnValue(chainMock as never);
 mockAssetCountDocuments.mockResolvedValue(0 as never);

 await GET(makeRequest('/api/assets?folderId=folder123'));

 // Check that the filter includes the folderId
 const findCallArgs = mockAssetFind.mock.calls[0];
 expect(findCallArgs[0]).toMatchObject({ folderId: 'folder123' });
 });

 it('applies text search filter when q is provided', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () =>
 Promise.resolve({ email: 'test@imageman.dev', orgId: 'org1' }),
 } as never);

 const chainMock = {
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([]),
 };
 mockAssetFind.mockReturnValue(chainMock as never);
 mockAssetCountDocuments.mockResolvedValue(0 as never);

 await GET(makeRequest('/api/assets?q=sunset'));

 const findCallArgs = mockAssetFind.mock.calls[0];
 expect(findCallArgs[0]).toMatchObject({ $text: { $search: 'sunset' } });
 });

 it('clamps page and limit to valid ranges', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () =>
 Promise.resolve({ email: 'test@imageman.dev', orgId: 'org1' }),
 } as never);

 const chainMock = {
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([]),
 };
 mockAssetFind.mockReturnValue(chainMock as never);
 mockAssetCountDocuments.mockResolvedValue(0 as never);

 const res = await GET(makeRequest('/api/assets?page=-5&limit=999'));
 const json = await res.json();

 // page should clamp to 1, limit to 100
 expect(json.page).toBe(1);
 expect(json.limit).toBe(100);
 });

 it('uses safe sort field, rejects arbitrary field names', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () =>
 Promise.resolve({ email: 'test@imageman.dev', orgId: 'org1' }),
 } as never);

 const chainMock = {
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([]),
 };
 mockAssetFind.mockReturnValue(chainMock as never);
 mockAssetCountDocuments.mockResolvedValue(0 as never);

 await GET(makeRequest('/api/assets?sort=__proto__'));

 // Should fall back to 'createdAt', not use the injected field name
 const sortArg = chainMock.sort.mock.calls[0][0];
 expect(sortArg).toHaveProperty('createdAt');
 expect(sortArg).not.toHaveProperty('__proto__');
 });
});
