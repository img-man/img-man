// SPDX-License-Identifier: Apache-2.0
/**
 * useKeyboard Hook
 *
 * Binds keyboard shortcuts for the PDF editor.
 * Prevents default browser behavior for captured shortcuts.
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { KEYBOARD_SHORTCUTS, TOOL_SHORTCUT_MAP } from '../constants';
import type { ToolType } from '../types';

export interface UseKeyboardParams {
  /** Whether the editor is active (shortcuts only fire when active) */
  isActive: boolean;
  /** Undo handler */
  onUndo: () => void;
  /** Redo handler */
  onRedo: () => void;
  /** Save handler */
  onSave: () => void;
  /** Tool change handler */
  onToolChange: (tool: ToolType) => void;
  /** Delete selected handler */
  onDelete: () => void;
  /** Deselect handler */
  onDeselect: () => void;
  /** Select all handler */
  onSelectAll: () => void;
  /** Zoom in handler */
  onZoomIn: () => void;
  /** Zoom out handler */
  onZoomOut: () => void;
  /** Fit to page handler */
  onFitPage: () => void;
  /** Actual size handler */
  onActualSize: () => void;
  /** Previous page handler */
  onPrevPage: () => void;
  /** Next page handler */
  onNextPage: () => void;
  /** First page handler */
  onFirstPage: () => void;
  /** Last page handler */
  onLastPage: () => void;
  /** Find & Replace handler */
  onFindReplace?: () => void;
  /** Called when Space is held to temporarily activate pan mode */
  onPanStart?: () => void;
  /** Called when Space is released to restore the previous tool */
  onPanEnd?: () => void;
}

export function useKeyboard(params: UseKeyboardParams): void {
  const {
    isActive,
    onUndo,
    onRedo,
    onSave,
    onToolChange,
    onDelete,
    onDeselect,
    onSelectAll,
    onZoomIn,
    onZoomOut,
    onFitPage,
    onActualSize,
    onPrevPage,
    onNextPage,
    onFirstPage,
    onLastPage,
    onFindReplace,
    onPanStart,
    onPanEnd,
  } = params;

  // Track whether Space is currently held for pan mode
  const isSpaceHeldRef = useRef(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return;

      // Don't capture when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        // But still allow Escape
        if (e.key !== 'Escape') return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;

      // Ctrl+Z → Undo
      if (ctrl && !shift && key === 'z') {
        e.preventDefault();
        onUndo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z → Redo
      if (
        (ctrl && key === 'y') ||
        (ctrl && shift && key === 'z') ||
        (ctrl && shift && key === 'Z')
      ) {
        e.preventDefault();
        onRedo();
        return;
      }

      // Ctrl+S → Save
      if (ctrl && key === 's') {
        e.preventDefault();
        onSave();
        return;
      }

      // Ctrl+A → Select All
      if (ctrl && key === 'a') {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // Ctrl+F → Find & Replace
      if (ctrl && key === 'f') {
        e.preventDefault();
        onFindReplace?.();
        return;
      }

      // Ctrl+= or Ctrl++ → Zoom In
      if (ctrl && (key === '=' || key === '+')) {
        e.preventDefault();
        onZoomIn();
        return;
      }

      // Ctrl+- → Zoom Out
      if (ctrl && key === '-') {
        e.preventDefault();
        onZoomOut();
        return;
      }

      // Ctrl+0 → Fit to Page
      if (ctrl && key === '0') {
        e.preventDefault();
        onFitPage();
        return;
      }

      // Ctrl+1 → Actual Size
      if (ctrl && key === '1') {
        e.preventDefault();
        onActualSize();
        return;
      }

      // Navigation
      if (key === 'PageUp') {
        e.preventDefault();
        onPrevPage();
        return;
      }
      if (key === 'PageDown') {
        e.preventDefault();
        onNextPage();
        return;
      }
      if (ctrl && key === 'Home') {
        e.preventDefault();
        onFirstPage();
        return;
      }
      if (ctrl && key === 'End') {
        e.preventDefault();
        onLastPage();
        return;
      }

      // Delete/Backspace → Delete selected
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault();
        onDelete();
        return;
      }

      // Escape → Deselect
      if (key === 'Escape') {
        e.preventDefault();
        onDeselect();
        return;
      }

      // Single key tool shortcuts (only when no modifiers)
      if (!ctrl && !shift && !e.altKey) {
        // Space → Temporary pan mode (hold to pan, release to restore)
        if (key === ' ') {
          e.preventDefault();
          if (!isSpaceHeldRef.current) {
            isSpaceHeldRef.current = true;
            onPanStart?.();
          }
          return;
        }

        const toolMap: Record<string, ToolType> = {
          v: 'select',
          t: 'text',
          h: 'highlight',
          w: 'whiteout',
        };

        const tool = toolMap[key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          onToolChange(tool);
          return;
        }
      }
    },
    [
      isActive,
      onUndo,
      onRedo,
      onSave,
      onToolChange,
      onDelete,
      onDeselect,
      onSelectAll,
      onZoomIn,
      onZoomOut,
      onFitPage,
      onActualSize,
      onPrevPage,
      onNextPage,
      onFirstPage,
      onLastPage,
      onFindReplace,
      onPanStart,
    ],
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) return;
      if (e.key === ' ' && isSpaceHeldRef.current) {
        isSpaceHeldRef.current = false;
        onPanEnd?.();
      }
    },
    [isActive, onPanEnd],
  );

  // Also reset pan when window loses focus (e.g. user Alt-Tabs while holding Space)
  const handleBlur = useCallback(() => {
    if (isSpaceHeldRef.current) {
      isSpaceHeldRef.current = false;
      onPanEnd?.();
    }
  }, [onPanEnd]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, handleBlur]);
}
