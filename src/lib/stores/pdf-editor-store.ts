// SPDX-License-Identifier: Apache-2.0
/**
 * PDF Editor Store — Zustand state management for the PDF Editor
 *
 * Manages PDF viewer state, annotation tools, and editing state.
 * Will replace the local state in PdfEditorShell.tsx when that component
 * is decomposed in a future sprint.
 *
 * @see agent-docs/plans/PDF_EDITOR_MASTER_PLAN.md
 */

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PdfTool =
  | 'select'
  | 'text'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'draw'
  | 'signature'
  | 'stamp'
  | 'comment'
  | 'redact'
  | 'image';

export interface PdfPageState {
  pageNumber: number;
  rotation: number;
}

interface PdfEditorStoreState {
  // ── Document ──
  /** Total page count in the loaded PDF */
  totalPages: number;
  /** Currently visible page (1-based) */
  currentPage: number;
  /** Zoom level (1 = 100%) */
  zoom: number;

  // ── Tool ──
  activeTool: PdfTool;

  // ── UI ──
  showThumbnails: boolean;
  showComments: boolean;
  showProperties: boolean;

  // ── Editing state ──
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;

  // ── Undo/Redo ──
  canUndo: boolean;
  canRedo: boolean;
}

interface PdfEditorStoreActions {
  // ── Document ──
  setTotalPages: (count: number) => void;
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;

  // ── Zoom ──
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;

  // ── Tool ──
  setActiveTool: (tool: PdfTool) => void;

  // ── UI ──
  toggleThumbnails: () => void;
  toggleComments: () => void;
  toggleProperties: () => void;

  // ── Editing ──
  markDirty: () => void;
  markSaved: () => void;
  setCanUndo: (can: boolean) => void;
  setCanRedo: (can: boolean) => void;

  // ── Reset ──
  reset: () => void;
}

export type PdfEditorStore = PdfEditorStoreState & PdfEditorStoreActions;

// ─── Store ────────────────────────────────────────────────────────────────────

const initialState: PdfEditorStoreState = {
  totalPages: 0,
  currentPage: 1,
  zoom: 1,
  activeTool: 'select',
  showThumbnails: true,
  showComments: false,
  showProperties: false,
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
  canUndo: false,
  canRedo: false,
};

export const usePdfEditorStore = create<PdfEditorStore>()((set, get) => ({
  ...initialState,

  // ── Document ──
  setTotalPages: (count) => set({ totalPages: count }),
  setCurrentPage: (page) =>
    set((s) => ({
      currentPage: Math.max(1, Math.min(page, s.totalPages || 1)),
    })),
  nextPage: () =>
    set((s) => ({
      currentPage: Math.min(s.currentPage + 1, s.totalPages || 1),
    })),
  previousPage: () =>
    set((s) => ({ currentPage: Math.max(1, s.currentPage - 1) })),

  // ── Zoom ──
  setZoom: (zoomOrFn) =>
    set((s) => ({
      zoom:
        typeof zoomOrFn === 'function'
          ? Math.max(0.25, Math.min(5, zoomOrFn(s.zoom)))
          : Math.max(0.25, Math.min(5, zoomOrFn)),
    })),
  zoomIn: () => set((s) => ({ zoom: Math.min(5, s.zoom + 0.25) })),
  zoomOut: () => set((s) => ({ zoom: Math.max(0.25, s.zoom - 0.25) })),
  zoomFit: () => set({ zoom: 1 }),

  // ── Tool ──
  setActiveTool: (tool) => set({ activeTool: tool }),

  // ── UI ──
  toggleThumbnails: () => set((s) => ({ showThumbnails: !s.showThumbnails })),
  toggleComments: () => set((s) => ({ showComments: !s.showComments })),
  toggleProperties: () => set((s) => ({ showProperties: !s.showProperties })),

  // ── Editing ──
  markDirty: () => set({ isDirty: true }),
  markSaved: () =>
    set({ isDirty: false, isSaving: false, lastSavedAt: new Date() }),
  setCanUndo: (can) => set({ canUndo: can }),
  setCanRedo: (can) => set({ canRedo: can }),

  // ── Reset ──
  reset: () => set(initialState),
}));
