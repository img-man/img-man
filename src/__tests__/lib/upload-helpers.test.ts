// SPDX-License-Identifier: Apache-2.0
// @vitest-environment-options { "url": "https://app.img-man.test/dashboard" }
//
// The URL above is load-bearing. uploadBinaryToStorage routes through the app
// server instead of a signed PUT whenever window.location.hostname is
// localhost — a deliberate workaround for dev origins that cannot complete a
// direct cross-origin PUT to the bucket. jsdom's default URL is
// http://localhost:3000/, which silently satisfies that branch and made every
// direct-upload assertion below unreachable.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadBinaryToStorage } from '@/lib/upload-helpers';

/**
 * A fresh fetch mock per test.
 *
 * Deliberately not vi.spyOn(globalThis, 'fetch'): spying on something already
 * spied returns the *existing* mock, so queued once-values append behind
 * whatever the previous test left unconsumed, and vi.restoreAllMocks() does
 * not reset it between tests. A brand-new vi.fn() cannot inherit a queue.
 */
function stubFetch() {
  const mock = vi.fn();
  vi.stubGlobal('fetch', mock);
  return mock;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('uploadBinaryToStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to same-origin upload when direct storage upload fails', async () => {
    const fetchMock = stubFetch()
      .mockResolvedValueOnce(
        jsonResponse({
          uploadUrl: 'https://storage.googleapis.com/signed-upload',
          storageKey: 'org1/direct.png',
        }),
      )
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(
        jsonResponse({ storageKey: 'org1/fallback.png' }, 201),
      );

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
    const fetchMock = stubFetch()
      .mockResolvedValueOnce(
        jsonResponse({
          uploadUrl: 'https://storage.googleapis.com/signed-upload',
          storageKey: 'org1/direct.png',
        }),
      )
      .mockResolvedValueOnce(new Response('', { status: 200 }));

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
    const fetchMock = stubFetch().mockResolvedValueOnce(
      jsonResponse({ storageKey: 'org1/server-first.png' }, 201),
    );

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
    expect(calledUrls).not.toContain(
      'https://storage.googleapis.com/signed-upload',
    );
  });
});
