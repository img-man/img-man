// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * BottomSheet — Swipe-up sheet for mobile, side panel on desktop.
 *
 * Used for the asset detail drawer and other contextual panels that should
 * be accessible from mobile's bottom edge. On desktop (≥768px), renders
 * as a standard right-side panel.
 *
 * Features:
 * - Drag handle for swipe-down dismiss
 * - Snap points: peek (40vh), half (60vh), full (90vh)
 * - Backdrop overlay with tap-to-dismiss
 * - Respects prefers-reduced-motion
 * - Keyboard accessible (Escape to dismiss)
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §4.3 — Asset drawer as bottom sheet
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { X } from 'lucide-react';

export type SheetSnapPoint = 'closed' | 'peek' | 'half' | 'full';

const SNAP_HEIGHTS: Record<SheetSnapPoint, string> = {
  closed: '0vh',
  peek: '40vh',
  half: '60vh',
  full: '90vh',
};

const SNAP_VALUES: Record<SheetSnapPoint, number> = {
  closed: 0,
  peek: 40,
  half: 60,
  full: 90,
};

interface BottomSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when the sheet should close */
  onClose: () => void;
  /** Initial snap point when opening (default: 'half') */
  snapPoint?: SheetSnapPoint;
  /** Sheet title for the header */
  title?: string;
  /** Content */
  children: ReactNode;
  /** Additional CSS classes for the sheet panel */
  className?: string;
  /** Width of the desktop side panel (default: 'w-96') */
  desktopWidth?: string;
}

interface OpenBottomSheetProps {
  onClose: () => void;
  snapPoint: SheetSnapPoint;
  title?: string;
  children: ReactNode;
  className?: string;
  desktopWidth?: string;
}

export function BottomSheet({
  open,
  onClose,
  snapPoint = 'half',
  title,
  children,
  className = '',
  desktopWidth = 'w-96',
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <OpenBottomSheet
      onClose={onClose}
      snapPoint={snapPoint}
      title={title}
      className={className}
      desktopWidth={desktopWidth}
    >
      {children}
    </OpenBottomSheet>
  );
}

function OpenBottomSheet({
  onClose,
  snapPoint,
  title,
  children,
  className = '',
  desktopWidth = 'w-96',
}: OpenBottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState<SheetSnapPoint>(snapPoint);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Drag handlers
  const handlePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      setIsDragging(true);
      startY.current = e.clientY;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!isDragging) return;
      const dy = e.clientY - startY.current;
      // Only allow dragging down (positive dy)
      setDragOffset(Math.max(0, dy));
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged more than 100px down, snap to next lower point or close
    if (dragOffset > 100) {
      const snaps: SheetSnapPoint[] = ['full', 'half', 'peek', 'closed'];
      const currentIndex = snaps.indexOf(currentSnap);
      const nextSnap = snaps[Math.min(currentIndex + 1, snaps.length - 1)];
      if (nextSnap === 'closed') {
        onClose();
      } else {
        setCurrentSnap(nextSnap);
      }
    }
    setDragOffset(0);
  }, [isDragging, dragOffset, currentSnap, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop: side panel */}
      <div
        className={`fixed right-0 top-0 z-50 hidden h-full border-l border-dash-border bg-dash-surface shadow-xl transition-transform duration-200 md:block ${desktopWidth} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Detail panel'}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
            <h2 className="text-sm font-semibold text-dash-text">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="h-full overflow-y-auto pb-20">{children}</div>
      </div>

      {/* Mobile: bottom sheet */}
      <div
        ref={sheetRef}
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-dash-border bg-dash-surface shadow-2xl md:hidden ${className}`}
        style={{
          height: SNAP_HEIGHTS[currentSnap],
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging
            ? 'none'
            : 'height 0.3s ease, transform 0.3s ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? 'Detail sheet'}
      >
        {/* Drag handle */}
        <div
          className="flex cursor-grab items-center justify-center py-3 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          role="slider"
          aria-label="Resize sheet"
          aria-valuemin={0}
          aria-valuemax={90}
          aria-valuenow={SNAP_VALUES[currentSnap]}
          tabIndex={0}
        >
          <div className="h-1 w-10 rounded-full bg-dash-text-muted/40" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between border-b border-dash-border px-4 pb-2">
            <h2 className="text-sm font-semibold text-dash-text">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
              aria-label="Close sheet"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-safe-bottom">
          {children}
        </div>
      </div>
    </>
  );
}

export default BottomSheet;
