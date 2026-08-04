// SPDX-License-Identifier: Apache-2.0
/**
 * Editor Store — Zustand state management for the Design Studio
 *
 * This store defines the shape of all editor state that was previously managed
 * via ~50 useState calls inside the monolithic editor.tsx component.
 *
 * Migration strategy:
 * 1. (This sprint) Define store shape + selectors + actions
 * 2. (Future sprint) Replace useState calls in editor.tsx with useEditorStore
 * 3. (Future sprint) Extract sub-components that read from store directly
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §3.3.1 — State Management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  DesignState,
  DesignElement,
  Tool,
  SidebarTab,
  VersionSnapshot,
  ExportFormat,
} from '@/components/design/editor-types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditorStoreState {
  // ── Design data ──
  design: DesignState;
  /** Undo stack (most recent state at end) */
  history: DesignState[];
  /** Redo stack (next state at front) */
  future: DesignState[];

  // ── Selection ──
  selectedIds: Set<string>;
  editingTextId: string | null;

  // ── Tool ──
  tool: Tool;
  sidebarTab: SidebarTab | null;

  // ── Viewport ──
  zoom: number;
  panX: number;
  panY: number;

  // ── UI state ──
  saving: boolean;
  saved: boolean;
  showShortcuts: boolean;
  showVersions: boolean;
  showExportDialog: boolean;
  showLayers: boolean;
  showGrid: boolean;
  showRulers: boolean;

  // ── Export ──
  exportFormat: ExportFormat;
  exportScale: number;
  exportQuality: number;
  exportTransparent: boolean;

  // ── Versions ──
  snapshots: VersionSnapshot[];

  // ── Autosave ──
  lastSavedAt: Date | null;
}

interface EditorStoreActions {
  // ── Design mutations ──
  setDesign: (
    design: DesignState | ((prev: DesignState) => DesignState),
  ) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // ── Selection ──
  setSelectedIds: (ids: Set<string>) => void;
  clearSelection: () => void;
  setEditingTextId: (id: string | null) => void;

  // ── Tool ──
  setTool: (tool: Tool) => void;
  setSidebarTab: (tab: SidebarTab | null) => void;

  // ── Viewport ──
  setZoom: (zoom: number | ((prev: number) => number)) => void;
  setPan: (x: number, y: number) => void;
  resetViewport: () => void;

  // ── UI toggles ──
  setSaving: (saving: boolean) => void;
  setSaved: (saved: boolean) => void;
  toggleShortcuts: () => void;
  toggleVersions: () => void;
  toggleExportDialog: () => void;
  toggleLayers: () => void;
  toggleGrid: () => void;
  toggleRulers: () => void;

  // ── Export ──
  setExportFormat: (format: ExportFormat) => void;
  setExportScale: (scale: number) => void;
  setExportQuality: (quality: number) => void;
  setExportTransparent: (transparent: boolean) => void;

  // ── Versions ──
  addSnapshot: (name: string) => void;
  restoreSnapshot: (index: number) => void;

  // ── Element operations (convenience) ──
  deleteSelected: () => void;
  duplicateSelected: () => void;

  // ── Reset ──
  reset: (width?: number, height?: number) => void;
}

export type EditorStore = EditorStoreState & EditorStoreActions;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;

function defaultDesign(w = 1200, h = 800): DesignState {
  return {
    version: 1,
    width: w,
    height: h,
    background: '#ffffff',
    elements: [],
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorStore>()(
  subscribeWithSelector((set, get) => ({
    // ── Initial state ──
    design: defaultDesign(),
    history: [],
    future: [],
    selectedIds: new Set<string>(),
    editingTextId: null,
    tool: 'select' as Tool,
    sidebarTab: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    saving: false,
    saved: false,
    showShortcuts: false,
    showVersions: false,
    showExportDialog: false,
    showLayers: false,
    showGrid: false,
    showRulers: true,
    exportFormat: 'png' as ExportFormat,
    exportScale: 2,
    exportQuality: 92,
    exportTransparent: false,
    snapshots: [],
    lastSavedAt: null,

    // ── Design mutations ──
    setDesign: (designOrFn) =>
      set((s) => ({
        design:
          typeof designOrFn === 'function' ? designOrFn(s.design) : designOrFn,
      })),

    pushHistory: () =>
      set((s) => ({
        history: [...s.history.slice(-(MAX_HISTORY - 1)), s.design],
        future: [],
      })),

    undo: () => {
      const { history, design } = get();
      if (history.length === 0) return;
      const prev = history[history.length - 1];
      set({
        design: prev,
        history: history.slice(0, -1),
        future: [design, ...get().future.slice(0, MAX_HISTORY - 1)],
      });
    },

    redo: () => {
      const { future, design } = get();
      if (future.length === 0) return;
      const next = future[0];
      set({
        design: next,
        future: future.slice(1),
        history: [...get().history.slice(-(MAX_HISTORY - 1)), design],
      });
    },

    // ── Selection ──
    setSelectedIds: (ids) => set({ selectedIds: ids }),
    clearSelection: () => set({ selectedIds: new Set() }),
    setEditingTextId: (id) => set({ editingTextId: id }),

    // ── Tool ──
    setTool: (tool) => set({ tool }),
    setSidebarTab: (tab) => set({ sidebarTab: tab }),

    // ── Viewport ──
    setZoom: (zoomOrFn) =>
      set((s) => ({
        zoom:
          typeof zoomOrFn === 'function'
            ? Math.max(0.25, Math.min(4, zoomOrFn(s.zoom)))
            : Math.max(0.25, Math.min(4, zoomOrFn)),
      })),
    setPan: (x, y) => set({ panX: x, panY: y }),
    resetViewport: () => set({ zoom: 1, panX: 0, panY: 0 }),

    // ── UI toggles ──
    setSaving: (saving) => set({ saving }),
    setSaved: (saved) => set({ saved }),
    toggleShortcuts: () => set((s) => ({ showShortcuts: !s.showShortcuts })),
    toggleVersions: () => set((s) => ({ showVersions: !s.showVersions })),
    toggleExportDialog: () =>
      set((s) => ({ showExportDialog: !s.showExportDialog })),
    toggleLayers: () => set((s) => ({ showLayers: !s.showLayers })),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    toggleRulers: () => set((s) => ({ showRulers: !s.showRulers })),

    // ── Export ──
    setExportFormat: (format) => set({ exportFormat: format }),
    setExportScale: (scale) => set({ exportScale: scale }),
    setExportQuality: (quality) => set({ exportQuality: quality }),
    setExportTransparent: (transparent) =>
      set({ exportTransparent: transparent }),

    // ── Versions ──
    addSnapshot: (name) =>
      set((s) => ({
        snapshots: [
          ...s.snapshots,
          { name, state: structuredClone(s.design), createdAt: new Date() },
        ],
      })),
    restoreSnapshot: (index) => {
      const { snapshots, design } = get();
      if (index < 0 || index >= snapshots.length) return;
      set({
        history: [...get().history.slice(-(MAX_HISTORY - 1)), design],
        future: [],
        design: structuredClone(snapshots[index].state),
      });
    },

    // ── Element operations ──
    deleteSelected: () => {
      const { selectedIds, design } = get();
      if (selectedIds.size === 0) return;
      get().pushHistory();
      set({
        design: {
          ...design,
          elements: design.elements.filter((el) => !selectedIds.has(el.id)),
        },
        selectedIds: new Set(),
      });
    },

    duplicateSelected: () => {
      const { selectedIds, design } = get();
      if (selectedIds.size === 0) return;
      get().pushHistory();
      let counter = 0;
      const duped = design.elements
        .filter((el) => selectedIds.has(el.id))
        .map((el) => ({
          ...el,
          id: `el_${Date.now()}_dup_${++counter}`,
          x: el.x + 20,
          y: el.y + 20,
        }));
      set({
        design: {
          ...design,
          elements: [...design.elements, ...duped],
        },
        selectedIds: new Set(duped.map((el) => el.id)),
      });
    },

    // ── Reset ──
    reset: (w = 1200, h = 800) =>
      set({
        design: defaultDesign(w, h),
        history: [],
        future: [],
        selectedIds: new Set(),
        editingTextId: null,
        tool: 'select' as Tool,
        sidebarTab: null,
        zoom: 1,
        panX: 0,
        panY: 0,
        saving: false,
        saved: false,
        snapshots: [],
        lastSavedAt: null,
      }),
  })),
);
