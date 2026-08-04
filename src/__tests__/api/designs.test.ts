// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/session', () => ({
 getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
 isSectionRestricted: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/models', () => ({
 Design: {
 find: vi.fn(),
 findOne: vi.fn(),
 findOneAndUpdate: vi.fn(),
 findOneAndDelete: vi.fn(),
 countDocuments: vi.fn(),
 create: vi.fn(),
 },
 User: {
 findOne: vi.fn(),
 },
}));

import { GET, POST } from '@/app/api/designs/route';
import { GET as GET_BY_ID, PATCH, DELETE } from '@/app/api/designs/[id]/route';
import { getSession } from '@/lib/session';
import { Design, User } from '@/models';
import { NextRequest } from 'next/server';

const mockGetSession = vi.mocked(getSession);
const mockUserFindOne = vi.mocked(User.findOne);

function makeRequest(url: string, init?: Record<string, unknown>) {
 return new NextRequest(new URL(url, 'http://localhost:3000'), init as never);
}

function makeCtx(id: string) {
 return { params: Promise.resolve({ id }) };
}

const fakeUser = { email: 'test@imageman.dev', orgId: 'org123', _id: 'user1' };

const fakeDesign = {
 _id: 'd1',
 name: 'Instagram Post',
 width: 1080,
 height: 1080,
 jsonState: { pages: [] },
 orgId: 'org123',
 createdById: 'user1',
 createdAt: '2025-01-01T00:00:00Z',
 updatedAt: '2025-01-01T00:00:00Z',
};

function mockAuth() {
 mockGetSession.mockResolvedValue({
 user: { id: 'user1', email: 'test@imageman.dev' },
 expires: '2099-01-01',
 });
 mockUserFindOne.mockReturnValue({
 lean: () => Promise.resolve(fakeUser),
 } as never);
}

describe('GET /api/designs', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 401 when not authenticated', async () => {
 mockGetSession.mockResolvedValue(null);
 const res = await GET(makeRequest('/api/designs'));
 expect(res.status).toBe(401);
 });

 it('returns paginated designs list', async () => {
 mockAuth();
 const chainMock = {
 select: vi.fn().mockReturnThis(),
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([fakeDesign]),
 };
 vi.mocked(Design.find).mockReturnValue(chainMock as never);
 vi.mocked(Design.countDocuments).mockResolvedValue(1 as never);

 const res = await GET(makeRequest('/api/designs'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.designs).toHaveLength(1);
 expect(json.total).toBe(1);
 expect(json.page).toBe(1);
 });

 it('excludes jsonState from list view', async () => {
 mockAuth();
 const chainMock = {
 select: vi.fn().mockReturnThis(),
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([]),
 };
 vi.mocked(Design.find).mockReturnValue(chainMock as never);
 vi.mocked(Design.countDocuments).mockResolvedValue(0 as never);

 await GET(makeRequest('/api/designs'));

 expect(chainMock.select).toHaveBeenCalledWith('-jsonState');
 });

 it('applies search filter when q param provided', async () => {
 mockAuth();
 const chainMock = {
 select: vi.fn().mockReturnThis(),
 sort: vi.fn().mockReturnThis(),
 skip: vi.fn().mockReturnThis(),
 limit: vi.fn().mockReturnThis(),
 lean: vi.fn().mockResolvedValue([]),
 };
 vi.mocked(Design.find).mockReturnValue(chainMock as never);
 vi.mocked(Design.countDocuments).mockResolvedValue(0 as never);

 await GET(makeRequest('/api/designs?q=Instagram'));

 const findArgs = vi.mocked(Design.find).mock
 .calls[0][0] as unknown as Record<string, unknown>;
 expect(findArgs.name).toEqual({ $regex: 'Instagram', $options: 'i' });
 });
});

describe('POST /api/designs', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 400 when name is empty', async () => {
 mockAuth();
 const req = makeRequest('/api/designs', {
 method: 'POST',
 body: JSON.stringify({ name: '', width: 1080, height: 1080 }),
 headers: { 'Content-Type': 'application/json' },
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 });

 it('returns 400 when dimensions invalid', async () => {
 mockAuth();
 const req = makeRequest('/api/designs', {
 method: 'POST',
 body: JSON.stringify({ name: 'Test', width: 0, height: 1080 }),
 headers: { 'Content-Type': 'application/json' },
 });
 const res = await POST(req);
 expect(res.status).toBe(400);
 });

 it('creates design with correct fields', async () => {
 mockAuth();
 vi.mocked(Design.create).mockResolvedValue(fakeDesign as never);

 const req = makeRequest('/api/designs', {
 method: 'POST',
 body: JSON.stringify({
 name: 'Instagram Post',
 width: 1080,
 height: 1080,
 }),
 headers: { 'Content-Type': 'application/json' },
 });
 const res = await POST(req);
 const json = await res.json();

 expect(res.status).toBe(201);
 expect(json.design.name).toBe('Instagram Post');
 // Verify create was called with correct orgId
 const createArgs = vi.mocked(Design.create).mock.calls[0][0] as Record<
 string,
 unknown
 >;
 expect(createArgs.orgId).toBe('org123');
 expect(createArgs.width).toBe(1080);
 });
});

describe('GET /api/designs/:id', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 404 when design not found', async () => {
 mockAuth();
 vi.mocked(Design.findOne).mockReturnValue({
 lean: () => Promise.resolve(null),
 } as never);

 const res = await GET_BY_ID(makeRequest('/api/designs/d1'), makeCtx('d1'));
 expect(res.status).toBe(404);
 });

 it('returns full design with jsonState', async () => {
 mockAuth();
 vi.mocked(Design.findOne).mockReturnValue({
 lean: () => Promise.resolve(fakeDesign),
 } as never);

 const res = await GET_BY_ID(makeRequest('/api/designs/d1'), makeCtx('d1'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.design.jsonState).toEqual({ pages: [] });
 expect(json.design.name).toBe('Instagram Post');
 });
});

describe('PATCH /api/designs/:id', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 400 when no valid fields', async () => {
 mockAuth();
 const req = makeRequest('/api/designs/d1', {
 method: 'PATCH',
 body: JSON.stringify({}),
 headers: { 'Content-Type': 'application/json' },
 });
 const res = await PATCH(req, makeCtx('d1'));
 expect(res.status).toBe(400);
 });

 it('updates jsonState (save canvas)', async () => {
 mockAuth();
 const newState = { pages: [{ id: 'p1' }] };
 vi.mocked(Design.findOneAndUpdate).mockReturnValue({
 lean: () => Promise.resolve({ ...fakeDesign, jsonState: newState }),
 } as never);

 const req = makeRequest('/api/designs/d1', {
 method: 'PATCH',
 body: JSON.stringify({ jsonState: newState }),
 headers: { 'Content-Type': 'application/json' },
 });
 const res = await PATCH(req, makeCtx('d1'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.design.jsonState).toEqual(newState);
 });

 it('updates name', async () => {
 mockAuth();
 vi.mocked(Design.findOneAndUpdate).mockReturnValue({
 lean: () => Promise.resolve({ ...fakeDesign, name: 'Renamed' }),
 } as never);

 const req = makeRequest('/api/designs/d1', {
 method: 'PATCH',
 body: JSON.stringify({ name: 'Renamed' }),
 headers: { 'Content-Type': 'application/json' },
 });
 const res = await PATCH(req, makeCtx('d1'));
 const json = await res.json();

 expect(json.design.name).toBe('Renamed');
 });
});

describe('DELETE /api/designs/:id', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 404 when design not found', async () => {
 mockAuth();
 vi.mocked(Design.findOneAndDelete).mockReturnValue({
 lean: () => Promise.resolve(null),
 } as never);

 const res = await DELETE(makeRequest('/api/designs/d1'), makeCtx('d1'));
 expect(res.status).toBe(404);
 });

 it('deletes and returns success', async () => {
 mockAuth();
 vi.mocked(Design.findOneAndDelete).mockReturnValue({
 lean: () => Promise.resolve(fakeDesign),
 } as never);

 const res = await DELETE(makeRequest('/api/designs/d1'), makeCtx('d1'));
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.success).toBe(true);
 });
});
