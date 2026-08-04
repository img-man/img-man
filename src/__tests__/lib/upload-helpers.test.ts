// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadBinaryToStorage } from '@/lib/upload-helpers';

describe('uploadBinaryToStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to same-origin upload when direct storage upload fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uploadUrl: 'https://storage.googleapis.com/signed-upload',
            storageKey: 'org1/direct.png',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ storageKey: 'org1/fallback.png' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    fetchMock.mockClear();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await uploadBinaryToStorage(
      new Blob(['hello'], { type: 'image/png' }),
      'photo.png',
      'image/png',
    );

    expect(result.storageKey).toBe('org1/fallback.png');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/assets/upload-url',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://storage.googleapis.com/signed-upload',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/assets/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );

    const thirdCall = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const body = thirdCall.body as FormData;
    expect(body.get('fileName')).toBe('photo.png');
    expect(body.get('contentType')).toBe('image/png');
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('keeps the direct upload path when signed PUT succeeds', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uploadUrl: 'https://storage.googleapis.com/signed-upload',
            storageKey: 'org1/direct.png',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }));
    fetchMock.mockClear();

    const result = await uploadBinaryToStorage(
      new Blob(['hello'], { type: 'image/png' }),
      'photo.png',
      'image/png',
    );

    expect(result.storageKey).toBe('org1/direct.png');
    const calledUrls = fetchMock.mock.calls.map(([url]) => url);
    expect(calledUrls[0]).toBe('/api/assets/upload-url');
    expect(calledUrls[1]).toBe('https://storage.googleapis.com/signed-upload');
    expect(calledUrls).not.toContain('/api/assets/upload');
  });

  it('skips direct storage upload when server upload is preferred', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ storageKey: 'org1/server-first.png' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    fetchMock.mockClear();

    const result = await uploadBinaryToStorage(
      new Blob(['hello'], { type: 'image/png' }),
      'photo.png',
      'image/png',
      { preferServerUpload: true },
    );

    expect(result.storageKey).toBe('org1/server-first.png');
    const calledUrls = fetchMock.mock.calls.map(([url]) => url);
    expect(calledUrls).toContain('/api/assets/upload');
    expect(calledUrls).not.toContain('/api/assets/upload-url');
    expect(calledUrls).not.toContain('https://storage.googleapis.com/signed-upload');
  });
});
