// SPDX-License-Identifier: Apache-2.0
/**
 * Gallery Store — Zustand state management for the Asset Grid / Library
 *
 * Manages asset grid view state, selection, filtering, and sorting.
 * Will replace the local state in asset-grid.tsx (1,733 lines) when that
 * component is decomposed in a future sprint.
 *
 * @see docs/COMPETITIVE_ANALYSIS_AND_ROADMAP.md §3.3.2 — asset-grid.tsx split
 */

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = 'grid' | 'list' | 'masonry';
export type SortField = 'name' | 'createdAt' | 'size' | 'mimeType';
export type SortDirection = 'asc' | 'desc';

interface GalleryStoreState {
  // ── View ──
  viewMode: ViewMode;
  /** Number of columns (grid mode); 0 = auto */
  columns: number;

  // ── Selection ──
  selectedAssetIds: Set<string>;
  /** Currently open asset (detail drawer) */
  activeAssetId: string | null;

  // ── Filtering ──
  searchQuery: string;
  fileTypeFilter: string | null;
  tagFilter: string[];
  starredOnly: boolean;

  // ── Sorting ──
  sortField: SortField;
  sortDirection: SortDirection;

  // ── Scroll ──
  scrollPosition: number;
}

interface GalleryStoreActions {
  // ── View ──
  setViewMode: (mode: ViewMode) => void;
  setColumns: (cols: number) => void;

  // ── Selection ──
  selectAsset: (id: string) => void;
  deselectAsset: (id: string) => void;
  toggleAssetSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setActiveAsset: (id: string | null) => void;

  // ── Filtering ──
  setSearchQuery: (query: string) => void;
  setFileTypeFilter: (type: string | null) => void;
  setTagFilter: (tags: string[]) => void;
  toggleStarredOnly: () => void;

  // ── Sorting ──
  setSort: (field: SortField, direction?: SortDirection) => void;
  toggleSortDirection: () => void;

  // ── Scroll ──
  setScrollPosition: (pos: number) => void;

  // ── Reset ──
  reset: () => void;
}

export type GalleryStore = GalleryStoreState & GalleryStoreActions;

// ─── Store ────────────────────────────────────────────────────────────────────

const initialState: GalleryStoreState = {
  viewMode: 'grid',
  columns: 0,
  selectedAssetIds: new Set(),
  activeAssetId: null,
  searchQuery: '',
  fileTypeFilter: null,
  tagFilter: [],
  starredOnly: false,
  sortField: 'createdAt',
  sortDirection: 'desc',
  scrollPosition: 0,
};

export const useGalleryStore = create<GalleryStore>()((set, get) => ({
  ...initialState,

  // ── View ──
  setViewMode: (mode) => set({ viewMode: mode }),
  setColumns: (cols) => set({ columns: cols }),

  // ── Selection ──
  selectAsset: (id) =>
    set((s) => ({
      selectedAssetIds: new Set([...s.selectedAssetIds, id]),
    })),
  deselectAsset: (id) =>
    set((s) => {
      const next = new Set(s.selectedAssetIds);
      next.delete(id);
      return { selectedAssetIds: next };
    }),
  toggleAssetSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedAssetIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedAssetIds: next };
    }),
  selectAll: (ids) => set({ selectedAssetIds: new Set(ids) }),
  clearSelection: () => set({ selectedAssetIds: new Set() }),
  setActiveAsset: (id) => set({ activeAssetId: id }),

  // ── Filtering ──
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFileTypeFilter: (type) => set({ fileTypeFilter: type }),
  setTagFilter: (tags) => set({ tagFilter: tags }),
  toggleStarredOnly: () => set((s) => ({ starredOnly: !s.starredOnly })),

  // ── Sorting ──
  setSort: (field, direction) =>
    set((s) => ({
      sortField: field,
      sortDirection:
        direction ??
        (s.sortField === field && s.sortDirection === 'asc' ? 'desc' : 'asc'),
    })),
  toggleSortDirection: () =>
    set((s) => ({ sortDirection: s.sortDirection === 'asc' ? 'desc' : 'asc' })),

  // ── Scroll ──
  setScrollPosition: (pos) => set({ scrollPosition: pos }),

  // ── Reset ──
  reset: () => set(initialState),
}));
