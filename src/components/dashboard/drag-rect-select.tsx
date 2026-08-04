// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-6.3 — Drag-Rectangle Multi-Select
 *
 * Click + drag on empty space in the grid draws a translucent blue rectangle.
 * Assets whose bounding boxes intersect the rectangle become selected.
 * Hold Shift to *add* to existing selection instead of replacing it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragRectSelectProps {
  /** CSS selector for selectable items within the container */
  itemSelector: string;
  /** data attribute on each selectable item that holds its ID */
  itemIdAttr?: string;
  /** Currently selected IDs (controlled) */
  selectedIds: string[];
  /** Called with the new set of selected IDs */
  onSelectionChange: (ids: string[]) => void;
  children: React.ReactNode;
  className?: string;
  enabled?: boolean;
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

export function DragRectSelect({
  itemSelector,
  itemIdAttr = 'data-asset-id',
  selectedIds,
  onSelectionChange,
  children,
  className = '',
  enabled = true,
}: DragRectSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const shiftRef = useRef(false);
  const baseSelectionRef = useRef<string[]>([]);

  /** Convert page coords to container-relative coords */
  const toLocal = useCallback((pageX: number, pageY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: pageX - r.left + el.scrollLeft,
      y: pageY - r.top + el.scrollTop,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      // Only start drag from blank grid area (not existing buttons/inputs)
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, [data-no-drag-select]')) return;

      shiftRef.current = e.shiftKey;
      baseSelectionRef.current = e.shiftKey ? [...selectedIds] : [];
      const start = toLocal(e.pageX, e.pageY);
      startRef.current = start;

      setDragging(true);
      setRect({ x: start.x, y: start.y, width: 0, height: 0 });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [enabled, selectedIds, toLocal],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging || !startRef.current) return;

      const pos = toLocal(e.pageX, e.pageY);
      const sx = startRef.current.x;
      const sy = startRef.current.y;

      const newRect: Rect = {
        x: Math.min(sx, pos.x),
        y: Math.min(sy, pos.y),
        width: Math.abs(pos.x - sx),
        height: Math.abs(pos.y - sy),
      };
      setRect(newRect);

      // Hit-test against selectable items
      const container = containerRef.current;
      if (!container) return;
      const items = container.querySelectorAll(itemSelector);
      const cRect = container.getBoundingClientRect();
      const hitIds: string[] = [];

      items.forEach((item) => {
        const ir = item.getBoundingClientRect();
        const itemLocal: Rect = {
          x: ir.left - cRect.left + container.scrollLeft,
          y: ir.top - cRect.top + container.scrollTop,
          width: ir.width,
          height: ir.height,
        };
        if (rectsIntersect(newRect, itemLocal)) {
          const id = item.getAttribute(itemIdAttr);
          if (id) hitIds.push(id);
        }
      });

      const merged = shiftRef.current
        ? Array.from(new Set([...baseSelectionRef.current, ...hitIds]))
        : hitIds;
      onSelectionChange(merged);
    },
    [dragging, toLocal, itemSelector, itemIdAttr, onSelectionChange],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    setRect(null);
    startRef.current = null;
  }, []);

  // Track shift key changes while dragging
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      shiftRef.current = e.shiftKey;
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      data-testid="drag-rect-container"
    >
      {children}
      {dragging && rect && rect.width > 4 && rect.height > 4 && (
        <div
          className="pointer-events-none absolute z-50 border-2 border-dashed border-blue-500 bg-blue-500/10"
          data-testid="drag-rect-selection"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
    </div>
  );
}

/** Pure utility — exported for unit-testing */
export { rectsIntersect };

export default DragRectSelect;
