// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import nextConfig from '../../../next.config.mjs';

interface NextConfig {
  headers: () => Promise<
    {
      source: string;
      headers: { key: string; value: string }[];
    }[]
  >;
}

describe('next.config security headers (D60)', () => {
  it('exports a headers() function', () => {
    expect(typeof (nextConfig as unknown as NextConfig).headers).toBe('function');
  });

  it('applies a strict baseline to /:path* and a relaxed policy to /embed/:path*', async () => {
    const groups = await (nextConfig as unknown as NextConfig).headers();
    const baseline = groups.find((g) => g.source === '/:path*');
    const embed = groups.find((g) => g.source === '/embed/:path*');
    expect(baseline).toBeDefined();
    expect(embed).toBeDefined();

    const map = (g: typeof groups[number]) =>
      Object.fromEntries(g.headers.map((h) => [h.key.toLowerCase(), h.value]));
    const base = map(baseline!);
    const emb = map(embed!);

    // Baseline locks down framing and MIME sniffing.
    expect(base['x-frame-options']).toBe('DENY');
    expect(base['x-content-type-options']).toBe('nosniff');
    expect(base['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(base['permissions-policy']).toMatch(/geolocation=\(\)/);
    expect(base['cross-origin-opener-policy']).toBe('same-origin');

    const csp = base['content-security-policy'];
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/upgrade-insecure-requests/);

    // Embed allows framing.
    expect(emb['x-frame-options']).toBe('ALLOWALL');
    expect(emb['content-security-policy']).toMatch(/frame-ancestors \*/);
  });
});
