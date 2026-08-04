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
 find: vi.fn(),
 updateMany: vi.fn(),
 },
 User: {
 findOne: vi.fn(),
 },
}));

vi.mock('@/lib/storage', () => ({}));

import { POST } from '@/app/api/assets/batch/route';
import { getSession } from '@/lib/session';
import { Asset, User } from '@/models';
import { NextRequest } from 'next/server';

const mockGetSession = vi.mocked(getSession);
const mockUserFindOne = vi.mocked(User.findOne);
const fakeUser = { email: 'test@imageman.dev', orgId: 'org123', _id: 'user1', role: 'editor' };

function makeRequest(body: object) {
 return new NextRequest(
 new URL('/api/assets/batch', 'http://localhost:3000'),
 {
 method: 'POST',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 },
 );
}

describe('POST /api/assets/batch', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 401 when not authenticated', async () => {
 mockGetSession.mockResolvedValue(null);
 const res = await POST(makeRequest({ action: 'delete', ids: ['a1'] }));
 expect(res.status).toBe(401);
 });

 it('returns 400 when no ids provided', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);

 const res = await POST(makeRequest({ action: 'delete', ids: [] }));
 expect(res.status).toBe(400);
 });

 it('returns 400 when ids exceed 100', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);

 const ids = Array.from({ length: 101 }, (_, i) => `id${i}`);
 const res = await POST(makeRequest({ action: 'delete', ids }));
 expect(res.status).toBe(400);
 const json = await res.json();
 expect(json.error).toBe('Maximum 100 assets per batch');
 });

 it('returns 400 for invalid action', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);

 const res = await POST(makeRequest({ action: 'invalid', ids: ['a1'] }));
 expect(res.status).toBe(400);
 });

 it('batch delete soft-deletes and returns deleted count', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);

 vi.mocked(Asset.updateMany).mockResolvedValue({
 modifiedCount: 2,
 } as never);

 const res = await POST(
 makeRequest({ action: 'delete', ids: ['a1', 'a2'] }),
 );
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.success).toBe(true);
 expect(json.deleted).toBe(2);
 });

 it('batch move updates folder', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.updateMany).mockResolvedValue({
 modifiedCount: 3,
 } as never);

 const res = await POST(
 makeRequest({
 action: 'move',
 ids: ['a1', 'a2', 'a3'],
 folderId: 'folder1',
 }),
 );
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.modified).toBe(3);
 });

 it('batch tag add uses $addToSet', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.updateMany).mockResolvedValue({
 modifiedCount: 2,
 } as never);

 const res = await POST(
 makeRequest({
 action: 'tag',
 ids: ['a1', 'a2'],
 tags: ['summer', 'beach'],
 mode: 'add',
 }),
 );
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.modified).toBe(2);

 // Verify $addToSet was used
 const updateArgs = vi.mocked(Asset.updateMany).mock.calls[0][1] as Record<
 string,
 unknown
 >;
 expect(updateArgs).toHaveProperty('$addToSet');
 });

 it('batch tag remove uses $pullAll', async () => {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
 vi.mocked(Asset.updateMany).mockResolvedValue({
 modifiedCount: 1,
 } as never);

 const res = await POST(
 makeRequest({
 action: 'tag',
 ids: ['a1'],
 tags: ['old-tag'],
 mode: 'remove',
 }),
 );

 const updateArgs = vi.mocked(Asset.updateMany).mock.calls[0][1] as Record<
 string,
 unknown
 >;
 expect(updateArgs).toHaveProperty('$pullAll');
 });
});
