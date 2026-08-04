// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Hoisted mocks ─────────────────────────────────────────── */

const { mockAggregate } = vi.hoisted(() => ({
  mockAggregate: vi.fn(),
}));

/* ── Mock deps ─────────────────────────────────────────────── */

vi.mock('@/lib/db', () => ({ connectToDatabase: vi.fn() }));
vi.mock('@/lib/session', () => ({ getSession: vi.fn() }));

vi.mock('@/models', () => ({
  Asset: {
    aggregate: mockAggregate,
  },
  User: {
    findOne: vi.fn().mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue({
        _id: 'user1',
        email: 'test@test.com',
        orgId: '507f1f77bcf86cd799439011',
      }),
    })),
  },
}));

import { getSession } from '@/lib/session';

const mockGetSession = vi.mocked(getSession);

/* ── Import route handler ──────────────────────────────────── */

import { GET } from '@/app/api/assets/duplicates/route';
import { NextRequest } from 'next/server';

/* ── Helpers ───────────────────────────────────────────────── */

function makeReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/assets/duplicates');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url);
}

/* ── Tests ─────────────────────────────────────────────────── */

describe('GET /api/assets/duplicates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: { email: 'test@test.com', name: 'Test', image: null },
      expires: '2099-01-01',
    });
  });

  it('returns 401 without session', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns groups of duplicates', async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        groups: [
          {
            _id: 'abc123hash',
            count: 3,
            assets: [
              { _id: 'a1', name: 'photo.jpg', sizeBytes: 1000 },
              { _id: 'a2', name: 'photo-copy.jpg', sizeBytes: 1000 },
              { _id: 'a3', name: 'photo(2).jpg', sizeBytes: 1200 },
            ],
          },
        ],
        totalCount: [{ count: 1 }],
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].hash).toBe('abc123hash');
    expect(body.groups[0].count).toBe(3);
    expect(body.groups[0].assets).toHaveLength(3);
  });

  it('returns correct stats', async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        groups: [
          {
            _id: 'hash1',
            count: 2,
            assets: [
              { _id: 'a1', name: 'img1.jpg', sizeBytes: 500 },
              { _id: 'a2', name: 'img2.jpg', sizeBytes: 800 },
            ],
          },
        ],
        totalCount: [{ count: 1 }],
      },
    ]);

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.stats.totalDuplicateAssets).toBe(2);
    // Wasted = sum of all but smallest = 800 - 500 = the 800 is kept, 500 is sorted first
    // sizes sorted = [500, 800], wasted = 800
    expect(body.stats.totalWastedBytes).toBe(800);
  });

  it('supports pagination', async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        groups: [],
        totalCount: [{ count: 5 }],
      },
    ]);

    const res = await GET(makeReq({ page: '2', limit: '10' }));
    const body = await res.json();

    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
    expect(body.total).toBe(5);
    expect(body.totalPages).toBe(1);
  });

  it('caps limit at 50', async () => {
    mockAggregate.mockResolvedValueOnce([{ groups: [], totalCount: [] }]);

    const res = await GET(makeReq({ limit: '200' }));
    const body = await res.json();
    expect(body.limit).toBe(50);
  });

  it('handles empty results', async () => {
    mockAggregate.mockResolvedValueOnce([{ groups: [], totalCount: [] }]);

    const res = await GET(makeReq());
    const body = await res.json();

    expect(body.groups).toHaveLength(0);
    expect(body.total).toBe(0);
    expect(body.stats.totalDuplicateAssets).toBe(0);
    expect(body.stats.totalWastedBytes).toBe(0);
  });

  it('returns 500 on aggregation error', async () => {
    mockAggregate.mockRejectedValueOnce(new Error('DB timeout'));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toBe('Failed to find duplicates');
    expect(body.details).toContain('DB timeout');
  });

  it('builds correct aggregation pipeline', async () => {
    mockAggregate.mockResolvedValueOnce([{ groups: [], totalCount: [] }]);

    await GET(makeReq());

    expect(mockAggregate).toHaveBeenCalledOnce();
    const pipeline = mockAggregate.mock.calls[0][0];

    // Should have: $match, $group, $match, $sort, $facet
    expect(pipeline).toHaveLength(5);

    // First stage is $match for org + perceptualHash
    expect(pipeline[0].$match).toBeDefined();
    expect(pipeline[0].$match.perceptualHash).toEqual({
      $ne: null,
      $exists: true,
    });

    // Second stage is $group by perceptualHash
    expect(pipeline[1].$group._id).toBe('$perceptualHash');

    // Third stage filters for count >= 2
    expect(pipeline[2].$match.count).toEqual({ $gte: 2 });

    // Fourth stage sorts by count desc
    expect(pipeline[3].$sort.count).toBe(-1);

    // Fifth stage is $facet for pagination
    expect(pipeline[4].$facet).toBeDefined();
    expect(pipeline[4].$facet.groups).toBeDefined();
    expect(pipeline[4].$facet.totalCount).toBeDefined();
  });
});
