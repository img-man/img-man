// SPDX-License-Identifier: Apache-2.0
/**
 * Design Editor Helpers
 *
 * Pure utility functions and constants extracted from editor.tsx.
 * These have zero state dependencies and can be used across editor modules.
 */

import type { DesignState, Handle, Tool } from './editor-types';

// ─── ID Generation ────────────────────────────────────────────────────────────

let _idCounter = 0;

/** Generate a unique element ID (deterministic prefix + incrementing counter) */
export const genId = () => `el_${Date.now()}_${++_idCounter}`;

/** Reset counter (for testing) */
export const resetIdCounter = () => {
  _idCounter = 0;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Size of selection handles in pixels */
export const HANDLE_PX = 8;

/** Maximum undo/redo history depth */
export const MAX_HISTORY = 50;

/** CSS cursor for each resize handle direction */
export const HANDLE_CURSORS: Record<string, string> = {
  nw: 'nw-resize',
  n: 'n-resize',
  ne: 'ne-resize',
  e: 'e-resize',
  se: 'se-resize',
  s: 's-resize',
  sw: 'sw-resize',
  w: 'w-resize',
};

/** Available font families for the text tool */
export const FONT_LIST = [
  'sans-serif',
  'serif',
  'monospace',
  'Arial',
  'Georgia',
  'Verdana',
  'Courier New',
  'Times New Roman',
  'Trebuchet MS',
  'Impact',
  'Comic Sans MS',
  'Lucida Console',
  'Tahoma',
  'Palatino',
  'Garamond',
  'Bookman',
  'Avant Garde',
  'Helvetica',
  'Gill Sans',
  'Century Gothic',
  'Franklin Gothic',
  'Futura',
  'Rockwell',
  'Copperplate',
] as const;

// ─── Pure Functions ───────────────────────────────────────────────────────────

/**
 * Convert a client-space pointer event coordinate to SVG user-space coordinates.
 * Used for accurate element placement/interaction on the design canvas.
 */
export function getSvgPoint(
  e: { clientX: number; clientY: number },
  svg: SVGSVGElement,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: e.clientX, y: e.clientY };
  const result = pt.matrixTransform(ctm.inverse());
  return { x: result.x, y: result.y };
}

/**
 * Create a default empty design state with the given dimensions.
 */
export function makeDefaultState(w: number, h: number): DesignState {
  return {
    version: 1,
    width: w,
    height: h,
    background: '#ffffff',
    elements: [],
  };
}

/**
 * Tool shortcut key mapping. Single lowercase key → Tool type.
 * Used in the keyboard handler and the shortcuts help dialog.
 */
export const TOOL_SHORTCUTS: Record<string, Tool> = {
  v: 'select',
  t: 'text',
  r: 'rect',
  o: 'ellipse',
  l: 'line',
  h: 'hand',
  p: 'pen',
};

/**
 * All keyboard shortcuts defined as a data structure.
 * Used for the shortcuts help dialog (Ctrl+/) and command palette.
 */
export const KEYBOARD_SHORTCUTS = [
  // Tool selection
  { keys: ['V'], action: 'Select tool', category: 'Tools' },
  { keys: ['T'], action: 'Text tool', category: 'Tools' },
  { keys: ['R'], action: 'Rectangle tool', category: 'Tools' },
  { keys: ['O'], action: 'Ellipse tool', category: 'Tools' },
  { keys: ['L'], action: 'Line tool', category: 'Tools' },
  { keys: ['H'], action: 'Hand/Pan tool', category: 'Tools' },
  { keys: ['P'], action: 'Pen tool', category: 'Tools' },

  // Edit operations
  { keys: ['Ctrl', 'Z'], action: 'Undo', category: 'Edit' },
  { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo', category: 'Edit' },
  { keys: ['Ctrl', 'Y'], action: 'Redo (alternate)', category: 'Edit' },
  { keys: ['Ctrl', 'C'], action: 'Copy', category: 'Edit' },
  { keys: ['Ctrl', 'V'], action: 'Paste', category: 'Edit' },
  { keys: ['Ctrl', 'X'], action: 'Cut', category: 'Edit' },
  { keys: ['Ctrl', 'D'], action: 'Duplicate', category: 'Edit' },
  { keys: ['Ctrl', 'A'], action: 'Select all', category: 'Edit' },
  { keys: ['Delete'], action: 'Delete selected', category: 'Edit' },
  { keys: ['Backspace'], action: 'Delete selected', category: 'Edit' },
  { keys: ['Escape'], action: 'Deselect / Exit mode', category: 'Edit' },

  // Grouping
  { keys: ['Ctrl', 'G'], action: 'Group selected', category: 'Arrange' },
  { keys: ['Ctrl', 'Shift', 'G'], action: 'Ungroup', category: 'Arrange' },
  { keys: [']'], action: 'Bring forward', category: 'Arrange' },
  { keys: ['['], action: 'Send backward', category: 'Arrange' },

  // Navigation
  { keys: ['Arrow keys'], action: 'Nudge 1px', category: 'Move' },
  { keys: ['Shift', 'Arrow keys'], action: 'Nudge 10px', category: 'Move' },
  { keys: ['Space', 'Drag'], action: 'Pan canvas', category: 'Navigation' },

  // Zoom
  { keys: ['Ctrl', '+'], action: 'Zoom in', category: 'Zoom' },
  { keys: ['Ctrl', '-'], action: 'Zoom out', category: 'Zoom' },
  { keys: ['Ctrl', '0'], action: 'Reset zoom & pan', category: 'Zoom' },
  { keys: ['Ctrl', '1'], action: 'Zoom to 100%', category: 'Zoom' },

  // Save
  { keys: ['Ctrl', 'S'], action: 'Save', category: 'File' },
  {
    keys: ['Ctrl', 'Shift', 'S'],
    action: 'Save version snapshot',
    category: 'File',
  },

  // Help
  { keys: ['Ctrl', '/'], action: 'Toggle shortcuts help', category: 'Help' },
] as const;

/**
 * Get all shortcut categories (unique, ordered).
 */
export function getShortcutCategories(): string[] {
  const cats = new Set(KEYBOARD_SHORTCUTS.map((s) => s.category));
  return Array.from(cats);
}

/**
 * Get shortcuts filtered by category.
 */
export function getShortcutsByCategory(
  category: string,
): (typeof KEYBOARD_SHORTCUTS)[number][] {
  return KEYBOARD_SHORTCUTS.filter((s) => s.category === category);
}
