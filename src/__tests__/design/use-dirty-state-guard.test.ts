// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useDirtyStateGuard } from '@/components/design/use-dirty-state-guard';

describe('useDirtyStateGuard', () => {
  const addSpy = vi.spyOn(window, 'addEventListener');
  const removeSpy = vi.spyOn(window, 'removeEventListener');

  afterEach(() => {
    addSpy.mockClear();
    removeSpy.mockClear();
  });

  it('does not register a beforeunload handler when clean', () => {
    renderHook(() => useDirtyStateGuard(false));
    const beforeUnloadCalls = addSpy.mock.calls.filter(
      ([type]) => type === 'beforeunload',
    );
    expect(beforeUnloadCalls).toHaveLength(0);
  });

  it('registers and tears down a beforeunload handler when dirty', () => {
    const { unmount } = renderHook(() => useDirtyStateGuard(true));
    const added = addSpy.mock.calls.filter(([t]) => t === 'beforeunload');
    expect(added).toHaveLength(1);
    unmount();
    const removed = removeSpy.mock.calls.filter(([t]) => t === 'beforeunload');
    expect(removed).toHaveLength(1);
  });

  it('sets returnValue on the event when dirty so the browser prompts', () => {
    renderHook(() => useDirtyStateGuard(true, 'custom warning'));
    const handler = addSpy.mock.calls.find(([t]) => t === 'beforeunload')![1] as
      | EventListener
      | undefined;
    expect(typeof handler).toBe('function');
    const event = {
      preventDefault: vi.fn(),
      returnValue: '',
    } as unknown as BeforeUnloadEvent;
    const result = handler!(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('custom warning');
    expect(result).toBe('custom warning');
  });
});
