// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { createReadyHealthResponse } from '@/lib/health';

describe('createReadyHealthResponse', () => {
  it('reports ready when database and storage checks pass', async () => {
    const response = await createReadyHealthResponse({
      connectToDatabase: async () => undefined,
      checkStorage: async () => ({ ok: true, status: 'up' }),
      requireStorage: true,
    });

    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.status).toBe('ready');
    expect(json.database).toBe('up');
    expect(json.storage).toBe('up');
    expect(Date.parse(json.timestamp)).not.toBeNaN();
  });

  it('returns 503 with DB prompt when database check fails', async () => {
    const response = await createReadyHealthResponse({
      connectToDatabase: async () => {
        throw new Error('database unreachable');
      },
      requireStorage: false,
    });

    expect(response.status).toBe(503);

    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.status).toBe('not-ready');
    expect(json.database).toBe('down');
    expect(json.prompt).toMatch(/not able to connect to db/i);
    expect(json.error).toMatch(/database unreachable/i);
  });

  it('returns 503 with bucket prompt when storage check fails', async () => {
    const response = await createReadyHealthResponse({
      connectToDatabase: async () => undefined,
      checkStorage: async () => ({
        ok: false,
        status: 'down',
        error: 'invalid_grant: Invalid grant: account not found',
        prompt: 'Bucket configuration is not working',
      }),
      requireStorage: true,
    });

    expect(response.status).toBe(503);

    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.status).toBe('not-ready');
    expect(json.database).toBe('up');
    expect(json.storage).toBe('down');
    expect(json.prompt).toMatch(/bucket configuration/i);
  });

  it('skips storage probe when requireStorage is false', async () => {
    const checkStorage = vi.fn().mockResolvedValue({ ok: false, status: 'down' });

    const response = await createReadyHealthResponse({
      connectToDatabase: async () => undefined,
      checkStorage,
      requireStorage: false,
    });

    expect(response.status).toBe(200);
    expect(checkStorage).not.toHaveBeenCalled();
  });
});
