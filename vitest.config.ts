// SPDX-License-Identifier: Apache-2.0
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    testTimeout: 15000,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        // Only measure pure-logic layers. Next.js App Router pages, API routes,
        // and React components require integration/e2e tests, not unit coverage.
        include: [
          'src/lib/**/*.{ts,tsx}',
          'src/models/**/*.{ts,tsx}',
        ],
        exclude: [
          'src/__tests__/**',
          'src/**/*.d.ts',
          'src/lib/guides.ts',           // static data, no logic
          'src/lib/api-playground-data.ts', // static data, no logic
          'src/lib/template-seed.ts',    // seed data, DB-dependent
          // Runtime wiring / provider integrations (covered by API & integration tests)
          'src/lib/actor-auth.ts',
          'src/lib/auth-context.ts',
          'src/lib/api-auth.ts',
          'src/lib/db.ts',
          'src/lib/mongodb.ts',
          'src/lib/openai.ts',
          'src/lib/vertex-ai.ts',
          'src/lib/gcp-config.ts',
          'src/lib/error-logger.ts',
          'src/lib/health.ts',
          'src/lib/session.ts',
          'src/lib/folder-access.ts',
          'src/lib/save-to-library.ts',
          // Client interaction hooks / browser-only gesture layers
          'src/lib/use-focus-trap.ts',
          'src/lib/use-roving-tabindex.ts',
          'src/lib/touch-interactions.ts',
          // Transform internals validated through higher-level transform tests
          'src/lib/transforms/cache.ts',
          'src/lib/transforms/constants.ts',
          'src/lib/transforms/processor.ts',
          // Model barrel index is re-export only
          'src/models/index.ts',
        ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@img-man/sdk': path.resolve(__dirname, './packages/imageman-sdk/src/index.ts'),
    },
  },
});
