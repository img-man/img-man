// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  runSmokeAuthenticatedApi,
  type SmokeOptions,
} from '../../../scripts/smoke-authenticated-api';

function makeOptions(overrides: Partial<SmokeOptions> = {}): SmokeOptions {
  return {
    baseUrl: 'http://127.0.0.1:50801',
    email: 'smoke@imageman.dev',
    password: 'SmokeTestPass123!',
    name: 'Smoke Test User',
    folderName: 'smoke-folder',
    allowExistingUser: false,
    probeAssetUpload: false,
    ...overrides,
  };
}

function jsonResponse(
  payload: unknown,
  init: ResponseInit & { setCookie?: string } = {},
) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.setCookie) {
    headers.set('Set-Cookie', init.setCookie);
  }

  return new Response(JSON.stringify(payload), {
    ...init,
    headers,
  });
}

describe('runSmokeAuthenticatedApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('runs the authenticated folder/share smoke flow successfully', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ message: 'Account and workspace created' }, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse(
          { csrfToken: 'csrf-token' },
          {
            status: 200,
            setCookie: 'next-auth.csrf-token=csrf-token%7Chash; Path=/; HttpOnly',
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { url: 'http://127.0.0.1:50801/dashboard' },
          {
            status: 200,
            setCookie: 'next-auth.session-token=session-token; Path=/; HttpOnly',
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ user: { email: 'smoke@imageman.dev' } }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ plaintext: 'img_test_api_key' }, { status: 201 }))
      .mockResolvedValueOnce(
        jsonResponse({ folder: { _id: 'folder-1', name: 'smoke-folder' } }, { status: 201 }),
      )
      .mockResolvedValueOnce(jsonResponse({ folders: [{ _id: 'folder-1' }] }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ link: { token: 'share-token' } }, { status: 201 }))
      .mockResolvedValueOnce(
        jsonResponse({ share: { targetName: 'smoke-folder', permission: 'view' } }, { status: 200 }),
      );
    fetchMock.mockClear();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runSmokeAuthenticatedApi(makeOptions());

    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      new URL('/api/auth/signup', 'http://127.0.0.1:50801'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      new URL('/api/auth/callback/credentials', 'http://127.0.0.1:50801'),
      expect.objectContaining({ method: 'POST' }),
    );

    const sessionHeaders = fetchMock.mock.calls[3]?.[1]?.headers as Headers;
    expect(sessionHeaders.get('cookie')).toContain('next-auth.session-token=session-token');

    const apiKeyHeaders = fetchMock.mock.calls[4]?.[1]?.headers as Headers;
    expect(apiKeyHeaders.get('cookie')).toContain('next-auth.session-token=session-token');

    expect(logSpy).toHaveBeenCalledWith('[smoke-authenticated-api] completed successfully');
  });

  it('continues when the user already exists and includes the upload probe when requested', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ error: 'exists' }, { status: 409 }))
      .mockResolvedValueOnce(
        jsonResponse(
          { csrfToken: 'csrf-token' },
          {
            status: 200,
            setCookie: 'next-auth.csrf-token=csrf-token%7Chash; Path=/; HttpOnly',
          },
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { url: 'http://127.0.0.1:50801/dashboard' },
          {
            status: 200,
            setCookie: 'next-auth.session-token=session-token; Path=/; HttpOnly',
          },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ user: { email: 'smoke@imageman.dev' } }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ plaintext: 'img_test_api_key' }, { status: 201 }))
      .mockResolvedValueOnce(
        jsonResponse({ folder: { _id: 'folder-1', name: 'smoke-folder' } }, { status: 201 }),
      )
      .mockResolvedValueOnce(jsonResponse({ folders: [{ _id: 'folder-1' }] }, { status: 200 }))
      .mockResolvedValueOnce(jsonResponse({ link: { token: 'share-token' } }, { status: 201 }))
      .mockResolvedValueOnce(
        jsonResponse({ share: { targetName: 'smoke-folder', permission: 'view' } }, { status: 200 }),
      )
      .mockResolvedValueOnce(jsonResponse({ assetId: 'asset-1' }, { status: 201 }));
    fetchMock.mockClear();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runSmokeAuthenticatedApi(
      makeOptions({ allowExistingUser: true, probeAssetUpload: true }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(10);
    const uploadCall = fetchMock.mock.calls[9];
    expect(uploadCall?.[0]).toEqual(new URL('/api/v1/assets', 'http://127.0.0.1:50801'));
    expect(uploadCall?.[1]).toMatchObject({ method: 'POST' });
    expect(uploadCall?.[1]?.body).toContain('"folderId":"folder-1"');
    expect(logSpy).toHaveBeenCalledWith(
      '[smoke-authenticated-api] signup skipped for existing user smoke@imageman.dev',
    );
    expect(logSpy).toHaveBeenCalledWith('[smoke-authenticated-api] asset upload-url probe OK');
  });
});