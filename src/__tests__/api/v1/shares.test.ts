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

vi.mock('bcryptjs', () => ({
 default: {
 hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
 compare: vi.fn(),
 },
}));

vi.mock('crypto', () => ({
 default: {
 randomBytes: vi.fn().mockReturnValue({
 toString: vi.fn().mockReturnValue('abcdef1234567890abcdef1234567890'),
 }),
 },
 randomBytes: vi.fn().mockReturnValue({
 toString: vi.fn().mockReturnValue('abcdef1234567890abcdef1234567890'),
 }),
}));

vi.mock('@/models', () => ({
 ShareLink: {
 find: vi.fn(),
 create: vi.fn(),
 findOne: vi.fn(),
 countDocuments: vi.fn(),
 },
 Asset: {
 findById: vi.fn(),
 find: vi.fn(),
 countDocuments: vi.fn(),
 },
 Folder: {
 findById: vi.fn(),
 findOne: vi.fn(),
 countDocuments: vi.fn(),
 },
 OrgMembership: {
 find: vi.fn(),
 countDocuments: vi.fn(),
 },
 MemberGroup: {
 find: vi.fn(),
 countDocuments: vi.fn(),
 },
}));

import { GET, POST } from '@/app/api/v1/shares/route';
import { authenticateApiRequest } from '@/lib/api-auth';
import { ShareLink, Asset, Folder } from '@/models';
import { NextRequest } from 'next/server';

const mockAuth = vi.mocked(authenticateApiRequest) as unknown as ReturnType<typeof vi.fn>;
const mockShareFind = vi.mocked(ShareLink.find) as unknown as ReturnType<typeof vi.fn>;
const mockShareCount = vi.mocked(ShareLink.countDocuments) as unknown as ReturnType<typeof vi.fn>;
const mockShareCreate = vi.mocked(ShareLink.create) as unknown as ReturnType<typeof vi.fn>;
const mockAssetFindById = vi.mocked(Asset.findById) as unknown as ReturnType<typeof vi.fn>;
const mockFolderFindById = vi.mocked(Folder.findById) as unknown as ReturnType<typeof vi.fn>;

import { OrgMembership, MemberGroup } from '@/models';
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

function makeGetReq(params?: Record<string, string>): NextRequest {
 const url = new URL('http://localhost/api/v1/shares');
 if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
 return new NextRequest(url);
}

function makePostReq(body: Record<string, unknown>): NextRequest {
 return new NextRequest(new URL('http://localhost/api/v1/shares'), {
 method: 'POST',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 } as never);
}

describe('V1 Shares API', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockAuth.mockResolvedValue(AUTH_CTX);
 });

 describe('GET /api/v1/shares', () => {
 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(
 NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
 );
 const res = await GET(makeGetReq());
 expect(res.status).toBe(401);
 });

 it('returns paginated share links', async () => {
 const mockLinks = [
 {
 _id: 's1',
 token: 'tok1',
 targetType: 'folder',
 targetId: 'f1',
 targetIds: [],
 permission: 'view',
 includeNested: true,
 password: null,
 expiresAt: null,
 isActive: true,
 accessCount: 3,
 maxDownloads: null,
 lastAccessedAt: null,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 },
 ];
 mockShareFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(mockLinks),
 }),
 }),
 }),
 });
 mockShareCount.mockResolvedValue(1);
 mockFolderFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue({ name: 'Wedding Album' }),
 }),
 });

 const res = await GET(makeGetReq());
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.shares).toHaveLength(1);
 expect(data.shares[0].token).toBe('tok1');
 expect(data.shares[0].targetName).toBe('Wedding Album');
 expect(data.total).toBe(1);
 });

 it('handles empty results', async () => {
 mockShareFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 }),
 }),
 });
 mockShareCount.mockResolvedValue(0);

 const res = await GET(makeGetReq());
 const data = await res.json();

 expect(data.shares).toHaveLength(0);
 expect(data.total).toBe(0);
 });

 it('filters by targetType', async () => {
 mockShareFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 skip: vi.fn().mockReturnValue({
 limit: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 }),
 }),
 }),
 });
 mockShareCount.mockResolvedValue(0);

 await GET(makeGetReq({ targetType: 'asset' }));

 expect(mockShareFind).toHaveBeenCalledWith(
 expect.objectContaining({ targetType: 'asset' }),
 );
 });
 });

 describe('POST /api/v1/shares', () => {
 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(
 NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
 );
 const res = await POST(makePostReq({ targetType: 'folder', targetId: 'f1' }));
 expect(res.status).toBe(401);
 });

 it('returns 400 when targetType is missing', async () => {
 const res = await POST(makePostReq({}));
 expect(res.status).toBe(400);
 });

 it('returns 400 when targetId is missing for non-root type', async () => {
 const res = await POST(makePostReq({ targetType: 'folder' }));
 expect(res.status).toBe(400);
 });

 it('returns 400 for invalid permission', async () => {
 const res = await POST(makePostReq({ targetType: 'folder', targetId: 'f1', permission: 'superadmin' }));
 expect(res.status).toBe(400);
 });

 it('returns 404 when folder target not found', async () => {
 const { countDocuments: mockFolderCount } = await import('@/models').then(m => m.Folder);
 (mockFolderCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);

 const res = await POST(makePostReq({ targetType: 'folder', targetId: 'f1' }));
 expect(res.status).toBe(404);
 });

 it('returns 404 when asset target not found', async () => {
 const { countDocuments: mockAssetCount } = await import('@/models').then(m => m.Asset);
 (mockAssetCount as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

 const res = await POST(makePostReq({ targetType: 'asset', targetId: 'a1' }));
 expect(res.status).toBe(404);
 });

 it('creates root share without targetId', async () => {
 mockShareCreate.mockResolvedValue({
 _id: 'new1',
 token: 'abcdef1234567890abcdef1234567890',
 targetType: 'root',
 targetId: null,
 targetIds: [],
 permission: 'view',
 includeNested: true,
 expiresAt: null,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 });

 const res = await POST(makePostReq({ targetType: 'root' }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.share.token).toBeDefined();
 expect(data.share.targetType).toBe('root');
 expect(data.share.shareUrl).toContain('/s/');
 });

 it('creates folder share with expiration and password', async () => {
 const { countDocuments: mockFolderCount } = await import('@/models').then(m => m.Folder);
 (mockFolderCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

 mockShareCreate.mockResolvedValue({
 _id: 'new2',
 token: 'abcdef1234567890abcdef1234567890',
 targetType: 'folder',
 targetId: 'f1',
 targetIds: ['f1'],
 permission: 'edit',
 includeNested: true,
 expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
 password: '$2b$10$hashedpassword',
 allowedEmails: ['a@b.com'],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 });

 const res = await POST(makePostReq({
 targetType: 'folder',
 targetId: 'f1',
 permission: 'edit',
 expiresIn: '7d',
 password: 'secret123',
 allowedEmails: ['a@b.com'],
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.share.hasPassword).toBe(true);
 expect(data.share.permission).toBe('edit');
 });

 it('creates asset share with targetIds array', async () => {
 const { countDocuments: mockAssetCount } = await import('@/models').then(m => m.Asset);
 (mockAssetCount as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(2);

 mockShareCreate.mockResolvedValue({
 _id: 'new3',
 token: 'abcdef1234567890abcdef1234567890',
 targetType: 'asset',
 targetId: 'a1',
 targetIds: ['a1', 'a2'],
 permission: 'view',
 includeNested: false,
 expiresAt: null,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 });

 const res = await POST(makePostReq({
 targetType: 'asset',
 targetIds: ['a1', 'a2'],
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.share.targetIds).toEqual(['a1', 'a2']);
 });

 it('returns 400 for invalid allowedMemberIds', async () => {
 const { countDocuments: mockFolderCount } = await import('@/models').then(m => m.Folder);
 (mockFolderCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
 mockOrgMemberCount.mockResolvedValue(0); // none valid

 const res = await POST(makePostReq({
 targetType: 'folder',
 targetId: 'f1',
 allowedMemberIds: ['m1', 'm2'],
 }));
 expect(res.status).toBe(400);
 });

 it('returns 400 for invalid allowedGroupIds', async () => {
 const { countDocuments: mockFolderCount } = await import('@/models').then(m => m.Folder);
 (mockFolderCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);
 mockOrgMemberCount.mockResolvedValue(0);
 mockMemberGroupCount.mockResolvedValue(0); // none valid

 const res = await POST(makePostReq({
 targetType: 'folder',
 targetId: 'f1',
 allowedGroupIds: ['g1'],
 }));
 expect(res.status).toBe(400);
 });

 it('creates share with valid members and groups', async () => {
 const { countDocuments: mockAssetCount } = await import('@/models').then(m => m.Asset);
 (mockAssetCount as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
 mockOrgMemberCount.mockResolvedValue(2);
 mockMemberGroupCount.mockResolvedValue(1);

 mockShareCreate.mockResolvedValue({
 _id: 'new4',
 token: 'abcdef1234567890abcdef1234567890',
 targetType: 'asset',
 targetId: 'a1',
 targetIds: ['a1'],
 permission: 'view',
 includeNested: false,
 expiresAt: null,
 allowedEmails: [],
 allowedMemberIds: ['m1', 'm2'],
 allowedGroupIds: ['g1'],
 createdAt: '2024-01-01',
 });

 const res = await POST(makePostReq({
 targetType: 'asset',
 targetId: 'a1',
 allowedMemberIds: ['m1', 'm2'],
 allowedGroupIds: ['g1'],
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.share.allowedMemberIds).toEqual(['m1', 'm2']);
 expect(data.share.allowedGroupIds).toEqual(['g1']);
 });

 it('creates share with 1h expiration', async () => {
 const { countDocuments: mockAssetCount } = await import('@/models').then(m => m.Asset);
 (mockAssetCount as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);

 mockShareCreate.mockResolvedValue({
 _id: 'new5',
 token: 'abcdef1234567890abcdef1234567890',
 targetType: 'asset',
 targetId: 'a1',
 targetIds: ['a1'],
 permission: 'view',
 includeNested: true,
 expiresAt: new Date(Date.now() + 3600 * 1000),
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 });

 const res = await POST(makePostReq({
 targetType: 'asset',
 targetId: 'a1',
 expiresIn: '1h',
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.share.expiresAt).toBeDefined();
 });

 it('handles folderScope on auth context', async () => {
 // Auth with folder scope
 mockAuth.mockResolvedValue({
 ...AUTH_CTX,
 folderScope: 'scoped-folder-id',
 });

 const { countDocuments: mockAssetCount } = await import('@/models').then(m => m.Asset);
 (mockAssetCount as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);

 mockShareCreate.mockResolvedValue({
 _id: 'new6',
 token: 'abcdef1234567890abcdef1234567890',
 targetType: 'asset',
 targetId: 'a1',
 targetIds: ['a1'],
 permission: 'view',
 includeNested: true,
 expiresAt: null,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 });

 const res = await POST(makePostReq({
 targetType: 'asset',
 targetId: 'a1',
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.share).toBeDefined();
 });

 it('handles folderScope for folder target type', async () => {
 mockAuth.mockResolvedValue({
 ...AUTH_CTX,
 folderScope: 'scoped-folder-id',
 });

 const { countDocuments: mockFolderCount } = await import('@/models').then(m => m.Folder);
 (mockFolderCount as ReturnType<typeof vi.fn>).mockResolvedValue(1);

 mockShareCreate.mockResolvedValue({
 _id: 'new7',
 token: 'abcdef1234567890abcdef1234567890',
 targetType: 'folder',
 targetId: 'f1',
 targetIds: ['f1'],
 permission: 'view',
 includeNested: true,
 expiresAt: null,
 allowedEmails: [],
 allowedMemberIds: [],
 allowedGroupIds: [],
 createdAt: '2024-01-01',
 });

 const res = await POST(makePostReq({
 targetType: 'folder',
 targetId: 'f1',
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.share).toBeDefined();
 });

 it('returns 404 when folder scope check fails for asset', async () => {
 mockAuth.mockResolvedValue({
 ...AUTH_CTX,
 folderScope: 'scoped-folder-id',
 });

 const { countDocuments: mockAssetCount } = await import('@/models').then(m => m.Asset);
 (mockAssetCount as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(0);

 const res = await POST(makePostReq({
 targetType: 'asset',
 targetId: 'a1',
 }));
 expect(res.status).toBe(404);
 });

 it('returns 404 when folder scope check fails for folder', async () => {
 mockAuth.mockResolvedValue({
 ...AUTH_CTX,
 folderScope: 'scoped-folder-id',
 });

 const { countDocuments: mockFolderCount } = await import('@/models').then(m => m.Folder);
 (mockFolderCount as ReturnType<typeof vi.fn>).mockResolvedValue(0);

 const res = await POST(makePostReq({
 targetType: 'folder',
 targetId: 'f1',
 }));
 expect(res.status).toBe(404);
 });
 });
});
