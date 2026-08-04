// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';

/**
 * Embed dashboard layout — chromeless wrapper for the full dashboard
 * embedded inside an iframe. No session auth required; authentication
 * is via access token passed as URL parameter.
 *
 * NOTE: Do NOT render <html>/<body> here — the root layout already does.
 * Nested layouts in Next.js App Router should only wrap with divs/providers.
 */
export default function EmbedDashboardLayout({ children }: { children: ReactNode }) {
 return (
 <ThemeProvider>
 {children}
 </ThemeProvider>
 );
}
