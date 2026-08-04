// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect } from 'react';

/**
 * Warns the user before unloading the page when the editor has
 * unsaved changes. Pairs with the autosave loop in `editor.tsx`:
 * pass `isDirty=true` while a debounced save is pending or in flight,
 * `false` once `lastSavedJsonRef` matches the current design state.
 *
 * D34 — `v0.14.0` Design Studio v1.0 floor.
 */
export function useDirtyStateGuard(
  isDirty: boolean,
  message = 'You have unsaved design changes. Leave anyway?',
): void {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      // Spec: assigning returnValue (and returning a string) triggers
      // the browser's native confirmation dialog. Modern browsers ignore
      // the custom message and show their own copy.
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, message]);
}
