// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react';
import { EmbedContainer } from '@/components/dashboard/embed-container';

/**
 * Embed layout — chromeless wrapper with no dashboard navigation.
 * All config is passed via URL search params.
 *
 * Wraps children in an EmbedContainer for @container query support,
 * allowing components to respond to the iframe's actual width.
 *
 * NOTE: Do NOT render <html>/<body> here — the root layout already does.
 * Nested layouts in Next.js App Router should only wrap with divs/providers.
 */
export default function EmbedLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        height: '100vh',
        width: '100vw',
      }}
    >
      <EmbedContainer>{children}</EmbedContainer>
    </div>
  );
}
