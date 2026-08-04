// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * EmbedContainer — Container-query wrapper for embed components.
 *
 * Wraps children in a CSS containment context so that child components
 * can use `@container` queries to adapt to the iframe's actual width
 * rather than the viewport width.
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §4.2 — Container queries for embed components
 *
 * Usage:
 * ```tsx
 * <EmbedContainer>
 *   <AssetGrid />   // Will use @container queries instead of @media
 * </EmbedContainer>
 * ```
 *
 * CSS in child components:
 * ```css
 * @container embed (min-width: 600px) { .grid { grid-template-columns: repeat(3, 1fr); } }
 * @container embed (max-width: 599px) { .grid { grid-template-columns: repeat(2, 1fr); } }
 * ```
 */

import { type ReactNode } from 'react';

interface EmbedContainerProps {
  children: ReactNode;
  /** Named container for targeted @container queries (default: "embed") */
  name?: string;
  /** Additional CSS classes */
  className?: string;
}

export function EmbedContainer({
  children,
  name = 'embed',
  className = '',
}: EmbedContainerProps) {
  return (
    <div
      className={`@container/${name} h-full w-full ${className}`}
      style={{ containerType: 'inline-size', containerName: name }}
    >
      {children}
    </div>
  );
}

/**
 * Utility CSS class names for container-query breakpoints.
 * Use these in component classNames for responsive embed layouts.
 *
 * Tailwind v4 supports @container queries natively:
 * - `@sm/embed:grid-cols-2` — ≥640px container width
 * - `@md/embed:grid-cols-3` — ≥768px container width
 * - `@lg/embed:grid-cols-4` — ≥1024px container width
 *
 * For non-Tailwind usage, import these breakpoint values:
 */
export const EMBED_BREAKPOINTS = {
  /** Compact: <480px (1-2 columns, stacked layout) */
  compact: 480,
  /** Small: 480-639px (2 columns) */
  small: 480,
  /** Medium: 640-767px (3 columns) */
  medium: 640,
  /** Large: 768-1023px (4 columns) */
  large: 768,
  /** Wide: ≥1024px (5+ columns, full feature set) */
  wide: 1024,
} as const;

export default EmbedContainer;
