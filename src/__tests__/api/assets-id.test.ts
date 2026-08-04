// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({
 getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/models', () => ({
 Asset: {
 findOne: vi.fn(),
 findOneAndUpdate: vi.fn(),
 findOneAndDelete: vi.fn(),
 },
 User: {
 findOne: vi.fn(),
 },
}));

vi.mock('@/lib/storage', () => ({
 createStorageProxyToken: vi.fn(),
 getSignedDownloadUrl: vi.fn(),
 getGcsBucket: vi.fn(),
}));

import { GET, PATCH, DELETE } from '@/app/api/assets/[id]/route';
import { getSession } from '@/lib/session';
import { Asset, User } from '@/models';
import {
 createStorageProxyToken,
 getGcsBucket,
 getSignedDownloadUrl,
} from '@/lib/storage';
import { NextRequest } from 'next/server';

const mockGetSession = vi.mocked(getSession);
const mockUserFindOne = vi.mocked(User.findOne);
const mockCreateStorageProxyToken = vi.mocked(createStorageProxyToken);
const mockGetSignedUrl = vi.mocked(getSignedDownloadUrl);
const mockGetGcsBucket = vi.mocked(getGcsBucket);

function mockStorageBucket(metadataImpl?: (objectPath: string) => Promise<[object]>) {
 const getMetadata = vi.fn((objectPath?: string) =>
 metadataImpl
 ? metadataImpl(objectPath ?? '')
 : Promise.resolve([{}]),
 );
 const deleteObject = vi.fn().mockResolvedValue(undefined);
 mockGetGcsBucket.mockResolvedValue({
 file: vi.fn((objectPath: string) => ({
 getMetadata: () => getMetadata(objectPath),
 delete: deleteObject,
 })),
 } as never);
 return { getMetadata, deleteObject };
}

function makeRequest(url: string, init?: RequestInit) {
 return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

function makeCtx(id: string) {
 return { params: Promise.resolve({ id }) };
}

const fakeUser = { email: 'test@imageman.dev', orgId: 'org123', _id: 'user1', role: 'editor' };
const fakeAsset = {
 _id: 'asset1',
 name: 'photo.png',
 storageKey: 'orgs/org123/photo.png',
 mimeType: 'image/png',
 sizeBytes: 2048,
 tags: ['nature'],
 variants: [],
 createdAt: new Date().toISOString(),
};

describe('GET /api/assets/[id]', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockCreateStorageProxyToken.mockReturnValue('proxy-token');
 });

 it('returns 401 when not authenticated', async () => {
 mockGetSession.mockResolvedValue(null);
 const res = await GET(makeRequest('/api/assets/asset1'), makeCtx('asset1'));
 expect(res.status).toBe(401);
 });

 it('returns 404 when asset not found', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.findOne).mockReturnValue({
 lean: () => Promise.resolve(null),
 } as never);

 const res = await GET(makeRequest('/api/assets/asset1'), makeCtx('asset1'));
 expect(res.status).toBe(404);
 });

 it('returns asset with signed URL and browser-safe download URL', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.findOne).mockReturnValue({
 lean: () => Promise.resolve(fakeAsset),
 } as never);
 mockGetSignedUrl.mockResolvedValue('https://signed-url.com/photo.png');
 mockStorageBucket();

 const res = await GET(makeRequest('/api/assets/asset1'), makeCtx('asset1'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.asset.name).toBe('photo.png');
 expect(json.asset.url).toBe('https://signed-url.com/photo.png');
 expect(json.asset.downloadUrl).toBe('/api/storage/download?token=proxy-token');
 expect(json.asset.integrityStatus).toBe('ok');
 expect(mockCreateStorageProxyToken).toHaveBeenCalledWith(
 expect.objectContaining({
 objectPath: 'orgs/org123/photo.png',
 orgId: 'org123',
 fileName: 'photo.png',
 }),
 );
 });

 it('marks assets as thumbnail fallback when the original is missing', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.findOne).mockReturnValue({
 lean: () =>
 Promise.resolve({
 ...fakeAsset,
 thumbnailStorageKey: 'thumbs/photo.webp',
 }),
 } as never);
 mockGetSignedUrl.mockResolvedValue('https://signed-url.com/photo.png');
 mockStorageBucket(async (objectPath) => {
 if (objectPath === 'orgs/org123/photo.png') {
 const error = Object.assign(new Error('No such object'), { code: 404 });
 throw error;
 }
 return [{}];
 });

 const res = await GET(makeRequest('/api/assets/asset1'), makeCtx('asset1'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.asset.integrityStatus).toBe('thumbnail-fallback');
 expect(json.asset.originalExists).toBe(false);
 expect(json.asset.thumbnailExists).toBe(true);
 });
});

describe('PATCH /api/assets/[id]', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 400 when no valid fields provided', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);

 const req = makeRequest('/api/assets/asset1', {
 method: 'PATCH',
 body: JSON.stringify({}),
 headers: { 'Content-Type': 'application/json' },
 });

 const res = await PATCH(req, makeCtx('asset1'));
 expect(res.status).toBe(400);
 const json = await res.json();
 expect(json.error).toBe('No valid fields to update');
 });

 it('updates asset name successfully', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 const updatedAsset = { ...fakeAsset, name: 'renamed.png' };
 vi.mocked(Asset.findOneAndUpdate).mockReturnValue({
 lean: () => Promise.resolve(updatedAsset),
 } as never);
 mockGetSignedUrl.mockResolvedValue('https://signed-url.com');

 const req = makeRequest('/api/assets/asset1', {
 method: 'PATCH',
 body: JSON.stringify({ name: 'renamed.png' }),
 headers: { 'Content-Type': 'application/json' },
 });

 const res = await PATCH(req, makeCtx('asset1'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.asset.name).toBe('renamed.png');
 });

 it('trims and filters tags', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.findOneAndUpdate).mockReturnValue({
 lean: () => Promise.resolve({ ...fakeAsset, tags: ['nature', 'sunset'] }),
 } as never);
 mockGetSignedUrl.mockResolvedValue('https://signed-url.com');

 const req = makeRequest('/api/assets/asset1', {
 method: 'PATCH',
 body: JSON.stringify({ tags: [' nature ', '', ' sunset'] }),
 headers: { 'Content-Type': 'application/json' },
 });

 const res = await PATCH(req, makeCtx('asset1'));

 // Verify that findOneAndUpdate was called with trimmed, non-empty tags
 const updateCall = vi.mocked(Asset.findOneAndUpdate).mock.calls[0];
 const updateBody = updateCall[1] as { $set: { tags: string[] } };
 expect(updateBody.$set.tags).toEqual(['nature', 'sunset']);
 });
});

describe('DELETE /api/assets/[id]', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 404 when asset not found', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.findOneAndUpdate).mockReturnValue({
 lean: () => Promise.resolve(null),
 } as never);

 const res = await DELETE(
 makeRequest('/api/assets/asset1'),
 makeCtx('asset1'),
 );
 expect(res.status).toBe(404);
 });

 it('soft-deletes asset and returns trashedAt', async () => {
 const trashedDate = new Date();
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.findOneAndUpdate).mockReturnValue({
 lean: () =>
 Promise.resolve({
 ...fakeAsset,
 isDeleted: true,
 deletedAt: trashedDate,
 }),
 } as never);

 const res = await DELETE(
 makeRequest('/api/assets/asset1'),
 makeCtx('asset1'),
 );
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.success).toBe(true);
 expect(json.trashedAt).toBeDefined();
 });

 it('permanently deletes the asset when requested', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.findOneAndDelete).mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: () =>
 Promise.resolve({
 ...fakeAsset,
 thumbnailStorageKey: 'thumbs/photo.webp',
 variants: [{ storageKey: 'variants/photo.webp' }],
 }),
 }),
 } as never);
 const { deleteObject } = mockStorageBucket();

 const res = await DELETE(
 makeRequest('/api/assets/asset1?permanent=1'),
 makeCtx('asset1'),
 );
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.deletedPermanently).toBe(true);
 expect(vi.mocked(Asset.findOneAndDelete)).toHaveBeenCalled();
 expect(deleteObject).toHaveBeenCalledTimes(3);
 });
});
