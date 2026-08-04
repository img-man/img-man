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

vi.mock('bcryptjs', () => ({
 default: {
 hash: vi.fn().mockResolvedValue('$2b$10$hashedpassword'),
 compare: vi.fn(),
 },
}));

vi.mock('@/lib/auth-context', () => ({
 requirePermission: mockRequirePerm,
}));

vi.mock('@/models', () => ({
 ShareLink: {
 find: mockShareLinkFind,
 create: mockShareLinkCreate,
 },
 Asset: {
 countDocuments: mockAssetCountDocuments,
 findById: mockAssetFindById,
 },
 Folder: {
 countDocuments: mockFolderCountDocuments,
 findById: mockFolderFindById,
 },
}));

import { GET, POST } from '@/app/api/share/route';
import { NextRequest } from 'next/server';

const ctx = { userId: 'u1', orgId: 'org1', role: 'editor', email: 'a@b.com', name: 'A' };

function makeReq(body: Record<string, unknown>) {
 return new NextRequest('http://localhost/api/share', {
 method: 'POST',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 });
}

describe('Enhanced Sharing System', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockRequirePerm.mockResolvedValue(ctx);
 });

 /* ─── POST: Multi-asset sharing ───────────────────── */

 describe('POST /api/share — multi-asset', () => {
 it('should create a share link for multiple assets', async () => {
 mockAssetCountDocuments.mockResolvedValue(3);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'sl1',
 token: 'tok123',
 targetType: 'asset',
 targetIds: ['a1', 'a2', 'a3'],
 });

 const res = await POST(makeReq({
 targetType: 'asset',
 targetIds: ['a1', 'a2', 'a3'],
 permission: 'view',
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.link.targetIds).toEqual(['a1', 'a2', 'a3']);
 });

 it('should reject if some assets not found', async () => {
 mockAssetCountDocuments.mockResolvedValue(2); // only 2 of 3 exist

 const res = await POST(makeReq({
 targetType: 'asset',
 targetIds: ['a1', 'a2', 'a3'],
 }));
 const data = await res.json();

 expect(res.status).toBe(404);
 expect(data.error).toContain('not found');
 });

 it('should support legacy single targetId', async () => {
 mockAssetCountDocuments.mockResolvedValue(1);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'sl1',
 token: 'tok123',
 targetType: 'asset',
 targetIds: ['a1'],
 });

 const res = await POST(makeReq({
 targetType: 'asset',
 targetId: 'a1',
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.link.targetIds).toEqual(['a1']);
 });
 });

 /* ─── POST: Root-level sharing ──────────────────────── */

 describe('POST /api/share — root-level', () => {
 it('should create a root-level share link', async () => {
 mockShareLinkCreate.mockResolvedValue({
 _id: 'sl1',
 token: 'tok456',
 targetType: 'root',
 targetIds: [],
 });

 const res = await POST(makeReq({
 targetType: 'root',
 permission: 'admin',
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.link.targetType).toBe('root');
 // Root-level shares don't need asset validation
 expect(mockAssetCountDocuments).not.toHaveBeenCalled();
 });
 });

 /* ─── POST: Granular permissions ────────────────────── */

 describe('POST /api/share — permission levels', () => {
 it('should accept "admin" permission', async () => {
 mockAssetCountDocuments.mockResolvedValue(1);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'sl1',
 token: 'tok789',
 targetType: 'asset',
 targetIds: ['a1'],
 permission: 'admin',
 });

 const res = await POST(makeReq({
 targetType: 'asset',
 targetId: 'a1',
 permission: 'admin',
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.link.permission).toBe('admin');
 });

 it('should reject invalid permission level', async () => {
 const res = await POST(makeReq({
 targetType: 'asset',
 targetId: 'a1',
 permission: 'superadmin',
 }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('permission');
 });
 });

 /* ─── POST: maxDownloads ────────────────────────────── */

 describe('POST /api/share — maxDownloads', () => {
 it('should set maxDownloads limit', async () => {
 mockAssetCountDocuments.mockResolvedValue(1);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'sl1',
 token: 'tok999',
 targetType: 'asset',
 targetIds: ['a1'],
 maxDownloads: 100,
 });

 const res = await POST(makeReq({
 targetType: 'asset',
 targetId: 'a1',
 maxDownloads: 100,
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.link.maxDownloads).toBe(100);
 });
 });

 /* ─── POST: Folder sharing ─────────────────────────── */

 describe('POST /api/share — folder', () => {
 it('should create a folder share link', async () => {
 mockFolderCountDocuments.mockResolvedValue(1);
 mockShareLinkCreate.mockResolvedValue({
 _id: 'sl1',
 token: 'tok-folder',
 targetType: 'folder',
 targetIds: ['f1'],
 });

 const res = await POST(makeReq({
 targetType: 'folder',
 targetId: 'f1',
 includeNested: true,
 }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.link.includeNested).toBe(true);
 });

 it('should reject missing targetId for folder', async () => {
 const res = await POST(makeReq({
 targetType: 'folder',
 }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('targetId or targetIds required');
 });
 });

 /* ─── POST: Validation ──────────────────────────────── */

 describe('POST /api/share — validation', () => {
 it('should reject invalid targetType', async () => {
 const res = await POST(makeReq({
 targetType: 'invalid',
 targetId: 'a1',
 }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('targetType');
 });
 });

 /* ─── GET: List share links ─────────────────────────── */

 describe('GET /api/share', () => {
 it('should list share links with root-level enrichment', async () => {
 mockShareLinkFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([
 {
 _id: 'sl1',
 token: 'tok1',
 targetType: 'root',
 targetId: null,
 targetIds: [],
 permission: 'view',
 includeNested: true,
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

 const res = await GET();
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.links).toHaveLength(1);
 expect(data.links[0].targetType).toBe('root');
 expect(data.links[0].targetName).toBe('Entire Organization');
 });

 it('should list multi-asset share links', async () => {
 mockShareLinkFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue([
 {
 _id: 'sl2',
 token: 'tok2',
 targetType: 'asset',
 targetId: null,
 targetIds: ['a1', 'a2', 'a3'],
 permission: 'edit',
 includeNested: false,
 expiresAt: null,
 isActive: true,
 accessCount: 0,
 maxDownloads: null,
 lastAccessedAt: null,
 allowedEmails: [],
 createdAt: new Date(),
 },
 ]),
 }),
 });

 const res = await GET();
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.links[0].targetName).toBe('3 assets');
 });
 });
});
