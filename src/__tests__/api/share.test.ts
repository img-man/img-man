// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────
const {
 mockShareLinkFind,
 mockShareLinkCreate,
 mockAssetCountDocuments,
 mockAssetFindById,
 mockFolderCountDocuments,
 mockFolderFindById,
 mockRequirePerm,
} = vi.hoisted(() => ({
 mockShareLinkFind: vi.fn(),
 mockShareLinkCreate: vi.fn(),
 mockAssetCountDocuments: vi.fn(),
 mockAssetFindById: vi.fn(),
 mockFolderCountDocuments: vi.fn(),
 mockFolderFindById: vi.fn(),
 mockRequirePerm: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
 getSession: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
 default: {
 hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
 compare: vi.fn(),
 },
}));

vi.mock('@/models', () => ({
 ShareLink: {
 find: mockShareLinkFind,
 create: mockShareLinkCreate,
 findOne: vi.fn(),
 },
 Asset: {
 countDocuments: mockAssetCountDocuments,
 findById: mockAssetFindById,
 },
 Folder: {
 countDocuments: mockFolderCountDocuments,
 findById: mockFolderFindById,
 },
 User: {
 findOne: vi.fn(),
 },
 OrgMembership: {
 findOne: vi.fn(),
 },
}));

vi.mock('@/lib/auth-context', () => ({
 requirePermission: mockRequirePerm,
}));

import { GET, POST } from '@/app/api/share/route';
import { NextRequest } from 'next/server';

const editorCtx = {
 userId: 'u2',
 email: 'editor@test.com',
 name: 'Editor',
 orgId: 'org1',
 role: 'editor' as const,
};

function makePostRequest(body: object) {
 return new NextRequest(
 new URL('/api/share', 'http://localhost:3000'),
 {
 method: 'POST',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 },
 );
}

describe('GET /api/share', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 401 when not authenticated', async () => {
 mockRequirePerm.mockRejectedValue({ status: 401, error: 'Unauthorized' });
 const res = await GET();
 expect(res.status).toBe(401);
 });

 it('returns 403 for viewer', async () => {
 mockRequirePerm.mockRejectedValue({
 status: 403,
 error: 'Insufficient permissions',
 });
 const res = await GET();
 expect(res.status).toBe(403);
 });

 it('returns share links list for authorized user', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 mockShareLinkFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: () =>
 Promise.resolve([
 {
 _id: 'link1',
 token: 'abc123',
 targetType: 'asset',
 targetId: 'asset1',
 targetIds: ['asset1'],
 permission: 'view',
 includeNested: true,
 password: null,
 expiresAt: null,
 isActive: true,
 accessCount: 5,
 maxDownloads: null,
 lastAccessedAt: null,
 allowedEmails: [],
 createdAt: new Date(),
 },
 ]),
 }),
 });

 // Mock enrichment — new route uses Asset.findById().select().lean()
 mockAssetFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: () =>
 Promise.resolve({ name: 'test-image.png', originalName: 'test-image.png' }),
 }),
 });

 const res = await GET();
 const json = await res.json();

 expect(res.status).toBe(200);
 expect(json.links).toHaveLength(1);
 expect(json.links[0].token).toBe('abc123');
 expect(json.links[0].targetName).toBe('test-image.png');
 expect(json.links[0].hasPassword).toBe(false);
 });
});

describe('POST /api/share', () => {
 beforeEach(() => vi.clearAllMocks());

 it('returns 401 when not authenticated', async () => {
 mockRequirePerm.mockRejectedValue({ status: 401, error: 'Unauthorized' });
 const res = await POST(
 makePostRequest({
 targetType: 'asset',
 targetId: 'a1',
 }),
 );
 expect(res.status).toBe(401);
 });

 it('returns 400 for invalid targetType', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 const res = await POST(
 makePostRequest({
 targetType: 'invalid',
 targetId: 'a1',
 }),
 );
 expect(res.status).toBe(400);
 });

 it('returns 400 when targetId is missing', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 const res = await POST(
 makePostRequest({
 targetType: 'asset',
 }),
 );
 expect(res.status).toBe(400);
 });

 it('returns 400 for invalid permission', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 const res = await POST(
 makePostRequest({
 targetType: 'asset',
 targetId: 'a1',
 permission: 'superadmin',
 }),
 );
 expect(res.status).toBe(400);
 });

 it('returns 404 when asset does not exist', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 mockAssetCountDocuments.mockResolvedValue(0);
 const res = await POST(
 makePostRequest({
 targetType: 'asset',
 targetId: 'nonexistent',
 }),
 );
 expect(res.status).toBe(404);
 });

 it('returns 404 when folder does not exist', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 mockFolderCountDocuments.mockResolvedValue(0);
 const res = await POST(
 makePostRequest({
 targetType: 'folder',
 targetId: 'nonexistent',
 }),
 );
 expect(res.status).toBe(404);
 });

 it('creates share link for asset successfully', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 mockAssetCountDocuments.mockResolvedValue(1);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'link1',
 token: 'generated-token',
 });

 const res = await POST(
 makePostRequest({
 targetType: 'asset',
 targetId: 'a1',
 permission: 'view',
 expiresIn: '7d',
 }),
 );
 const json = await res.json();

 expect(res.status).toBe(201);
 expect(json.link.targetType).toBe('asset');
 expect(json.link.permission).toBe('view');
 expect(json.link.shareUrl).toContain('/s/');
 expect(json.link.expiresAt).toBeTruthy();
 });

 it('creates share link with password', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 mockAssetCountDocuments.mockResolvedValue(1);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'link2',
 token: 'pwd-token',
 });

 const res = await POST(
 makePostRequest({
 targetType: 'asset',
 targetId: 'a1',
 password: 'mySecret123',
 }),
 );
 const json = await res.json();

 expect(res.status).toBe(201);
 expect(json.link.hasPassword).toBe(true);
 });

 it('creates share link with no expiry', async () => {
 mockRequirePerm.mockResolvedValue(editorCtx);
 mockFolderCountDocuments.mockResolvedValue(1);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'link3',
 token: 'no-exp-token',
 });

 const res = await POST(
 makePostRequest({
 targetType: 'folder',
 targetId: 'f1',
 expiresIn: 'never',
 }),
 );
 const json = await res.json();

 expect(res.status).toBe(201);
 expect(json.link.expiresAt).toBeNull();
 });
});
