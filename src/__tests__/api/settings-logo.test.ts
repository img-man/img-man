// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────
const {
  mockRequirePerm,
  mockOrgFindById,
  mockOrgUpdateOne,
  mockUploadBuffer,
  mockGetSignedDownloadUrl,
  mockTrackBandwidth,
} = vi.hoisted(() => ({
  mockRequirePerm: vi.fn(),
  mockOrgFindById: vi.fn(),
  mockOrgUpdateOne: vi.fn(),
  mockUploadBuffer: vi.fn(),
  mockGetSignedDownloadUrl: vi.fn(),
  mockTrackBandwidth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
  requirePermission: mockRequirePerm,
}));

vi.mock('@/models', () => ({
  Organization: {
    findById: mockOrgFindById,
    updateOne: mockOrgUpdateOne,
  },
}));

vi.mock('@/lib/storage', () => ({
  uploadBuffer: mockUploadBuffer,
  getSignedDownloadUrl: mockGetSignedDownloadUrl,
}));

vi.mock('@/lib/bandwidth', () => ({
  trackBandwidth: mockTrackBandwidth,
}));

import { POST } from '@/app/api/settings/logo/route';
import { NextRequest } from 'next/server';

function makeLogoReq(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return new NextRequest('http://localhost/api/settings/logo', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/settings/logo', () => {
  const ctx = {
    userId: 'u1',
    orgId: 'org1',
    role: 'owner',
    email: 'a@b.com',
    name: 'A',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePerm.mockResolvedValue(ctx);
    mockOrgFindById.mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue({ _id: 'org1', storageConfig: { bucket: '' } }),
    });
    mockUploadBuffer.mockResolvedValue('branding/org1/logo.png');
    mockGetSignedDownloadUrl.mockResolvedValue(
      'https://storage.example.com/logo.png?sig=abc',
    );
    mockOrgUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockTrackBandwidth.mockResolvedValue(undefined);
  });

  it('should upload a PNG logo successfully', async () => {
    const file = new File(['fake-png-data'], 'logo.png', { type: 'image/png' });
    const res = await POST(makeLogoReq(file));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.logoUrl).toBe('https://storage.example.com/logo.png?sig=abc');
    expect(mockUploadBuffer).toHaveBeenCalledWith(
      expect.stringContaining('branding/org1/logo.png'),
      expect.any(Buffer),
      'image/png',
      undefined,
      undefined,
      'org1',
    );
    expect(mockOrgUpdateOne).toHaveBeenCalledWith(
      { _id: 'org1' },
      { $set: { logoUrl: 'branding/org1/logo.png' } },
    );
    expect(mockOrgUpdateOne).toHaveBeenCalled();
    expect(mockTrackBandwidth).toHaveBeenCalledWith(
      'org1',
      'upload',
      expect.any(Number),
    );
  });

  it('should accept JPEG logos', async () => {
    const file = new File(['jpeg-data'], 'photo.jpg', { type: 'image/jpeg' });
    const res = await POST(makeLogoReq(file));

    expect(res.status).toBe(200);
  });

  it('should accept WebP logos', async () => {
    const file = new File(['webp-data'], 'logo.webp', { type: 'image/webp' });
    const res = await POST(makeLogoReq(file));

    expect(res.status).toBe(200);
  });

  it('should accept SVG logos', async () => {
    const file = new File(['<svg></svg>'], 'logo.svg', {
      type: 'image/svg+xml',
    });
    const res = await POST(makeLogoReq(file));

    expect(res.status).toBe(200);
  });

  it('should reject non-image files', async () => {
    const file = new File(['text'], 'readme.txt', { type: 'text/plain' });
    const res = await POST(makeLogoReq(file));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('Invalid file type');
  });

  it('should reject files over 2MB', async () => {
    // Create a mock request with a large file
    // jsdom File doesn't always report size accurately, so we mock formData directly
    const fakeFile = {
      type: 'image/png',
      name: 'huge.png',
      size: 3 * 1024 * 1024,
      arrayBuffer: async () => new ArrayBuffer(3 * 1024 * 1024),
    };
    const req = new NextRequest('http://localhost/api/settings/logo', {
      method: 'POST',
      body: new FormData(),
    });
    // Override formData to return our controlled file
    vi.spyOn(req, 'formData').mockResolvedValue({
      get: (key: string) =>
        key === 'file' ? (fakeFile as unknown as File) : null,
    } as unknown as FormData);

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('too large');
  });

  it('should return 401 for unauthenticated requests', async () => {
    mockRequirePerm.mockRejectedValue({ status: 401, error: 'Unauthorized' });
    const file = new File(['data'], 'logo.png', { type: 'image/png' });
    const res = await POST(makeLogoReq(file));

    expect(res.status).toBe(401);
  });

  it('should return 403 for insufficient permissions', async () => {
    mockRequirePerm.mockRejectedValue({
      status: 403,
      error: 'Insufficient permissions',
    });
    const file = new File(['data'], 'logo.png', { type: 'image/png' });
    const res = await POST(makeLogoReq(file));

    expect(res.status).toBe(403);
  });
});
