// SPDX-License-Identifier: Apache-2.0
/**
 * useFocusTrap — Custom focus-trap hook
 *
 * Traps keyboard focus inside a container element.
 * When active, Tab / Shift+Tab cycles through focusable
 * children without escaping to elements outside the trap.
 *
 * @see Gap G-5 from Sprint 1–8 Audit
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';

/** CSS selector for all natively focusable elements. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

export interface UseFocusTrapOptions {
  /** Whether the trap is currently active. */
  active: boolean;
  /** Restore focus to the previously-focused element on deactivation. Default: true. */
  restoreFocus?: boolean;
  /** Auto-focus the first element when trap activates. Default: true. */
  autoFocus?: boolean;
  /** Optional callback when user presses Escape inside the trap. */
  onEscape?: () => void;
}

/**
 * Returns a ref to attach to the container that should trap focus.
 *
 * @example
 * ```tsx
 * const trapRef = useFocusTrap({ active: isModalOpen, onEscape: close });
 * return <div ref={trapRef}>…modal content…</div>;
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions,
) {
  const { active, restoreFocus = true, autoFocus = true, onEscape } = options;
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Gather focusable children (visible only)
  const getFocusable = useCallback((): HTMLElement[] => {
    const el = containerRef.current;
    if (!el) return [];
    const nodes = Array.from(
      el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    return nodes.filter(
      (n) =>
        n.offsetWidth > 0 || n.offsetHeight > 0 || n === document.activeElement,
    );
  }, []);

  // Activate: save previous focus + auto-focus first element
  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement;

    if (autoFocus) {
      // Defer to let the DOM settle (e.g. after portal mounts)
      const id = requestAnimationFrame(() => {
        const focusable = getFocusable();
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          // Focus the container itself so focus is inside
          containerRef.current?.focus();
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [active, autoFocus, getFocusable]);

  // Deactivate: restore previous focus
  useEffect(() => {
    if (active) return;
    if (restoreFocus && previousFocusRef.current instanceof HTMLElement) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [active, restoreFocus]);

  // Keydown handler: trap Tab + handle Escape
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first → last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last → first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [active, getFocusable, onEscape]);

  return containerRef;
}

export default useFocusTrap;
