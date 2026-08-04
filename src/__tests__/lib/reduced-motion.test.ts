// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, beforeEach } from 'vitest';
import { getMotionDuration, prefersReducedMotion } from '@/lib/reduced-motion';

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('getMotionDuration', () => {
  it('returns 0 when reduced motion is preferred', () => {
    expect(getMotionDuration(300, true)).toBe(0);
    expect(getMotionDuration(1000, true)).toBe(0);
  });

  it('returns the original duration when motion is not reduced', () => {
    expect(getMotionDuration(300, false)).toBe(300);
    expect(getMotionDuration(0, false)).toBe(0);
    expect(getMotionDuration(1500, false)).toBe(1500);
  });
});

describe('prefersReducedMotion', () => {
  it('returns a boolean', () => {
    const result = prefersReducedMotion();
    expect(typeof result).toBe('boolean');
  });

  it('returns true when reduce media query matches', () => {
    expect(prefersReducedMotion()).toBe(true);
  });
});
