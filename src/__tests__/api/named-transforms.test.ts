// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mock external deps ──────────────────────────────────────── */

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
 requirePermission: vi.fn(),
}));

vi.mock('@/models/index', () => ({
 NamedTransform: {
 find: vi.fn(),
 findOne: vi.fn(),
 create: vi.fn(),
 },
}));

import { GET, POST } from '@/app/api/named-transforms/route';
import { requirePermission } from '@/lib/auth-context';
import { NamedTransform } from '@/models/index';
import { NextRequest } from 'next/server';

const mockRequirePermission = vi.mocked(requirePermission);
const mockFind = vi.mocked(NamedTransform.find) as unknown as ReturnType<typeof vi.fn>;
const mockFindOne = vi.mocked(NamedTransform.findOne) as unknown as ReturnType<typeof vi.fn>;
const mockCreate = vi.mocked(NamedTransform.create) as unknown as ReturnType<typeof vi.fn>;

function makeRequest(url: string, init?: Record<string, unknown>) {
 return new NextRequest(new URL(url, 'http://localhost:3000'), init as never);
}

const AUTH_CTX = {
 userId: 'u1',
 orgId: 'org1',
 email: 'a@b.com',
 name: 'Test User',
 role: 'admin' as const,
 accessRules: [],
};

/* ─── Tests ──────────────────────────────────────────────────── */

describe('GET /api/named-transforms', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it('returns 401 if requirePermission throws', async () => {
 mockRequirePermission.mockRejectedValue({ status: 401, message: 'Unauthorized' });

 const res = await GET();
 const json = await res.json();
 expect(res.status).toBe(401);
 expect(json.error).toBe('Unauthorized');
 });

 it('returns list of transforms for the org', async () => {
 mockRequirePermission.mockResolvedValue(AUTH_CTX);

 const transforms = [
 { _id: 't1', name: 'thumbnail', transforms: 'w-200,h-200,c-thumb' },
 { _id: 't2', name: 'hero', transforms: 'w-1920,h-1080,c-cover' },
 ];
 mockFind.mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(transforms),
 }),
 });

 const res = await GET();
 const json = await res.json();
 expect(res.status).toBe(200);
 expect(json.transforms).toHaveLength(2);
 expect(json.transforms[0].name).toBe('thumbnail');
 });
});

describe('POST /api/named-transforms', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockRequirePermission.mockResolvedValue(AUTH_CTX);
 });

 it('returns 400 if name is missing', async () => {
 const req = makeRequest('/api/named-transforms', {
 method: 'POST',
 body: JSON.stringify({ transforms: 'w-300' }),
 });

 const res = await POST(req);
 const json = await res.json();
 expect(res.status).toBe(400);
 expect(json.error).toContain('Name');
 });

 it('returns 400 if name has invalid characters', async () => {
 const req = makeRequest('/api/named-transforms', {
 method: 'POST',
 body: JSON.stringify({ name: 'bad name!', transforms: 'w-300' }),
 });

 const res = await POST(req);
 const json = await res.json();
 expect(res.status).toBe(400);
 expect(json.error).toContain('alphanumeric');
 });

 it('returns 400 if transform string is empty', async () => {
 const req = makeRequest('/api/named-transforms', {
 method: 'POST',
 body: JSON.stringify({ name: 'test', transforms: '_' }),
 });

 const res = await POST(req);
 const json = await res.json();
 expect(res.status).toBe(400);
 expect(json.error).toContain('no valid transforms');
 });

 it('returns 409 if name already exists', async () => {
 mockFindOne.mockResolvedValue({ _id: 'existing' });

 const req = makeRequest('/api/named-transforms', {
 method: 'POST',
 body: JSON.stringify({ name: 'thumbnail', transforms: 'w-200,h-200' }),
 });

 const res = await POST(req);
 const json = await res.json();
 expect(res.status).toBe(409);
 expect(json.error).toContain('already exists');
 });

 it('creates named transform successfully', async () => {
 mockFindOne.mockResolvedValue(null); // no duplicate
 const created = {
 _id: 'new1',
 orgId: 'org1',
 name: 'social-card',
 transforms: 'w-1200,h-630,c-cover,q-85',
 description: 'OG image preset',
 };
 mockCreate.mockResolvedValue(created);

 const req = makeRequest('/api/named-transforms', {
 method: 'POST',
 body: JSON.stringify({
 name: 'social-card',
 transforms: 'w-1200,h-630,c-cover,q-85',
 description: 'OG image preset',
 }),
 });

 const res = await POST(req);
 const json = await res.json();
 expect(res.status).toBe(201);
 expect(json.transform.name).toBe('social-card');
 expect(mockCreate).toHaveBeenCalledWith(
 expect.objectContaining({
 orgId: 'org1',
 name: 'social-card',
 transforms: 'w-1200,h-630,c-cover,q-85',
 }),
 );
 });
});
