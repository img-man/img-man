// SPDX-License-Identifier: Apache-2.0
/**
 * Sprint 11 – Photo Editor Pro: Batch Edit API Tests
 * Tests for POST /api/assets/batch-edit endpoint.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  canPerform: vi.fn().mockReturnValue(true),
}));

vi.mock('@/models', () => ({
  Asset: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
    create: vi.fn(),
  },
  User: {
    findOne: vi.fn(),
  },
}));

const mockSave = vi.fn();
const mockDownload = vi.fn();
const mockCopy = vi.fn();
vi.mock('@/lib/storage', () => ({
  getGcsBucket: () => ({
    file: () => ({
      download: mockDownload,
      save: mockSave,
      copy: mockCopy,
    }),
  }),
}));

// Mock sharp
const mockSharpInstance = {
  modulate: vi.fn().mockReturnThis(),
  linear: vi.fn().mockReturnThis(),
  sharpen: vi.fn().mockReturnThis(),
  blur: vi.fn().mockReturnThis(),
  greyscale: vi.fn().mockReturnThis(),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('edited')),
  resize: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
};
vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}));

import { POST } from '@/app/api/assets/batch-edit/route';
import { getSession } from '@/lib/session';
import { Asset, User } from '@/models';
import { canPerform } from '@/lib/permissions';

const mockGetSession = vi.mocked(getSession);
const mockUserFindOne = vi.mocked(User.findOne);
const mockAssetFindOne = vi.mocked(Asset.findOne);
const mockAssetUpdateOne = vi.mocked(Asset.updateOne);
const mockAssetCreate = vi.mocked(Asset.create);
const mockCanPerform = vi.mocked(canPerform);

const fakeUser = {
  _id: 'user1',
  email: 'test@imageman.dev',
  orgId: 'org123',
  role: 'editor',
};

function makeRequest(body: object) {
  return new NextRequest(
    new URL('/api/assets/batch-edit', 'http://localhost:3000'),
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

describe('POST /api/assets/batch-edit – Sprint 11.8', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanPerform.mockReturnValue(true);
    mockDownload.mockResolvedValue([Buffer.from('test-image-data')]);
    mockSave.mockResolvedValue(undefined);
    mockCopy.mockResolvedValue(undefined);

    // Reset sharp mock
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('edited'));
    mockSharpInstance.metadata.mockResolvedValue({ width: 800, height: 600 });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await POST(
      makeRequest({ assetIds: ['a1'], adjustments: { brightness: 10 } }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when no assetIds provided', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);

    const res = await POST(
      makeRequest({ assetIds: [], adjustments: { brightness: 10 } }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when assetIds exceed 20', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);

    const ids = Array.from({ length: 21 }, (_, i) => `id${i}`);
    const res = await POST(
      makeRequest({ assetIds: ids, adjustments: { brightness: 10 } }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Maximum 20 assets per batch edit');
  });

  it('returns 400 when adjustments missing', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);

    const res = await POST(makeRequest({ assetIds: ['a1'] }));
    expect(res.status).toBe(400);
  });

  it('returns 403 when user lacks edit permission', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);
    mockCanPerform.mockReturnValue(false);

    const res = await POST(
      makeRequest({ assetIds: ['a1'], adjustments: { brightness: 10 } }),
    );
    expect(res.status).toBe(403);
  });

  it('processes assets in copy mode successfully', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);
    mockAssetFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: 'asset1',
          orgId: 'org123',
          name: 'test.png',
          storageKey: 'orgs/org123/assets/test.png',
          mimeType: 'image/png',
          tags: ['tag1'],
          userTags: [],
          folderId: null,
        }),
    } as never);
    mockAssetCreate.mockResolvedValue({
      _id: 'new-asset1',
    } as never);

    const res = await POST(
      makeRequest({
        assetIds: ['asset1'],
        adjustments: { brightness: 20, contrast: 10 },
        mode: 'copy',
      }),
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.summary.total).toBe(1);
    expect(json.summary.succeeded).toBe(1);
    expect(json.summary.failed).toBe(0);
    expect(json.results[0].success).toBe(true);
    expect(json.results[0].newAssetId).toBeDefined();
  });

  it('processes assets in overwrite mode successfully', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);
    mockAssetFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: 'asset1',
          orgId: 'org123',
          name: 'test.png',
          storageKey: 'orgs/org123/assets/test.png',
          mimeType: 'image/png',
          originalStorageKey: null,
          tags: [],
          userTags: [],
        }),
    } as never);
    mockAssetUpdateOne.mockResolvedValue({ modifiedCount: 1 } as never);

    const res = await POST(
      makeRequest({
        assetIds: ['asset1'],
        adjustments: { brightness: 10 },
        mode: 'overwrite',
      }),
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.summary.succeeded).toBe(1);
    expect(json.results[0].success).toBe(true);
  });

  it('handles not-found assets gracefully', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);
    mockAssetFindOne.mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);

    const res = await POST(
      makeRequest({
        assetIds: ['missing1'],
        adjustments: { brightness: 10 },
      }),
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.summary.failed).toBe(1);
    expect(json.results[0].success).toBe(false);
    expect(json.results[0].error).toBe('Not found');
  });

  it('handles non-image assets gracefully', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);
    mockAssetFindOne.mockReturnValue({
      lean: () =>
        Promise.resolve({
          _id: 'asset1',
          orgId: 'org123',
          name: 'doc.pdf',
          mimeType: 'application/pdf',
        }),
    } as never);

    const res = await POST(
      makeRequest({
        assetIds: ['asset1'],
        adjustments: { brightness: 10 },
      }),
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.results[0].success).toBe(false);
    expect(json.results[0].error).toBe('Not an image');
  });

  it('returns partial results when some assets fail', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'user1', email: 'test@imageman.dev' },
      expires: '2099-01-01',
    });
    mockUserFindOne.mockReturnValue({
      lean: () => Promise.resolve(fakeUser),
    } as never);

    let callCount = 0;
    mockAssetFindOne.mockImplementation(
      () =>
        ({
          lean: () => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                _id: 'asset1',
                orgId: 'org123',
                name: 'good.png',
                storageKey: 'key',
                mimeType: 'image/png',
                tags: [],
                userTags: [],
                folderId: null,
              });
            }
            return Promise.resolve(null);
          },
        }) as never,
    );
    mockAssetCreate.mockResolvedValue({ _id: 'new1' } as never);

    const res = await POST(
      makeRequest({
        assetIds: ['asset1', 'asset2'],
        adjustments: { brightness: 10 },
      }),
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.summary.total).toBe(2);
    expect(json.summary.succeeded).toBe(1);
    expect(json.summary.failed).toBe(1);
  });
});
