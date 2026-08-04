// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * Touch Interaction Utilities for Canvas Editors
 *
 * Provides hooks and helpers for touch-friendly canvas interactions
 * including pinch-to-zoom, two-finger pan, and long-press context menu.
 *
 * Designed to work alongside existing mouse/pointer handlers without
 * interfering — touch events are detected separately.
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §4.4 — Touch-friendly canvas interactions
 */

import { useRef, useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PinchState {
  /** Whether a pinch gesture is active */
  isPinching: boolean;
  /** Current scale factor relative to gesture start (1 = unchanged) */
  scale: number;
  /** Center point of the two fingers in client coordinates */
  center: { x: number; y: number };
  /** Distance between fingers in px */
  distance: number;
}

export interface LongPressResult {
  /** Whether a long press was detected */
  isLongPress: boolean;
  /** Coordinates of the long-press point */
  position: { x: number; y: number } | null;
  /** Call to reset long-press state */
  reset: () => void;
}

export interface TouchCanvasOptions {
  /** Callback when pinch-zoom changes */
  onPinchZoom?: (scale: number, center: { x: number; y: number }) => void;
  /** Callback when two-finger pan occurs */
  onPan?: (dx: number, dy: number) => void;
  /** Callback when long-press is detected */
  onLongPress?: (position: { x: number; y: number }) => void;
  /** Long-press delay in ms (default: 500) */
  longPressDelay?: number;
  /** Minimum finger distance change to trigger pinch (default: 10px) */
  pinchThreshold?: number;
  /** Whether touch interactions are enabled */
  enabled?: boolean;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/** Calculate distance between two touch points */
export function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Calculate center point between two touch points */
export function getTouchCenter(t1: Touch, t2: Touch): { x: number; y: number } {
  return {
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  };
}

// ─── useTouchCanvas Hook ──────────────────────────────────────────────────────

/**
 * Hook that attaches touch event handlers to a canvas/SVG element for:
 * - Pinch-to-zoom (two fingers)
 * - Two-finger pan
 * - Long-press context menu (single finger, 500ms hold)
 *
 * Returns a ref to attach to the target element.
 *
 * @example
 * ```tsx
 * const canvasRef = useTouchCanvas({
 *   onPinchZoom: (scale, center) => setZoom(z => z * scale),
 *   onPan: (dx, dy) => setPan(px => px + dx, py => py + dy),
 *   onLongPress: (pos) => openContextMenu(pos),
 * });
 *
 * return <svg ref={canvasRef} style={{ touchAction: 'none' }} ... />;
 * ```
 */
export function useTouchCanvas<T extends HTMLElement | SVGElement>(
  options: TouchCanvasOptions = {},
) {
  const {
    onPinchZoom,
    onPan,
    onLongPress,
    longPressDelay = 500,
    pinchThreshold = 10,
    enabled = true,
  } = options;

  const elementRef = useRef<T>(null);
  const initialDistance = useRef(0);
  const lastCenter = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTouch = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Two-finger: start pinch / pan
        clearLongPress();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        initialDistance.current = getTouchDistance(t1, t2);
        lastCenter.current = getTouchCenter(t1, t2);
        e.preventDefault();
      } else if (e.touches.length === 1) {
        // Single finger: start long-press timer
        const touch = e.touches[0];
        startTouch.current = { x: touch.clientX, y: touch.clientY };

        longPressTimer.current = setTimeout(() => {
          if (startTouch.current && onLongPress) {
            onLongPress(startTouch.current);
          }
        }, longPressDelay);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDistance = getTouchDistance(t1, t2);
        const newCenter = getTouchCenter(t1, t2);

        // Pinch zoom
        if (
          Math.abs(newDistance - initialDistance.current) > pinchThreshold &&
          onPinchZoom
        ) {
          const scale = newDistance / initialDistance.current;
          onPinchZoom(scale, newCenter);
          initialDistance.current = newDistance;
        }

        // Two-finger pan
        if (onPan) {
          const dx = newCenter.x - lastCenter.current.x;
          const dy = newCenter.y - lastCenter.current.y;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            onPan(dx, dy);
          }
        }

        lastCenter.current = newCenter;
        e.preventDefault();
      } else if (e.touches.length === 1) {
        // If finger moved more than 10px, cancel long-press
        const touch = e.touches[0];
        if (startTouch.current) {
          const dx = touch.clientX - startTouch.current.x;
          const dy = touch.clientY - startTouch.current.y;
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
            clearLongPress();
            startTouch.current = null;
          }
        }
      }
    };

    const handleTouchEnd = () => {
      clearLongPress();
      startTouch.current = null;
      initialDistance.current = 0;
    };

    el.addEventListener('touchstart', handleTouchStart as EventListener, {
      passive: false,
    });
    el.addEventListener('touchmove', handleTouchMove as EventListener, {
      passive: false,
    });
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      el.removeEventListener('touchstart', handleTouchStart as EventListener);
      el.removeEventListener('touchmove', handleTouchMove as EventListener);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      clearLongPress();
    };
  }, [
    enabled,
    onPinchZoom,
    onPan,
    onLongPress,
    longPressDelay,
    pinchThreshold,
    clearLongPress,
  ]);

  return elementRef;
}

// ─── useLongPress Hook ────────────────────────────────────────────────────────

/**
 * Simple long-press detection hook for individual elements.
 *
 * @example
 * ```tsx
 * const { handlers, isLongPress, position, reset } = useLongPress({
 *   onLongPress: (pos) => showMenu(pos),
 *   delay: 600,
 * });
 * <div {...handlers}>Press and hold</div>
 * ```
 */
export function useLongPress(options: {
  onLongPress: (position: { x: number; y: number }) => void;
  delay?: number;
}): {
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerMove: (e: React.PointerEvent) => void;
  };
} & LongPressResult {
  const { onLongPress, delay = 500 } = options;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    setIsLongPress(false);
    setPosition(null);
  }, []);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      startPos.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        const pos = startPos.current ?? { x: e.clientX, y: e.clientY };
        setIsLongPress(true);
        setPosition(pos);
        onLongPress(pos);
      }, delay);
    },
    onPointerUp: () => {
      clear();
    },
    onPointerLeave: () => {
      clear();
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!startPos.current) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clear();
      }
    },
  };

  return { handlers, isLongPress, position, reset };
}
