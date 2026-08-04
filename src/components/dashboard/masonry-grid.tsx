// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-6.1 — Masonry Layout Option
 *
 * CSS-columns-based masonry grid that respects original aspect ratios.
 * Toggleable via layout preference (grid / masonry).
 */

import { type ReactNode } from 'react';

export type LayoutMode = 'grid' | 'masonry';

export interface MasonryGridProps {
  children: ReactNode;
  mode: LayoutMode;
  /** Extra className appended to the wrapper */
  className?: string;
  /** Gap in pixels between items (default 16) */
  gap?: number;
  /** CSS column count overrides for breakpoints */
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
}

/**
 * Renders children in either a uniform CSS grid or a Pinterest-style
 * masonry layout using CSS columns.
 */
export function MasonryGrid({
  children,
  mode,
  className = '',
  gap = 16,
  columns = { sm: 2, md: 3, lg: 4, xl: 5 },
}: MasonryGridProps) {
  if (mode === 'grid') {
    return (
      <div
        className={`grid ${className}`}
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(160px, 1fr))`,
          gap: `${gap}px`,
        }}
        data-testid="asset-layout-grid"
      >
        {children}
      </div>
    );
  }

  // Masonry layout via CSS columns
  return (
    <div
      className={className}
      style={{
        columnCount: columns.xl ?? 5,
        columnGap: `${gap}px`,
      }}
      data-testid="asset-layout-masonry"
    >
      <style>{`
        @media (max-width: 640px) {
          [data-testid="asset-layout-masonry"] { column-count: ${columns.sm ?? 2} !important; }
        }
        @media (min-width: 641px) and (max-width: 768px) {
          [data-testid="asset-layout-masonry"] { column-count: ${columns.md ?? 3} !important; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          [data-testid="asset-layout-masonry"] { column-count: ${columns.lg ?? 4} !important; }
        }
        @media (min-width: 1025px) {
          [data-testid="asset-layout-masonry"] { column-count: ${columns.xl ?? 5} !important; }
        }
      `}</style>
      {children}
    </div>
  );
}

/**
 * Wrapper for a masonry item — prevents column breaks.
 * Use with natural aspect-ratio images for true masonry effect.
 */
export function MasonryItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-4 break-inside-avoid ${className}`}
      data-testid="masonry-item"
    >
      {children}
    </div>
  );
}

/* ─── Layout persistence ─────────────────────────────────── */

const LAYOUT_STORAGE_KEY = 'imgman-gallery-layout';

export function getStoredLayout(): LayoutMode {
  if (typeof window === 'undefined') return 'grid';
  const stored = localStorage.getItem(LAYOUT_STORAGE_KEY);
  return stored === 'grid' || stored === 'masonry' ? stored : 'grid';
}

export function setStoredLayout(mode: LayoutMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
}

export default MasonryGrid;
