// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  getRovingTabIndex,
  isActivationKey,
  isEscapeKey,
  isTypingTarget,
  nextRovingIndex,
} from '@/lib/a11y-keys';

describe('isActivationKey / isEscapeKey (D39)', () => {
  it('treats Enter and Space as activation', () => {
    expect(isActivationKey({ key: 'Enter' })).toBe(true);
    expect(isActivationKey({ key: ' ' })).toBe(true);
    expect(isActivationKey({ key: 'Spacebar' })).toBe(true);
    expect(isActivationKey({ key: 'a' })).toBe(false);
  });
  it('ignores activation keys during IME composition', () => {
    expect(isActivationKey({ key: 'Enter', isComposing: true })).toBe(false);
  });
  it('detects Escape under both spellings', () => {
    expect(isEscapeKey({ key: 'Escape' })).toBe(true);
    expect(isEscapeKey({ key: 'Esc' })).toBe(true);
    expect(isEscapeKey({ key: 'Enter' })).toBe(false);
    expect(isEscapeKey({ key: 'Escape', isComposing: true })).toBe(false);
  });
});

describe('isTypingTarget (D39)', () => {
  const make = (overrides: Partial<HTMLElement> & { role?: string }): EventTarget => ({
    tagName: overrides.tagName,
    isContentEditable: overrides.isContentEditable,
    getAttribute: (name: string) => (name === 'role' ? overrides.role ?? null : null),
  } as unknown as EventTarget);

  it('detects inputs, textareas, selects, contentEditable, and ARIA roles', () => {
    expect(isTypingTarget(make({ tagName: 'INPUT' }))).toBe(true);
    expect(isTypingTarget(make({ tagName: 'TEXTAREA' }))).toBe(true);
    expect(isTypingTarget(make({ tagName: 'SELECT' }))).toBe(true);
    expect(isTypingTarget(make({ tagName: 'DIV', isContentEditable: true }))).toBe(true);
    expect(isTypingTarget(make({ tagName: 'DIV', role: 'textbox' }))).toBe(true);
    expect(isTypingTarget(make({ tagName: 'DIV', role: 'searchbox' }))).toBe(true);
    expect(isTypingTarget(make({ tagName: 'BUTTON' }))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('getRovingTabIndex (D39)', () => {
  it('returns 0 for the active item and -1 otherwise', () => {
    expect(getRovingTabIndex(2, 2)).toBe(0);
    expect(getRovingTabIndex(2, 0)).toBe(-1);
  });
});

describe('nextRovingIndex (D39)', () => {
  it('moves on ArrowDown / ArrowUp by default and wraps at ends', () => {
    expect(nextRovingIndex(0, 3, 'ArrowDown')).toBe(1);
    expect(nextRovingIndex(2, 3, 'ArrowDown')).toBe(0);
    expect(nextRovingIndex(0, 3, 'ArrowUp')).toBe(2);
  });
  it('only honours horizontal arrows in horizontal orientation', () => {
    expect(nextRovingIndex(0, 3, 'ArrowDown', 'horizontal')).toBe(0);
    expect(nextRovingIndex(0, 3, 'ArrowRight', 'horizontal')).toBe(1);
    expect(nextRovingIndex(0, 3, 'ArrowLeft', 'horizontal')).toBe(2);
  });
  it('honours both orientations when orientation = "both"', () => {
    expect(nextRovingIndex(0, 3, 'ArrowDown', 'both')).toBe(1);
    expect(nextRovingIndex(0, 3, 'ArrowRight', 'both')).toBe(1);
  });
  it('Home / End jump regardless of orientation', () => {
    expect(nextRovingIndex(2, 4, 'Home')).toBe(0);
    expect(nextRovingIndex(0, 4, 'End', 'horizontal')).toBe(3);
  });
  it('returns current when the key is irrelevant or list is empty', () => {
    expect(nextRovingIndex(1, 3, 'a')).toBe(1);
    expect(nextRovingIndex(0, 0, 'ArrowDown')).toBe(0);
  });
});
