// SPDX-License-Identifier: Apache-2.0
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
    ],
  },
  // Polotno SDK is distributed as ESM with many sub-dependencies (react-konva,
  // konva, mobx, svg-round-corners, etc.). Turbopack must resolve their
  // package.json `module` fields and bundle them through the React 19 compat
  // shim. `transpilePackages` ensures that happens.
  transpilePackages: [
    'polotno',
    'react-konva',
    'react-konva-utils',
    'svg-round-corners',
  ],

  // Next.js 16 - turbopack is a top-level key (not experimental.turbo)
  turbopack: {
    resolveAlias: {
      // svg-round-corners has no `exports` field and no `type: "module"`.
      // Turbopack may fall back to the CJS `main` which does not expose
      // named ESM exports. Point it directly at the ESM entry instead.
      'svg-round-corners': 'svg-round-corners/lib/index.js',
    },
  },

  // NOTE: polotno, konva, react-konva require DOM/Canvas APIs but are loaded
  // exclusively on the client via dynamic(() => import(...), { ssr: false }).
  // They MUST NOT appear in serverExternalPackages because that conflicts
  // with transpilePackages in Next.js 16 Turbopack.

  // Security headers (D60). Strict CSP with nonces is layered on per-request
  // by middleware; this baseline covers HSTS, framing, MIME-sniffing, and a
  // restrictive default for routes that don't set their own CSP.
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';
    const securityHeaders = [
      // HSTS: 1 year, include subdomains, eligible for preload. Production only.
      ...(isProd
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains; preload',
            },
          ]
        : []),
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
      },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "object-src 'none'",
          // Next 16 + React 19 still need 'unsafe-inline' for hydration scripts
          // until the per-route nonce middleware lands (planned for v0.18.x).
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "media-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "connect-src 'self' https: wss:",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          'upgrade-insecure-requests',
        ].join('; '),
      },
    ];

    // Embed routes intentionally allow framing by parent sites. Override here.
    const embedHeaders = [
      { key: 'X-Frame-Options', value: 'ALLOWALL' },
      { key: 'Content-Security-Policy', value: "frame-ancestors *" },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/embed/:path*',
        headers: embedHeaders,
      },
    ];
  },
};

export default nextConfig;
