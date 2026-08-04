// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/models', () => ({
  Asset: {
    findOne: vi.fn(),
  },
  User: {
    findOne: vi.fn(),
  },
}));

vi.mock('@/lib/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
}));

vi.mock('sharp', () => ({
  default: vi.fn((input: Buffer) => {
    const state = {
      buffer: input,
      operations: [] as string[],
    };

    const pipeline = {
      resize: vi.fn(() => {
        state.operations.push('resize');
        return pipeline;
      }),
      rotate: vi.fn(() => {
        state.operations.push('rotate');
        return pipeline;
      }),
      blur: vi.fn(() => {
        state.operations.push('blur');
        return pipeline;
      }),
      grayscale: vi.fn(() => {
        state.operations.push('grayscale');
        return pipeline;
      }),
      webp: vi.fn(() => {
        state.operations.push('webp');
        return pipeline;
      }),
      png: vi.fn(() => {
        state.operations.push('png');
        return pipeline;
      }),
      avif: vi.fn(() => {
        state.operations.push('avif');
        return pipeline;
      }),
      jpeg: vi.fn(() => {
        state.operations.push('jpeg');
        return pipeline;
      }),
      toBuffer: vi.fn(async () =>
        Buffer.from(`transformed:${state.operations.join(',')}`),
      ),
    };

    return pipeline;
  }),
}));

import { GET } from '@/app/i/[id]/route';
import { connectToDatabase } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Asset, User } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';

const mockConnectToDatabase = vi.mocked(connectToDatabase);
const mockGetSession = vi.mocked(getSession);
const mockAssetFindOne = vi.mocked(Asset.findOne);
const mockUserFindOne = vi.mocked(User.findOne);
const mockGetSignedDownloadUrl = vi.mocked(getSignedDownloadUrl);

const CTX = {
  params: Promise.resolve({ id: 'asset1' }),
};

function makeRequest(path = 'http://localhost:4000/i/asset1') {
  return new NextRequest(path);
}

function mockAssetLookup(asset: Record<string, unknown> | null) {
  mockAssetFindOne.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(asset),
    }),
  } as never);
}

function mockUserLookup(user: Record<string, unknown> | null) {
  mockUserFindOne.mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(user),
    }),
  } as never);
}

describe('GET /i/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(undefined);
    vi.mocked(global.fetch).mockReset();
  });

  it('keeps public assets on the fast signed-url redirect path', async () => {
    mockAssetLookup({
      _id: 'asset1',
      storageKey: 'orgs/org1/assets/asset1.png',
      thumbnailStorageKey: 'thumbnails/org1/assets/asset1.webp',
      mimeType: 'image/png',
      orgId: 'org1',
      isPublic: true,
    });
    mockGetSignedDownloadUrl.mockResolvedValue(
      'https://signed.example.com/asset1.png' as never,
    );
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(null, { status: 200 }) as never,
    );

    const res = await GET(makeRequest(), CTX);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'https://signed.example.com/asset1.png',
    );
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('redirects public assets to the thumbnail when the original object is missing', async () => {
    mockAssetLookup({
      _id: 'asset1',
      storageKey: 'orgs/org1/assets/missing.png',
      thumbnailStorageKey: 'thumbnails/org1/assets/asset1.webp',
      mimeType: 'image/png',
      orgId: 'org1',
      isPublic: true,
    });
    mockGetSignedDownloadUrl
      .mockResolvedValueOnce('https://signed.example.com/missing.png' as never)
      .mockResolvedValueOnce(
        'http://localhost:3000/api/storage/download?token=thumb-public' as never,
      );
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(null, { status: 404 }) as never,
    );

    const res = await GET(makeRequest(), CTX);

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(
      'http://localhost:4000/api/storage/download?token=thumb-public',
    );
    expect(mockGetSignedDownloadUrl).toHaveBeenNthCalledWith(
      1,
      'orgs/org1/assets/missing.png',
      60 * 60,
      undefined,
      'org1',
    );
    expect(mockGetSignedDownloadUrl).toHaveBeenNthCalledWith(
      2,
      'thumbnails/org1/assets/asset1.webp',
      60 * 60,
      undefined,
      'org1',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://signed.example.com/missing.png',
      expect.objectContaining({
        method: 'HEAD',
        cache: 'no-store',
        redirect: 'follow',
      }),
    );
  });

  it('redirects anonymous requests for private assets to sign-in', async () => {
    mockAssetLookup({
      _id: 'asset1',
      storageKey: 'orgs/org1/assets/asset1.png',
      mimeType: 'image/png',
      orgId: 'org1',
      isPublic: false,
    });
    mockGetSession.mockResolvedValue(null);

    const res = await GET(makeRequest(), CTX);
    const location = res.headers.get('location') ?? '';

    expect(res.status).toBe(302);
    expect(location).toContain('/signin?');
    expect(location).toContain('callbackUrl=');
    expect(mockGetSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('streams private assets for authenticated same-org users', async () => {
    mockAssetLookup({
      _id: 'asset1',
      storageKey: 'orgs/org1/assets/asset1.png',
      thumbnailStorageKey: 'thumbnails/org1/assets/asset1.webp',
      mimeType: 'image/png',
      orgId: 'org1',
      isPublic: false,
    });
    mockGetSession.mockResolvedValue({
      user: { email: 'editor@imageman.dev' },
      expires: '2099-01-01T00:00:00.000Z',
    });
    mockUserLookup({ orgId: 'org1' });
    mockGetSignedDownloadUrl.mockResolvedValue(
      'http://localhost:3000/api/storage/download?token=abc123' as never,
    );
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('private-asset', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }) as never,
    );

    const res = await GET(makeRequest(), CTX);
    const body = Buffer.from(await res.arrayBuffer()).toString('utf8');

    expect(res.status).toBe(200);
    expect(body).toBe('private-asset');
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(res.headers.get('vary')).toBe('Cookie, Authorization');
    expect(mockGetSignedDownloadUrl).toHaveBeenCalledWith(
      'orgs/org1/assets/asset1.png',
      10 * 60,
      undefined,
      'org1',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/storage/download?token=abc123',
      expect.objectContaining({ cache: 'no-store', redirect: 'follow' }),
    );
  });

  it('falls back to the thumbnail when the original private object is missing', async () => {
    mockAssetLookup({
      _id: 'asset1',
      storageKey: 'orgs/org1/assets/missing.png',
      thumbnailStorageKey: 'thumbnails/org1/assets/asset1.webp',
      mimeType: 'image/png',
      orgId: 'org1',
      isPublic: false,
    });
    mockGetSession.mockResolvedValue({
      user: { email: 'editor@imageman.dev' },
      expires: '2099-01-01T00:00:00.000Z',
    });
    mockUserLookup({ orgId: 'org1' });
    mockGetSignedDownloadUrl
      .mockResolvedValueOnce('http://localhost:4000/missing-original' as never)
      .mockResolvedValueOnce(
        'http://localhost:3000/api/storage/download?token=thumb123' as never,
      );
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response('missing', {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }) as never,
      )
      .mockResolvedValueOnce(
        new Response('thumbnail-asset', {
          status: 200,
          headers: { 'Content-Type': 'image/webp' },
        }) as never,
      );

    const res = await GET(makeRequest(), CTX);
    const body = Buffer.from(await res.arrayBuffer()).toString('utf8');

    expect(res.status).toBe(200);
    expect(body).toBe('thumbnail-asset');
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(mockGetSignedDownloadUrl).toHaveBeenNthCalledWith(
      1,
      'orgs/org1/assets/missing.png',
      10 * 60,
      undefined,
      'org1',
    );
    expect(mockGetSignedDownloadUrl).toHaveBeenNthCalledWith(
      2,
      'thumbnails/org1/assets/asset1.webp',
      10 * 60,
      undefined,
      'org1',
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:4000/api/storage/download?token=thumb123',
      expect.objectContaining({ cache: 'no-store', redirect: 'follow' }),
    );
  });

  it('applies query-based transforms on the stable asset URL', async () => {
    mockAssetLookup({
      _id: 'asset1',
      storageKey: 'orgs/org1/assets/asset1.png',
      thumbnailStorageKey: 'thumbnails/org1/assets/asset1.webp',
      mimeType: 'image/png',
      orgId: 'org1',
      isPublic: true,
    });
    mockGetSignedDownloadUrl.mockResolvedValue(
      'http://localhost:3000/api/storage/download?token=transform123' as never,
    );
    vi.mocked(global.fetch).mockResolvedValue(
      new Response('transform-source', {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }) as never,
    );

    const res = await GET(
      makeRequest(
        'http://localhost:4000/i/asset1?w=640&h=480&fit=cover&format=webp&q=70&blur=12&rotation=90&grayscale=1',
      ),
      CTX,
    );
    const body = Buffer.from(await res.arrayBuffer()).toString('utf8');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/webp');
    expect(body).toBe('transformed:resize,rotate,blur,grayscale,webp');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/storage/download?token=transform123',
      expect.objectContaining({ cache: 'no-store', redirect: 'follow' }),
    );
  });
});
