// SPDX-License-Identifier: Apache-2.0
/**
 * useRovingTabIndex — Roving tabindex pattern for keyboard navigation
 *
 * Implements the WAI-ARIA roving tabindex pattern for composite widgets
 * like toolbars, tab lists, menus, and listboxes.
 *
 * Only one child has tabindex=0 at a time; others get tabindex=-1.
 * Arrow keys move focus between items.
 *
 * @see https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex
 * @see Gap G-5 from Sprint 1–8 Audit
 */

'use client';

import { useCallback, useRef, useState } from 'react';

export type RovingOrientation = 'horizontal' | 'vertical' | 'both';

export interface UseRovingTabIndexOptions {
  /** Total number of items in the group. */
  itemCount: number;
  /** Navigation axis. Default: 'horizontal'. */
  orientation?: RovingOrientation;
  /** Whether to wrap from last→first / first→last. Default: true. */
  loop?: boolean;
  /** Initial focused index. Default: 0. */
  initialIndex?: number;
  /** Callback when active index changes. */
  onIndexChange?: (index: number) => void;
}

export interface RovingItemProps {
  tabIndex: 0 | -1;
  ref: (el: HTMLElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
}

export interface UseRovingTabIndexReturn {
  /** Current active (roving) index. */
  activeIndex: number;
  /** Set active index programmatically. */
  setActiveIndex: (index: number) => void;
  /** Get props object to spread onto each child item. */
  getItemProps: (index: number) => RovingItemProps;
}

export function useRovingTabIndex(
  options: UseRovingTabIndexOptions,
): UseRovingTabIndexReturn {
  const {
    itemCount,
    orientation = 'horizontal',
    loop = true,
    initialIndex = 0,
    onIndexChange,
  } = options;

  const [activeIndex, setActiveIndexState] = useState(initialIndex);
  const itemsRef = useRef<(HTMLElement | null)[]>([]);

  const setActiveIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, itemCount - 1));
      setActiveIndexState(clamped);
      onIndexChange?.(clamped);
      itemsRef.current[clamped]?.focus();
    },
    [itemCount, onIndexChange],
  );

  const moveFocus = useCallback(
    (delta: number) => {
      let next = activeIndex + delta;
      if (loop) {
        if (next < 0) next = itemCount - 1;
        if (next >= itemCount) next = 0;
      } else {
        next = Math.max(0, Math.min(next, itemCount - 1));
      }
      setActiveIndex(next);
    },
    [activeIndex, itemCount, loop, setActiveIndex],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isHoriz = orientation === 'horizontal' || orientation === 'both';
      const isVert = orientation === 'vertical' || orientation === 'both';

      switch (e.key) {
        case 'ArrowRight':
          if (isHoriz) {
            e.preventDefault();
            moveFocus(1);
          }
          break;
        case 'ArrowLeft':
          if (isHoriz) {
            e.preventDefault();
            moveFocus(-1);
          }
          break;
        case 'ArrowDown':
          if (isVert) {
            e.preventDefault();
            moveFocus(1);
          }
          break;
        case 'ArrowUp':
          if (isVert) {
            e.preventDefault();
            moveFocus(-1);
          }
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
      }
    },
    [orientation, moveFocus, setActiveIndex, itemCount],
  );

  const getItemProps = useCallback(
    (index: number): RovingItemProps => ({
      tabIndex: index === activeIndex ? 0 : -1,
      ref: (el: HTMLElement | null) => {
        itemsRef.current[index] = el;
      },
      onKeyDown: handleKeyDown,
      onFocus: () => setActiveIndexState(index),
    }),
    [activeIndex, handleKeyDown],
  );

  return { activeIndex, setActiveIndex, getItemProps };
}

export default useRovingTabIndex;
