// SPDX-License-Identifier: Apache-2.0
/**
 * Reduced Motion Utilities
 *
 * Provides hooks and utilities for respecting the user's `prefers-reduced-motion`
 * system preference. Used to disable or reduce animations throughout the app.
 *
 * @see WCAG 2.3.3 — Animation from Interactions
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
 */

'use client';

import { useSyncExternalStore } from 'react';

/**
 * React hook that returns `true` when the user prefers reduced motion.
 *
 * Uses `matchMedia` to listen for `prefers-reduced-motion: reduce`.
 * Updates reactively if the user changes their system preference.
 *
 * @example
 * ```tsx
 * const prefersReduced = useReducedMotion();
 * <motion.div animate={prefersReduced ? {} : { scale: 1.1 }} />
 * ```
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, prefersReducedMotion, () => false);
}

/**
 * Returns animation props for framer-motion components.
 * When reduced motion is preferred, returns static values (no animation).
 *
 * @example
 * ```tsx
 * const { shouldAnimate, transition } = useMotionSafe();
 * <motion.div
 *   initial={shouldAnimate ? { opacity: 0 } : false}
 *   animate={{ opacity: 1 }}
 *   transition={transition}
 * />
 * ```
 */
export function useMotionSafe() {
  const prefersReduced = useReducedMotion();

  return {
    /** Whether animations should be shown */
    shouldAnimate: !prefersReduced,
    /** Transition config — instant when reduced motion is preferred */
    transition: prefersReduced ? { duration: 0 } : undefined,
    /** Variant for initial state — `false` disables entry animation */
    initial: prefersReduced ? false : undefined,
  };
}

/**
 * Helper to get reduced-motion-safe animation duration.
 * Returns 0 when reduced motion is preferred, otherwise the provided duration.
 */
export function getMotionDuration(
  durationMs: number,
  prefersReduced: boolean,
): number {
  return prefersReduced ? 0 : durationMs;
}

/**
 * Check if the user prefers reduced motion (non-reactive, synchronous).
 * Useful outside of React components. Returns false during SSR.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function subscribeToReducedMotion(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = () => onStoreChange();

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }

  mq.addListener(handler);
  return () => mq.removeListener(handler);
}
