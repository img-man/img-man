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
 getSignedDownloadUrl: vi.fn().mockResolvedValue('https://signed.url'),
}));

vi.mock('@/models', () => ({
 Asset: {
 aggregate: vi.fn(),
 },
 Organization: {
 findById: vi.fn(),
 },
}));

import { GET } from '@/app/api/v1/faces/route';
import { authenticateApiRequest } from '@/lib/api-auth';
import { Asset, Organization } from '@/models';
import { NextRequest } from 'next/server';

const mockAuth = vi.mocked(authenticateApiRequest) as unknown as ReturnType<typeof vi.fn>;
const mockAggregate = vi.mocked(Asset.aggregate) as unknown as ReturnType<typeof vi.fn>;
const mockOrgFindById = vi.mocked(Organization.findById) as unknown as ReturnType<typeof vi.fn>;

const AUTH_CTX = {
 keyId: 'key1',
 orgId: 'org1',
 keyName: 'Test',
 permissions: ['read'] as ('read')[],
 allowedDomains: [] as string[],
 rateLimit: 60,
 folderScope: undefined,
};

function makeReq(params?: Record<string, string>): NextRequest {
 const url = new URL('http://localhost/api/v1/faces');
 if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
 return new NextRequest(url);
}

describe('GET /api/v1/faces', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockAuth.mockResolvedValue(AUTH_CTX);
 mockOrgFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue({ personNames: {} }),
 }),
 });
 });

 it('returns 401 when not authenticated', async () => {
 const { NextResponse } = await import('next/server');
 mockAuth.mockResolvedValue(
 NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
 );
 const res = await GET(makeReq());
 expect(res.status).toBe(401);
 });

 it('returns paginated face list', async () => {
 mockAggregate.mockResolvedValue([
 {
 metadata: [{ total: 2 }],
 data: [
 {
 faceHash: 'face1',
 count: 10,
 firstSeen: '2024-01-01',
 lastSeen: '2024-01-10',
 avgConfidence: 0.95,
 emotions: ['happy', 'neutral'],
 sampleAssets: [{ assetId: 'a1', name: 'photo1.jpg' }],
 },
 {
 faceHash: 'face2',
 count: 5,
 firstSeen: '2024-01-02',
 lastSeen: '2024-01-08',
 avgConfidence: 0.88,
 emotions: ['neutral'],
 sampleAssets: [{ assetId: 'a2', name: 'photo2.jpg' }],
 },
 ],
 },
 ]);

 const res = await GET(makeReq());
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.people).toHaveLength(2);
 expect(data.people[0].faceHash).toBe('face1');
 expect(data.people[0].count).toBe(10);
 expect(data.total).toBe(2);
 expect(data.page).toBe(1);
 expect(data.limit).toBe(20);
 });

 it('enriches faces with person names', async () => {
 mockOrgFindById.mockReturnValue({
 select: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 personNames: { face1: 'John Doe' },
 }),
 }),
 });
 mockAggregate.mockResolvedValue([
 {
 metadata: [{ total: 1 }],
 data: [
 {
 faceHash: 'face1',
 count: 3,
 firstSeen: '2024-01-01',
 lastSeen: '2024-01-05',
 avgConfidence: 0.92,
 emotions: ['happy'],
 sampleAssets: [],
 },
 ],
 },
 ]);

 const res = await GET(makeReq());
 const data = await res.json();

 expect(data.people[0].displayName).toBe('John Doe');
 expect(data.personNames).toEqual({ face1: 'John Doe' });
 });

 it('handles empty results', async () => {
 mockAggregate.mockResolvedValue([
 {
 metadata: [],
 data: [],
 },
 ]);

 const res = await GET(makeReq());
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.people).toHaveLength(0);
 expect(data.total).toBe(0);
 });

 it('respects page and limit params', async () => {
 mockAggregate.mockResolvedValue([
 {
 metadata: [{ total: 50 }],
 data: [],
 },
 ]);

 const res = await GET(makeReq({ page: '2', limit: '10' }));
 const data = await res.json();

 expect(data.page).toBe(2);
 expect(data.limit).toBe(10);
 expect(data.totalPages).toBe(5);
 });

 it('clamps limit to max 50', async () => {
 mockAggregate.mockResolvedValue([
 { metadata: [{ total: 0 }], data: [] },
 ]);

 const res = await GET(makeReq({ limit: '100' }));
 const data = await res.json();
 expect(data.limit).toBe(50);
 });
});
