// SPDX-License-Identifier: Apache-2.0
/**
 * Keyboard accessibility helpers (D39).
 *
 * The Design Studio sidebar, toolbar, and canvas wrappers historically used
 * ad-hoc `onKeyDown` handlers. This module centralises the small set of
 * patterns we actually rely on so each consumer just calls a helper:
 *
 *   - `isActivationKey(e)` \u2014 Enter or Space, the WAI-ARIA activation contract.
 *   - `isEscapeKey(e)` \u2014 explicit Esc detection that ignores IME composition.
 *   - `isTypingTarget(target)` \u2014 returns true when focus is in an input,
 *     textarea, contentEditable element, or a `[role="textbox"]`. Use this to
 *     skip global hotkeys while the user is typing.
 *   - `getRovingTabIndex(activeIndex, index)` \u2014 returns `0` for the active
 *     item and `-1` otherwise. Roving tabindex is the standard pattern for
 *     listbox / toolbar / menu navigation.
 *   - `nextRovingIndex(current, length, key, orientation)` \u2014 computes the
 *     new active index for arrow-key navigation. Wraps at the ends.
 *
 * Pure functions; no React, no DOM mutation. Easy to unit-test, and reusable
 * from any framework.
 */

export interface KeyboardEventLike {
  key: string;
  /** When `true`, the event is part of an IME composition; should be ignored. */
  isComposing?: boolean;
  /** Discriminator so the helpers can also accept `KeyboardEvent`. */
  type?: string;
}

export type ListOrientation = 'horizontal' | 'vertical' | 'both';

/** Enter / Space \u2014 the canonical "activate this control" keys. */
export function isActivationKey(e: KeyboardEventLike): boolean {
  if (e.isComposing) return false;
  return e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar';
}

/** Esc, ignoring IME composition. */
export function isEscapeKey(e: KeyboardEventLike): boolean {
  if (e.isComposing) return false;
  return e.key === 'Escape' || e.key === 'Esc';
}

interface DomLikeElement {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (name: string) => string | null;
}

/**
 * `true` when global keyboard shortcuts should be suppressed because the user
 * is currently typing.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as DomLikeElement;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable === true) return true;
  const role = el.getAttribute?.('role');
  if (role === 'textbox' || role === 'searchbox' || role === 'combobox') return true;
  return false;
}

/** Roving tabindex value. `0` for the active descendant, `-1` for the rest. */
export function getRovingTabIndex(activeIndex: number, index: number): -1 | 0 {
  return index === activeIndex ? 0 : -1;
}

/**
 * Compute the next active index for an arrow-key roving group. Returns the
 * input `current` when the key isn't relevant for the configured orientation.
 *
 *   - Horizontal lists move on ArrowLeft / ArrowRight.
 *   - Vertical lists move on ArrowUp / ArrowDown.
 *   - Both moves on all four arrows.
 *   - Home / End jump to the first / last item regardless of orientation.
 *
 * Wraps at the ends (the WAI-ARIA toolbar pattern).
 */
export function nextRovingIndex(
  current: number,
  length: number,
  key: string,
  orientation: ListOrientation = 'vertical',
): number {
  if (length <= 0) return current;
  const safe = ((current % length) + length) % length;

  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;

  const horizontal = orientation === 'horizontal' || orientation === 'both';
  const vertical = orientation === 'vertical' || orientation === 'both';

  if (vertical && key === 'ArrowDown') return (safe + 1) % length;
  if (vertical && key === 'ArrowUp') return (safe - 1 + length) % length;
  if (horizontal && key === 'ArrowRight') return (safe + 1) % length;
  if (horizontal && key === 'ArrowLeft') return (safe - 1 + length) % length;

  return safe;
}
