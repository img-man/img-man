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
 };
});

vi.mock('bcryptjs', () => ({
 default: { hash: vi.fn().mockResolvedValue('$2b$10$hashed') },
 hash: vi.fn().mockResolvedValue('$2b$10$hashed'),
}));

vi.mock('@/models', () => ({
 ShareLink: {
 findOne: vi.fn(),
 findOneAndUpdate: vi.fn(),
 },
 Asset: {
 findById: vi.fn(),
 },
 Folder: {
 findById: vi.fn(),
 },
 OrgMembership: {
 countDocuments: vi.fn(),
 },
 MemberGroup: {
 countDocuments: vi.fn(),
 },
}));

import { GET, PATCH, DELETE } from '@/app/api/v1/shares/[token]/route';
import { authenticateApiRequest } from '@/lib/api-auth';
import { ShareLink, Asset, Folder, OrgMembership, MemberGroup } from '@/models';
import { NextRequest } from 'next/server';

const mockAuth = vi.mocked(authenticateApiRequest) as unknown as ReturnType<typeof vi.fn>;
const mockShareFindOne = vi.mocked(ShareLink.findOne) as unknown as ReturnType<typeof vi.fn>;
const mockShareFindOneAndUpdate = vi.mocked(ShareLink.findOneAndUpdate) as unknown as ReturnType<typeof vi.fn>;
const mockAssetFindById = vi.mocked(Asset.findById) as unknown as ReturnType<typeof vi.fn>;
const mockFolderFindById = vi.mocked(Folder.findById) as unknown as ReturnType<typeof vi.fn>;
const mockOrgMemberCount = vi.mocked(OrgMembership.countDocuments) as unknown as ReturnType<typeof vi.fn>;
const mockMemberGroupCount = vi.mocked(MemberGroup.countDocuments) as unknown as ReturnType<typeof vi.fn>;

const AUTH_CTX = {
 keyId: 'key1',
 orgId: 'org1',
 keyName: 'Test',
 permissions: ['read', 'write'] as ('read' | 'write')[],
 allowedDomains: [] as string[],
 rateLimit: 60,
 folderScope: undefined,
};

function makeReq(method = 'GET', body?: Record<string, unknown>): NextRequest {
 const init: RequestInit = { method };
 if (body) {
 init.body = JSON.stringify(body);
 init.headers = { 'Content-Type': 'application/json' };
 }
 return new NextRequest(new URL('http://localhost/api/v1/shares/tok123'), init as never);
}

const CTX = { params: Promise.resolve({ token: 'tok123' }) };

/* ─── Tests ──────────────────────────────────────────────────── */

describe('V1 Shares [token] API', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockAuth.mockResolvedValue(AUTH_CTX);
 });

 /* ─── GET ─────────────────────────────────────────── */

 describe('GET /api/v1/shares/[token]', () => {
 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
 const res = await GET(makeReq(), CTX);
 expect(res.status).toBe(401);
 });

 it('returns 404 when share link not found', async () => {
 mockShareFindOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
 const res = await GET(makeReq(), CTX);
 expect(res.status).toBe(404);
 });

 it('returns share with folder target name', async () => {
 mockShareFindOne.mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 _id: 's1',
 token: 'tok123',
 targetType: 'folder',
 targetId: 'f1',
 targetIds: ['f1'],
 permission: 'view',
 includeNested: true,
 password: null,
 expiresAt: null,
 isActive: true,
 accessCount: 5,
 maxDownloads: null,
 lastAccessedAt: null,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 updatedAt: '2024-01-01',
 }),
 });
 mockFolderFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue({ name: 'Wedding Album' }),
 }),
 });

 const res = await GET(makeReq(), CTX);
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.share.token).toBe('tok123');
 expect(data.share.targetName).toBe('Wedding Album');
 expect(data.share.hasPassword).toBe(false);
 });

 it('returns share with asset target name', async () => {
 mockShareFindOne.mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 _id: 's2',
 token: 'tok123',
 targetType: 'asset',
 targetId: 'a1',
 targetIds: ['a1'],
 permission: 'view',
 includeNested: false,
 password: 'hashedpw',
 expiresAt: null,
 isActive: true,
 accessCount: 0,
 maxDownloads: 10,
 lastAccessedAt: null,
 allowedEmails: ['test@example.com'],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 updatedAt: '2024-01-01',
 }),
 });
 mockAssetFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue({ name: 'photo.jpg' }),
 }),
 });

 const res = await GET(makeReq(), CTX);
 const data = await res.json();

 expect(data.share.targetName).toBe('photo.jpg');
 expect(data.share.hasPassword).toBe(true);
 expect(data.share.maxDownloads).toBe(10);
 });

 it('returns "Entire Organization" for root shares', async () => {
 mockShareFindOne.mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 _id: 's3',
 token: 'tok123',
 targetType: 'root',
 targetId: null,
 targetIds: [],
 permission: 'view',
 includeNested: true,
 password: null,
 expiresAt: null,
 isActive: true,
 accessCount: 0,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 updatedAt: '2024-01-01',
 }),
 });

 const res = await GET(makeReq(), CTX);
 const data = await res.json();
 expect(data.share.targetName).toBe('Entire Organization');
 });

 it('handles multiple asset targetIds', async () => {
 mockShareFindOne.mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 _id: 's4',
 token: 'tok123',
 targetType: 'asset',
 targetId: null,
 targetIds: ['a1', 'a2', 'a3'],
 permission: 'view',
 includeNested: false,
 password: null,
 expiresAt: null,
 isActive: true,
 accessCount: 0,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 updatedAt: '2024-01-01',
 }),
 });

 const res = await GET(makeReq(), CTX);
 const data = await res.json();
 expect(data.share.targetName).toBe('3 assets');
 expect(data.share.targetIds).toEqual(['a1', 'a2', 'a3']);
 });
 });

 /* ─── PATCH ───────────────────────────────────────── */

 describe('PATCH /api/v1/shares/[token]', () => {
 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
 const res = await PATCH(makeReq('PATCH', { isActive: false }), CTX);
 expect(res.status).toBe(401);
 });

 it('returns 404 when share not found', async () => {
 mockShareFindOne.mockResolvedValue(null);
 const res = await PATCH(makeReq('PATCH', { isActive: false }), CTX);
 expect(res.status).toBe(404);
 });

 it('returns 400 for invalid permission value', async () => {
 const mockLink = {
 _id: 's1', token: 'tok123', permission: 'view',
 allowedEmails: [], allowedMemberIds: [], allowedGroupIds: [],
 save: vi.fn(),
 };
 mockShareFindOne.mockResolvedValue(mockLink);

 const res = await PATCH(makeReq('PATCH', { permission: 'superadmin' }), CTX);
 expect(res.status).toBe(400);
 const data = await res.json();
 expect(data.code).toBe('VALIDATION_ERROR');
 });

 it('updates permission and expiration', async () => {
 const mockLink = {
 _id: 's1', token: 'tok123', permission: 'view',
 expiresAt: undefined, password: undefined,
 includeNested: true, isActive: true,
 allowedEmails: [], allowedMemberIds: [], allowedGroupIds: [],
 maxDownloads: undefined, updatedAt: '2024-01-02',
 save: vi.fn(),
 };
 mockShareFindOne.mockResolvedValue(mockLink);

 const res = await PATCH(makeReq('PATCH', {
 permission: 'edit',
 expiresAt: '2025-12-31T00:00:00Z',
 }), CTX);
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.share.permission).toBe('edit');
 expect(mockLink.save).toHaveBeenCalled();
 });

 it('sets and removes password', async () => {
 const mockLink = {
 _id: 's1', token: 'tok123', permission: 'view',
 password: undefined,
 allowedEmails: [], allowedMemberIds: [], allowedGroupIds: [],
 save: vi.fn(), updatedAt: '2024-01-02',
 };
 mockShareFindOne.mockResolvedValue(mockLink);

 // Set password
 const res1 = await PATCH(makeReq('PATCH', { password: 'secret' }), CTX);
 const data1 = await res1.json();
 expect(data1.share.hasPassword).toBe(true);

 // Remove password
 (mockLink as Record<string, unknown>).password = '$2b$10$hashed';
 const res2 = await PATCH(makeReq('PATCH', { password: null }), CTX);
 const data2 = await res2.json();
 expect(data2.share.hasPassword).toBe(false);
 });

 it('validates allowedMemberIds', async () => {
 const mockLink = {
 _id: 's1', token: 'tok123', permission: 'view',
 allowedEmails: [], allowedMemberIds: [], allowedGroupIds: [],
 save: vi.fn(), updatedAt: '2024-01-02',
 };
 mockShareFindOne.mockResolvedValue(mockLink);
 mockOrgMemberCount.mockResolvedValue(0); // none valid

 const res = await PATCH(makeReq('PATCH', { allowedMemberIds: ['m1', 'm2'] }), CTX);
 expect(res.status).toBe(400);
 });

 it('validates allowedGroupIds', async () => {
 const mockLink = {
 _id: 's1', token: 'tok123', permission: 'view',
 allowedEmails: [], allowedMemberIds: [], allowedGroupIds: [],
 save: vi.fn(), updatedAt: '2024-01-02',
 };
 mockShareFindOne.mockResolvedValue(mockLink);
 mockMemberGroupCount.mockResolvedValue(0); // none valid

 const res = await PATCH(makeReq('PATCH', { allowedGroupIds: ['g1'] }), CTX);
 expect(res.status).toBe(400);
 });
 });

 /* ─── DELETE ──────────────────────────────────────── */

 describe('DELETE /api/v1/shares/[token]', () => {
 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
 const res = await DELETE(makeReq('DELETE'), CTX);
 expect(res.status).toBe(401);
 });

 it('returns 404 when share not found', async () => {
 mockShareFindOneAndUpdate.mockResolvedValue(null);
 const res = await DELETE(makeReq('DELETE'), CTX);
 expect(res.status).toBe(404);
 });

 it('deactivates share and returns success', async () => {
 mockShareFindOneAndUpdate.mockResolvedValue({
 _id: 's1', token: 'tok123', isActive: false,
 });

 const res = await DELETE(makeReq('DELETE'), CTX);
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.success).toBe(true);
 expect(data.share.isActive).toBe(false);
 expect(mockShareFindOneAndUpdate).toHaveBeenCalledWith(
 { token: 'tok123', orgId: 'org1' },
 { isActive: false },
 { new: true },
 );
 });
 });
});
