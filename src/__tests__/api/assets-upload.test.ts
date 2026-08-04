// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  mockGetActorFromRequest,
  mockUploadBuffer,
} = vi.hoisted(() => ({
  mockGetActorFromRequest: vi.fn(),
  mockUploadBuffer: vi.fn(),
}));

vi.mock('@/lib/actor-auth', () => ({
  getActorFromRequest: mockGetActorFromRequest,
  isActorErrorResponse: (value: unknown) => value instanceof NextResponse,
}));

vi.mock('@/lib/storage', () => ({
  uploadBuffer: mockUploadBuffer,
}));

import { POST } from '@/app/api/assets/upload/route';

function makeRequest(file: File) {
  const formData = new FormData();
  formData.append('file', file, file.name);
  formData.append('fileName', file.name);
  formData.append('contentType', file.type || 'application/octet-stream');

  return new NextRequest('http://localhost/api/assets/upload', {
    method: 'POST',
    body: formData,
  });
}

describe('POST /api/assets/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActorFromRequest.mockResolvedValue({
      orgId: 'org1',
      userId: 'user1',
      email: 'user@example.com',
      role: 'editor',
    });
    mockUploadBuffer.mockResolvedValue('org1/saved.png');
  });

  it('uploads the file server-side and returns the storage key', async () => {
    const res = await POST(
      makeRequest(new File(['hello'], 'photo.png', { type: 'image/png' })),
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.storageKey).toMatch(/^org1\/.+\.png$/);

    const [storageKey, buffer, contentType, metadata, bucketOverride, orgId] =
      mockUploadBuffer.mock.calls[0] ?? [];
    expect(storageKey).toBe(data.storageKey);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect((buffer as Buffer).length).toBeGreaterThan(0);
    expect(contentType).toBe('image/png');
    expect(metadata).toBeUndefined();
    expect(bucketOverride).toBeUndefined();
    expect(orgId).toBe('org1');
  });

  it('rejects blocked file extensions', async () => {
    const res = await POST(
      makeRequest(
        new File(['bad'], 'payload.exe', {
          type: 'application/octet-stream',
        }),
      ),
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain('.exe');
    expect(mockUploadBuffer).not.toHaveBeenCalled();
  });
});
