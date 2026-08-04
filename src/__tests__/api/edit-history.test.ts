// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 11 – Photo Editor Pro: Edit History API Tests
 * Tests for GET /api/assets/[id]/edits endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/models', () => ({
  Asset: {
    findOne: vi.fn(),
  },
  User: {
    findOne: vi.fn(),
  },
}));

import { GET } from '@/app/api/assets/[id]/edits/route';
import { getSession } from '@/lib/session';
import { Asset, User } from '@/models';

const mockGetSession = vi.mocked(getSession);
const mockUserFindOne = vi.mocked(User.findOne);
const mockAssetFindOne = vi.mocked(Asset.findOne);

/** Helper to build a chainable Mongoose query mock: findOne().select().populate().lean() */
function chainableFindOne(resolvedValue: unknown) {
  return {
    select: () => ({
      populate: () => ({
        lean: () => Promise.resolve(resolvedValue),
      }),
    }),
  } as never;
}

const fakeUser = {
  _id: 'user1',
  email: 'test@imageman.dev',
  orgId: 'org123',
  role: 'editor',
};

function makeRequest(assetId: string) {
  return new NextRequest(
    new URL(`/api/assets/${assetId}/edits`, 'http://localhost:3000'),
    { method: 'GET' },
  );
}

describe('GET /api/assets/[id]/edits – Sprint 11.7', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeRequest('asset1'), {
      params: Promise.resolve({ id: 'asset1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 when user has no orgId', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve({ email: 'test@imageman.dev', orgId: null }),
    } as never);

    const res = await GET(makeRequest('asset1'), {
      params: Promise.resolve({ id: 'asset1' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when asset not found', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);
    mockAssetFindOne.mockReturnValue(chainableFindOne(null));

    const res = await GET(makeRequest('nonexistent'), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 200 with edit history for a valid asset', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);

    const fakeAsset = {
      _id: 'asset1',
      orgId: 'org123',
      name: 'photo.jpg',
      originalStorageKey: 'original-key',
      edits: [
        {
          adjustments: { brightness: 20 },
          cropSettings: null,
          annotations: [],
          timestamp: new Date('2025-01-01'),
          userId: { name: 'Test User', email: 'test@imageman.dev' },
          mode: 'overwrite',
        },
        {
          adjustments: { contrast: 10, saturation: -5 },
          cropSettings: { x: 0, y: 0, width: 100, height: 100 },
          annotations: [{ id: 'a1' }, { id: 'a2' }],
          timestamp: new Date('2025-01-02'),
          userId: { name: 'Test User', email: 'test@imageman.dev' },
          mode: 'copy',
        },
      ],
    };

    mockAssetFindOne.mockReturnValue(chainableFindOne(fakeAsset));

    const res = await GET(makeRequest('asset1'), {
      params: Promise.resolve({ id: 'asset1' }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.assetId).toBe('asset1');
    expect(json.name).toBe('photo.jpg');
    expect(json.hasOriginal).toBe(true);
    expect(json.editCount).toBe(2);
    expect(json.edits).toHaveLength(2);

    // Sorted newest first
    expect(json.edits[0].index).toBe(1);
    expect(json.edits[0].mode).toBe('copy');
    expect(json.edits[0].annotationCount).toBe(2);

    expect(json.edits[1].index).toBe(0);
    expect(json.edits[1].mode).toBe('overwrite');
  });

  it('returns empty edits array when no edits exist', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);

    const fakeAsset = {
      _id: 'asset2',
      orgId: 'org123',
      name: 'clean.jpg',
      originalStorageKey: null,
      edits: [],
    };

    mockAssetFindOne.mockReturnValue(chainableFindOne(fakeAsset));

    const res = await GET(makeRequest('asset2'), {
      params: Promise.resolve({ id: 'asset2' }),
    });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.hasOriginal).toBe(false);
    expect(json.editCount).toBe(0);
    expect(json.edits).toHaveLength(0);
  });
});
