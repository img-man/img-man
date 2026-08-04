// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * ResponsiveToolbar — Responsive toolbar wrapper for Design Studio & PDF Editor.
 *
 * Provides a horizontal toolbar that collapses at different breakpoints:
 * - Desktop (≥1024px): Full labels + icons
 * - Tablet (768-1023px): Icon-only buttons (labels hidden)
 * - Mobile (<768px): Compact with overflow menu for secondary actions
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §4.7 — Responsive Design Studio toolbar
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolbarItem {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  /** If true, item stays visible even in overflow (always primary) */
  primary?: boolean;
  /** Group divider before this item */
  divider?: boolean;
}

interface ResponsiveToolbarProps {
  items: ToolbarItem[];
  /** Additional elements to render at the end (e.g., save button) */
  trailing?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Max items visible before overflow on mobile (default: 6) */
  mobileMaxVisible?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResponsiveToolbar({
  items,
  trailing,
  className = '',
  mobileMaxVisible = 6,
}: ResponsiveToolbarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  // Close on Escape
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOverflowOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [overflowOpen]);

  // Split items for mobile overflow
  const primaryItems = items.filter((i) => i.primary);
  const secondaryItems = items.filter((i) => !i.primary);
  const visibleOnMobile = [
    ...primaryItems,
    ...secondaryItems.slice(
      0,
      Math.max(0, mobileMaxVisible - primaryItems.length),
    ),
  ];
  const overflowItems = secondaryItems.slice(
    Math.max(0, mobileMaxVisible - primaryItems.length),
  );

  return (
    <div
      className={`flex items-center gap-1 border-b border-dash-border bg-dash-surface px-2 py-1.5 ${className}`}
      role="toolbar"
      aria-label="Editor toolbar"
    >
      {/* Full toolbar — visible on tablet+ */}
      <div className="hidden md:flex md:items-center md:gap-1 md:flex-1">
        {items.map((item) => (
          <ToolbarButton key={item.id} item={item} showLabel={false} />
        ))}
      </div>

      {/* Mobile toolbar with overflow */}
      <div className="flex flex-1 items-center gap-1 md:hidden">
        {visibleOnMobile.map((item) => (
          <ToolbarButton key={item.id} item={item} showLabel={false} compact />
        ))}

        {/* Overflow menu trigger */}
        {overflowItems.length > 0 && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOverflowOpen((o) => !o)}
              className="rounded p-1.5 text-dash-text2 hover:bg-dash-muted transition-colors"
              aria-label="More tools"
              aria-expanded={overflowOpen}
              aria-haspopup="true"
            >
              <MoreHorizontal size={16} />
            </button>

            {/* Overflow dropdown */}
            {overflowOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-44 rounded-lg border border-dash-border bg-dash-surface p-1 shadow-xl"
                role="menu"
              >
                {overflowItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      item.onClick();
                      setOverflowOpen(false);
                    }}
                    disabled={item.disabled}
                    className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs transition-colors ${
                      item.active
                        ? 'bg-primary/10 text-primary'
                        : 'text-dash-text2 hover:bg-dash-muted hover:text-dash-text'
                    } ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    role="menuitem"
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Trailing content (save, export, etc.) */}
      {trailing && <div className="flex items-center gap-1.5">{trailing}</div>}
    </div>
  );
}

// ─── ToolbarButton ────────────────────────────────────────────────────────────

function ToolbarButton({
  item,
  showLabel = true,
  compact = false,
}: {
  item: ToolbarItem;
  showLabel?: boolean;
  compact?: boolean;
}) {
  return (
    <>
      {item.divider && (
        <div className="mx-1 h-4 w-px shrink-0 bg-dash-border" />
      )}
      <button
        onClick={item.onClick}
        disabled={item.disabled}
        title={item.label}
        className={`rounded transition-colors ${compact ? 'p-1' : 'p-1.5'} ${
          item.active
            ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
            : 'text-dash-text2 hover:bg-dash-muted'
        } ${item.disabled ? 'opacity-40' : ''}`}
        aria-pressed={item.active}
        aria-label={item.label}
      >
        <span className="flex items-center gap-1.5">
          {item.icon}
          {showLabel && (
            <span className="hidden text-xs lg:inline">{item.label}</span>
          )}
        </span>
      </button>
    </>
  );
}

export default ResponsiveToolbar;
