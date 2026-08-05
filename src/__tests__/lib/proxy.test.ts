// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi, beforeEach } from 'vitest';

const getTokenMock = vi.fn();

vi.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => getTokenMock(...args),
}));

import { proxy } from '@/proxy';
import { NextRequest } from 'next/server';

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://img-man.test${path}`, { headers });
}

describe('proxy', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
  });

  it('does not surface an exception when getToken throws on a malformed header', async () => {
    // @auth/core <=0.34.x (pinned by next-auth v4) throws instead of
    // returning null for a malformed Authorization header. This runs before
    // any path check on every matched request, so a throw here would be a
    // pre-auth 500 on input the caller fully controls.
    getTokenMock.mockRejectedValue(new Error('JWTSessionError: malformed'));

    const res = await proxy(
      request('/dashboard', { authorization: 'Bearer !!!not-a-jwt!!!' }),
    );

    // Treated as unauthenticated: redirected to sign-in, not crashed.
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/signin');
  });

  it('still lets a valid session through', async () => {
    getTokenMock.mockResolvedValue({ sub: 'user-1' });

    const res = await proxy(request('/dashboard'));

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('lets an imgt_ bearer token through even when getToken throws', async () => {
    getTokenMock.mockRejectedValue(new Error('JWTSessionError: malformed'));

    const res = await proxy(
      request('/api/assets/list', { authorization: 'Bearer imgt_abc123' }),
    );

    expect(res.status).toBe(200);
  });

  it('redirects an unauthenticated request to sign-in', async () => {
    getTokenMock.mockResolvedValue(null);

    const res = await proxy(request('/dashboard/assets'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/signin');
  });
});
