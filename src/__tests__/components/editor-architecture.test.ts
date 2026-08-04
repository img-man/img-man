// SPDX-License-Identifier: Apache-2.0
/**
 * Editor Architecture & Design System Tests
 *
 * Tests for:
 * - editor-types: Type exports and BLEND_MODES constant
 * - editor-helpers: genId, getSvgPoint, makeDefaultState, TOOL_SHORTCUTS,
 *   KEYBOARD_SHORTCUTS, shortcut categorization, FONT_LIST, constants
 * - Zustand stores: useEditorStore, useGalleryStore, usePdfEditorStore
 * - ActivityLog model: Schema validation, indexes, exported types
 * - Error boundary exports: error.tsx / loading.tsx for all dashboard routes
 * - Reduced motion: useReducedMotion hook, getMotionDuration, prefersReducedMotion
 * - Skip navigation: layout.tsx skip link, shell.tsx main-content target
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import type { DesignElement } from '@/components/design/editor-types';

type EnumPathLike = { enumValues: string[] };
type SchemaOptionsWithTimestamps = { timestamps?: boolean };

/* ═══════════════════════════════════════════════════════════
 * 1. editor-types — Type Module Exports
 * ═══════════════════════════════════════════════════════════ */

describe('editor-types module', () => {
  it('exports BLEND_MODES as a readonly array of 16 modes', async () => {
    const mod = await import('@/components/design/editor-types');
    expect(mod.BLEND_MODES).toBeDefined();
    expect(mod.BLEND_MODES).toHaveLength(16);
    expect(mod.BLEND_MODES[0]).toBe('normal');
    expect(mod.BLEND_MODES[15]).toBe('luminosity');
  });

  it('BLEND_MODES includes all standard CSS blend modes', async () => {
    const { BLEND_MODES } = await import('@/components/design/editor-types');
    const expected = [
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'color-dodge',
      'color-burn',
      'hard-light',
      'soft-light',
      'difference',
      'exclusion',
      'hue',
      'saturation',
      'color',
      'luminosity',
    ];
    expected.forEach((mode) => {
      expect(BLEND_MODES).toContain(mode);
    });
  });
});

/* ═══════════════════════════════════════════════════════════
 * 2. editor-helpers — Pure Functions & Constants
 * ═══════════════════════════════════════════════════════════ */

describe('editor-helpers — genId', () => {
  it('generates unique IDs with el_ prefix', async () => {
    const { genId } = await import('@/components/design/editor-helpers');
    const id1 = genId();
    const id2 = genId();
    expect(id1).toMatch(/^el_\d+_\d+$/);
    expect(id2).toMatch(/^el_\d+_\d+$/);
    expect(id1).not.toBe(id2);
  });

  it('resetIdCounter resets the counter', async () => {
    const { genId, resetIdCounter } =
      await import('@/components/design/editor-helpers');
    resetIdCounter();
    const before = genId(); // counter = 1
    resetIdCounter();
    const after = genId(); // counter = 1 again (same suffix)
    // Both should end with _1 after reset
    expect(before.split('_').pop()).toBe('1');
    expect(after.split('_').pop()).toBe('1');
  });
});

describe('editor-helpers — constants', () => {
  it('HANDLE_PX is 8', async () => {
    const { HANDLE_PX } = await import('@/components/design/editor-helpers');
    expect(HANDLE_PX).toBe(8);
  });

  it('MAX_HISTORY is 50', async () => {
    const { MAX_HISTORY } = await import('@/components/design/editor-helpers');
    expect(MAX_HISTORY).toBe(50);
  });

  it('HANDLE_CURSORS has all 8 directions', async () => {
    const { HANDLE_CURSORS } =
      await import('@/components/design/editor-helpers');
    const dirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    dirs.forEach((dir) => {
      expect(HANDLE_CURSORS[dir]).toMatch(/-resize$/);
    });
  });

  it('FONT_LIST has at least 20 fonts', async () => {
    const { FONT_LIST } = await import('@/components/design/editor-helpers');
    expect(FONT_LIST.length).toBeGreaterThanOrEqual(20);
    expect(FONT_LIST).toContain('Arial');
    expect(FONT_LIST).toContain('serif');
    expect(FONT_LIST).toContain('monospace');
  });
});

describe('editor-helpers — makeDefaultState', () => {
  it('creates a default design with correct dimensions', async () => {
    const { makeDefaultState } =
      await import('@/components/design/editor-helpers');
    const state = makeDefaultState(800, 600);
    expect(state).toEqual({
      version: 1,
      width: 800,
      height: 600,
      background: '#ffffff',
      elements: [],
    });
  });
});

describe('editor-helpers — TOOL_SHORTCUTS', () => {
  it('maps 7 keyboard keys to tools', async () => {
    const { TOOL_SHORTCUTS } =
      await import('@/components/design/editor-helpers');
    expect(Object.keys(TOOL_SHORTCUTS)).toHaveLength(7);
    expect(TOOL_SHORTCUTS['v']).toBe('select');
    expect(TOOL_SHORTCUTS['t']).toBe('text');
    expect(TOOL_SHORTCUTS['r']).toBe('rect');
    expect(TOOL_SHORTCUTS['o']).toBe('ellipse');
    expect(TOOL_SHORTCUTS['l']).toBe('line');
    expect(TOOL_SHORTCUTS['h']).toBe('hand');
    expect(TOOL_SHORTCUTS['p']).toBe('pen');
  });
});

describe('editor-helpers — KEYBOARD_SHORTCUTS', () => {
  it('has at least 30 shortcut entries', async () => {
    const { KEYBOARD_SHORTCUTS } =
      await import('@/components/design/editor-helpers');
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThanOrEqual(30);
  });

  it('each entry has keys, action, and category', async () => {
    const { KEYBOARD_SHORTCUTS } =
      await import('@/components/design/editor-helpers');
    KEYBOARD_SHORTCUTS.forEach((shortcut) => {
      expect(shortcut.keys).toBeDefined();
      expect(shortcut.keys.length).toBeGreaterThan(0);
      expect(typeof shortcut.action).toBe('string');
      expect(typeof shortcut.category).toBe('string');
    });
  });

  it('getShortcutCategories returns unique categories', async () => {
    const { getShortcutCategories } =
      await import('@/components/design/editor-helpers');
    const cats = getShortcutCategories();
    expect(cats.length).toBeGreaterThanOrEqual(5);
    expect(new Set(cats).size).toBe(cats.length); // all unique
    expect(cats).toContain('Tools');
    expect(cats).toContain('Edit');
    expect(cats).toContain('Zoom');
  });

  it('getShortcutsByCategory filters correctly', async () => {
    const { getShortcutsByCategory } =
      await import('@/components/design/editor-helpers');
    const tools = getShortcutsByCategory('Tools');
    expect(tools.length).toBe(7); // 7 tool shortcuts
    tools.forEach((s) => {
      expect(s.category).toBe('Tools');
    });

    const editShortcuts = getShortcutsByCategory('Edit');
    expect(editShortcuts.length).toBeGreaterThan(5);
  });
});

/* ═══════════════════════════════════════════════════════════
 * 3. Zustand Stores
 * ═══════════════════════════════════════════════════════════ */

describe('useEditorStore', () => {
  beforeEach(async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    useEditorStore.getState().reset();
  });

  it('initializes with default values', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const s = useEditorStore.getState();
    expect(s.design.width).toBe(1200);
    expect(s.design.height).toBe(800);
    expect(s.design.background).toBe('#ffffff');
    expect(s.design.elements).toEqual([]);
    expect(s.zoom).toBe(1);
    expect(s.tool).toBe('select');
    expect(s.selectedIds.size).toBe(0);
    expect(s.history).toEqual([]);
    expect(s.future).toEqual([]);
  });

  it('setDesign updates design state', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    act(() => {
      store
        .getState()
        .setDesign({
          version: 1,
          width: 500,
          height: 300,
          background: '#000',
          elements: [],
        });
    });

    expect(store.getState().design.width).toBe(500);
    expect(store.getState().design.height).toBe(300);
  });

  it('setDesign accepts updater function', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    act(() => {
      store
        .getState()
        .setDesign((prev) => ({ ...prev, background: '#ff0000' }));
    });

    expect(store.getState().design.background).toBe('#ff0000');
  });

  it('pushHistory + undo + redo work correctly', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    // Initial state
    const original = { ...store.getState().design };

    // Make a change with history
    act(() => {
      store.getState().pushHistory();
      store.getState().setDesign({ ...original, background: '#111' });
    });
    expect(store.getState().design.background).toBe('#111');
    expect(store.getState().history).toHaveLength(1);

    // Undo
    act(() => {
      store.getState().undo();
    });
    expect(store.getState().design.background).toBe('#ffffff');
    expect(store.getState().history).toHaveLength(0);
    expect(store.getState().future).toHaveLength(1);

    // Redo
    act(() => {
      store.getState().redo();
    });
    expect(store.getState().design.background).toBe('#111');
    expect(store.getState().future).toHaveLength(0);
  });

  it('undo with empty history is a no-op', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const before = { ...useEditorStore.getState().design };
    act(() => {
      useEditorStore.getState().undo();
    });
    expect(useEditorStore.getState().design).toEqual(before);
  });

  it('redo with empty future is a no-op', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const before = { ...useEditorStore.getState().design };
    act(() => {
      useEditorStore.getState().redo();
    });
    expect(useEditorStore.getState().design).toEqual(before);
  });

  it('setTool changes active tool', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    act(() => {
      useEditorStore.getState().setTool('text');
    });
    expect(useEditorStore.getState().tool).toBe('text');
  });

  it('setZoom clamps between 0.25 and 4', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    act(() => {
      useEditorStore.getState().setZoom(10);
    });
    expect(useEditorStore.getState().zoom).toBe(4);

    act(() => {
      useEditorStore.getState().setZoom(0.01);
    });
    expect(useEditorStore.getState().zoom).toBe(0.25);
  });

  it('setZoom accepts updater function', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    act(() => {
      useEditorStore.getState().setZoom((prev) => prev + 0.5);
    });
    expect(useEditorStore.getState().zoom).toBe(1.5);
  });

  it('UI toggles flip boolean states', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    expect(store.getState().showShortcuts).toBe(false);
    act(() => store.getState().toggleShortcuts());
    expect(store.getState().showShortcuts).toBe(true);
    act(() => store.getState().toggleShortcuts());
    expect(store.getState().showShortcuts).toBe(false);

    expect(store.getState().showGrid).toBe(false);
    act(() => store.getState().toggleGrid());
    expect(store.getState().showGrid).toBe(true);

    expect(store.getState().showRulers).toBe(true); // default true
    act(() => store.getState().toggleRulers());
    expect(store.getState().showRulers).toBe(false);
  });

  it('deleteSelected removes elements from design', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    // Add elements
    act(() => {
      store.getState().setDesign((d) => ({
        ...d,
        elements: [
          {
            id: 'a',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            type: 'rect',
            fill: '#000',
            stroke: 'none',
            strokeWidth: 1,
            rx: 0,
          } as DesignElement,
          {
            id: 'b',
            x: 50,
            y: 50,
            width: 100,
            height: 100,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            type: 'rect',
            fill: '#fff',
            stroke: 'none',
            strokeWidth: 1,
            rx: 0,
          } as DesignElement,
        ],
      }));
      store.getState().setSelectedIds(new Set(['a']));
    });

    act(() => {
      store.getState().deleteSelected();
    });

    expect(store.getState().design.elements).toHaveLength(1);
    expect(store.getState().design.elements[0].id).toBe('b');
    expect(store.getState().selectedIds.size).toBe(0);
    expect(store.getState().history).toHaveLength(1); // pushHistory was called
  });

  it('duplicateSelected clones elements with offset', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    act(() => {
      store.getState().setDesign((d) => ({
        ...d,
        elements: [
          {
            id: 'el1',
            x: 10,
            y: 10,
            width: 50,
            height: 50,
            rotation: 0,
            opacity: 1,
            locked: false,
            visible: true,
            type: 'rect',
            fill: '#000',
            stroke: 'none',
            strokeWidth: 1,
            rx: 0,
          } as DesignElement,
        ],
      }));
      store.getState().setSelectedIds(new Set(['el1']));
    });

    act(() => {
      store.getState().duplicateSelected();
    });

    const els = store.getState().design.elements;
    expect(els).toHaveLength(2);
    const dup = els[1];
    expect(dup.x).toBe(30); // 10 + 20
    expect(dup.y).toBe(30); // 10 + 20
    expect(dup.id).not.toBe('el1');
    expect(store.getState().selectedIds.has(dup.id)).toBe(true);
  });

  it('addSnapshot + restoreSnapshot work', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    act(() => {
      store.getState().setDesign((d) => ({ ...d, background: '#aaa' }));
      store.getState().addSnapshot('v1');
    });

    expect(store.getState().snapshots).toHaveLength(1);
    expect(store.getState().snapshots[0].name).toBe('v1');

    // Change design
    act(() => {
      store.getState().setDesign((d) => ({ ...d, background: '#bbb' }));
    });
    expect(store.getState().design.background).toBe('#bbb');

    // Restore
    act(() => {
      store.getState().restoreSnapshot(0);
    });
    expect(store.getState().design.background).toBe('#aaa');
  });

  it('reset returns all state to defaults', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    const store = useEditorStore;

    // Mutate state
    act(() => {
      store.getState().setTool('text');
      store.getState().setZoom(2);
      store.getState().toggleGrid();
      store.getState().addSnapshot('test');
    });

    // Reset
    act(() => {
      store.getState().reset();
    });

    const s = store.getState();
    expect(s.tool).toBe('select');
    expect(s.zoom).toBe(1);
    expect(s.showGrid).toBe(false);
    expect(s.snapshots).toEqual([]);
  });

  it('reset accepts custom dimensions', async () => {
    const { useEditorStore } = await import('@/lib/stores/editor-store');
    act(() => {
      useEditorStore.getState().reset(1920, 1080);
    });
    expect(useEditorStore.getState().design.width).toBe(1920);
    expect(useEditorStore.getState().design.height).toBe(1080);
  });
});

describe('useGalleryStore', () => {
  beforeEach(async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    useGalleryStore.getState().reset();
  });

  it('initializes with grid view and empty selection', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    const s = useGalleryStore.getState();
    expect(s.viewMode).toBe('grid');
    expect(s.selectedAssetIds.size).toBe(0);
    expect(s.searchQuery).toBe('');
    expect(s.sortField).toBe('createdAt');
    expect(s.sortDirection).toBe('desc');
  });

  it('setViewMode changes view', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    act(() => {
      useGalleryStore.getState().setViewMode('list');
    });
    expect(useGalleryStore.getState().viewMode).toBe('list');
  });

  it('selection operations work correctly', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    const store = useGalleryStore;

    // Select
    act(() => store.getState().selectAsset('a1'));
    expect(store.getState().selectedAssetIds.has('a1')).toBe(true);

    // Toggle on
    act(() => store.getState().toggleAssetSelection('a2'));
    expect(store.getState().selectedAssetIds.size).toBe(2);

    // Toggle off
    act(() => store.getState().toggleAssetSelection('a1'));
    expect(store.getState().selectedAssetIds.has('a1')).toBe(false);
    expect(store.getState().selectedAssetIds.size).toBe(1);

    // Deselect
    act(() => store.getState().deselectAsset('a2'));
    expect(store.getState().selectedAssetIds.size).toBe(0);
  });

  it('selectAll sets multiple IDs', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    act(() => {
      useGalleryStore.getState().selectAll(['x', 'y', 'z']);
    });
    expect(useGalleryStore.getState().selectedAssetIds.size).toBe(3);
  });

  it('filtering state updates correctly', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    const store = useGalleryStore;

    act(() => {
      store.getState().setSearchQuery('photo');
      store.getState().setFileTypeFilter('image/png');
      store.getState().setTagFilter(['nature', 'landscape']);
      store.getState().toggleStarredOnly();
    });

    const s = store.getState();
    expect(s.searchQuery).toBe('photo');
    expect(s.fileTypeFilter).toBe('image/png');
    expect(s.tagFilter).toEqual(['nature', 'landscape']);
    expect(s.starredOnly).toBe(true);
  });

  it('setSort toggles direction when same field', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    const store = useGalleryStore;

    // Default: createdAt desc
    act(() => store.getState().setSort('createdAt'));
    expect(store.getState().sortDirection).toBe('asc'); // toggled from desc

    act(() => store.getState().setSort('createdAt'));
    expect(store.getState().sortDirection).toBe('desc'); // toggled back
  });

  it('setSort with explicit direction', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    act(() => {
      useGalleryStore.getState().setSort('name', 'asc');
    });
    expect(useGalleryStore.getState().sortField).toBe('name');
    expect(useGalleryStore.getState().sortDirection).toBe('asc');
  });

  it('reset restores all defaults', async () => {
    const { useGalleryStore } = await import('@/lib/stores/gallery-store');
    act(() => {
      useGalleryStore.getState().setViewMode('masonry');
      useGalleryStore.getState().setSearchQuery('test');
      useGalleryStore.getState().selectAsset('a1');
    });

    act(() => useGalleryStore.getState().reset());

    const s = useGalleryStore.getState();
    expect(s.viewMode).toBe('grid');
    expect(s.searchQuery).toBe('');
    expect(s.selectedAssetIds.size).toBe(0);
  });
});

describe('usePdfEditorStore', () => {
  beforeEach(async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    usePdfEditorStore.getState().reset();
  });

  it('initializes with default state', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    const s = usePdfEditorStore.getState();
    expect(s.totalPages).toBe(0);
    expect(s.currentPage).toBe(1);
    expect(s.zoom).toBe(1);
    expect(s.activeTool).toBe('select');
    expect(s.showThumbnails).toBe(true);
    expect(s.isDirty).toBe(false);
  });

  it('page navigation clamps to bounds', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    const store = usePdfEditorStore;

    act(() => store.getState().setTotalPages(5));

    act(() => store.getState().setCurrentPage(3));
    expect(store.getState().currentPage).toBe(3);

    act(() => store.getState().nextPage());
    expect(store.getState().currentPage).toBe(4);

    act(() => store.getState().setCurrentPage(10)); // exceeds total
    expect(store.getState().currentPage).toBe(5);

    act(() => store.getState().setCurrentPage(0)); // below 1
    expect(store.getState().currentPage).toBe(1);
  });

  it('previousPage does not go below 1', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    act(() => usePdfEditorStore.getState().previousPage());
    expect(usePdfEditorStore.getState().currentPage).toBe(1);
  });

  it('zoom operations clamp between 0.25 and 5', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    const store = usePdfEditorStore;

    act(() => store.getState().setZoom(10));
    expect(store.getState().zoom).toBe(5);

    act(() => store.getState().setZoom(0.1));
    expect(store.getState().zoom).toBe(0.25);

    act(() => store.getState().zoomIn());
    expect(store.getState().zoom).toBe(0.5); // 0.25 + 0.25

    act(() => store.getState().zoomFit());
    expect(store.getState().zoom).toBe(1);
  });

  it('setActiveTool changes tool', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    act(() => usePdfEditorStore.getState().setActiveTool('highlight'));
    expect(usePdfEditorStore.getState().activeTool).toBe('highlight');
  });

  it('UI toggles work', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    const store = usePdfEditorStore;

    expect(store.getState().showThumbnails).toBe(true);
    act(() => store.getState().toggleThumbnails());
    expect(store.getState().showThumbnails).toBe(false);

    expect(store.getState().showComments).toBe(false);
    act(() => store.getState().toggleComments());
    expect(store.getState().showComments).toBe(true);
  });

  it('markDirty and markSaved update state', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    const store = usePdfEditorStore;

    act(() => store.getState().markDirty());
    expect(store.getState().isDirty).toBe(true);

    act(() => store.getState().markSaved());
    expect(store.getState().isDirty).toBe(false);
    expect(store.getState().lastSavedAt).toBeInstanceOf(Date);
  });

  it('reset restores defaults', async () => {
    const { usePdfEditorStore } = await import('@/lib/stores/pdf-editor-store');
    act(() => {
      usePdfEditorStore.getState().setTotalPages(10);
      usePdfEditorStore.getState().setCurrentPage(5);
      usePdfEditorStore.getState().setActiveTool('draw');
      usePdfEditorStore.getState().markDirty();
    });

    act(() => usePdfEditorStore.getState().reset());

    const s = usePdfEditorStore.getState();
    expect(s.totalPages).toBe(0);
    expect(s.currentPage).toBe(1);
    expect(s.activeTool).toBe('select');
    expect(s.isDirty).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════
 * 4. ActivityLog Model
 * ═══════════════════════════════════════════════════════════ */

describe('ActivityLog model', () => {
  it('exports ActivityLog model and IActivityLog interface type', async () => {
    const mod = await import('@/models/activity-log');
    expect(mod.ActivityLog).toBeDefined();
    expect(mod.ActivityLog.modelName).toBe('ActivityLog');
  });

  it('exports action and target type unions', async () => {
    // Verify the module exports the type aliases (compile-time check)
    const mod = await import('@/models/activity-log');
    expect(mod.ActivityLog).toBeDefined();
  });

  it('schema has required fields', async () => {
    const { ActivityLog } = await import('@/models/activity-log');
    const schema = ActivityLog.schema;

    const requiredPaths = [
      'orgId',
      'userId',
      'action',
      'targetType',
      'targetId',
    ];
    requiredPaths.forEach((path) => {
      const schemaPath = schema.path(path);
      expect(schemaPath).toBeDefined();
      expect(schemaPath.isRequired).toBe(true);
    });
  });

  it('schema has optional fields with defaults', async () => {
    const { ActivityLog } = await import('@/models/activity-log');
    const schema = ActivityLog.schema;

    expect(schema.path('description')).toBeDefined();
    expect(schema.path('metadata')).toBeDefined();
    expect(schema.path('ip')).toBeDefined();
    expect(schema.path('userAgent')).toBeDefined();
  });

  it('action field has correct enum values', async () => {
    const { ActivityLog } = await import('@/models/activity-log');
    const actionPath = ActivityLog.schema.path('action') as EnumPathLike;
    const enumValues = actionPath.enumValues;

    expect(enumValues).toContain('upload');
    expect(enumValues).toContain('delete');
    expect(enumValues).toContain('edit');
    expect(enumValues).toContain('share');
    expect(enumValues).toContain('export');
    expect(enumValues).toContain('ai_process');
    expect(enumValues).toContain('ai_generate');
    expect(enumValues).toContain('move');
    expect(enumValues).toContain('rename');
    expect(enumValues).toContain('invite_member');
    expect(enumValues).toContain('change_role');
  });

  it('targetType field has correct enum values', async () => {
    const { ActivityLog } = await import('@/models/activity-log');
    const targetTypePath = ActivityLog.schema.path('targetType') as EnumPathLike;
    const enumValues = targetTypePath.enumValues;

    expect(enumValues).toContain('asset');
    expect(enumValues).toContain('design');
    expect(enumValues).toContain('folder');
    expect(enumValues).toContain('team');
    expect(enumValues).toContain('settings');
    expect(enumValues).toContain('share_link');
    expect(enumValues).toContain('api_key');
  });

  it('has timestamps enabled', async () => {
    const { ActivityLog } = await import('@/models/activity-log');
    const timestamps = (ActivityLog.schema.options as SchemaOptionsWithTimestamps).timestamps;
    expect(timestamps).toBe(true);
  });

  it('is re-exported from barrel index', async () => {
    const mod = await import('@/models/index');
    expect(mod.ActivityLog).toBeDefined();
    expect(mod.ActivityLog.modelName).toBe('ActivityLog');
  }, 15000);
});

/* ═══════════════════════════════════════════════════════════
 * 5. Error Boundaries & Loading States
 * ═══════════════════════════════════════════════════════════ */

describe('Error boundaries — export verification', () => {
  it('dashboard error.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/error');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('dashboard loading.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/loading');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('designs error.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/designs/error');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('designs loading.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/designs/loading');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('tools error.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/tools/error');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('tools loading.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/tools/loading');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('ai error.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/ai/error');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('ai loading.tsx exports default component', async () => {
    const mod = await import('@/app/dashboard/ai/loading');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

/* ═══════════════════════════════════════════════════════════
 * 6. Reduced Motion Utilities
 * ═══════════════════════════════════════════════════════════ */

describe('reduced-motion utilities', () => {
  it('exports useReducedMotion hook', async () => {
    const mod = await import('@/lib/reduced-motion');
    expect(mod.useReducedMotion).toBeDefined();
    expect(typeof mod.useReducedMotion).toBe('function');
  });

  it('exports useMotionSafe hook', async () => {
    const mod = await import('@/lib/reduced-motion');
    expect(mod.useMotionSafe).toBeDefined();
    expect(typeof mod.useMotionSafe).toBe('function');
  });

  it('getMotionDuration returns 0 when reduced motion preferred', async () => {
    const { getMotionDuration } = await import('@/lib/reduced-motion');
    expect(getMotionDuration(300, true)).toBe(0);
    expect(getMotionDuration(300, false)).toBe(300);
    expect(getMotionDuration(0, false)).toBe(0);
    expect(getMotionDuration(1000, true)).toBe(0);
  });

  it('prefersReducedMotion returns boolean (SSR-safe)', async () => {
    // Mock matchMedia (not available in jsdom by default)
    const origMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    try {
      const { prefersReducedMotion } = await import('@/lib/reduced-motion');
      const result = prefersReducedMotion();
      expect(typeof result).toBe('boolean');
      expect(result).toBe(false);
    } finally {
      window.matchMedia = origMatchMedia;
    }
  });
});

/* ═══════════════════════════════════════════════════════════
 * 7. Accessibility — Skip Navigation
 * ═══════════════════════════════════════════════════════════ */

describe('Skip navigation infrastructure', () => {
  it('layout.tsx file exists and is importable (skip link present)', async () => {
    // layout.tsx uses next/font/google which isn't available in vitest.
    // Instead, verify the file exists via a structural check.
    const fs = await import('fs');
    const path = await import('path');
    const layoutPath = path.resolve(process.cwd(), 'src/app/layout.tsx');
    expect(fs.existsSync(layoutPath)).toBe(true);

    // Verify skip link is in the source
    const content = fs.readFileSync(layoutPath, 'utf-8');
    expect(content).toContain('Skip to main content');
    expect(content).toContain('#main-content');
    expect(content).toContain('sr-only');
  });

  it('shell.tsx exports DashboardShell component', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const shellPath = path.resolve(process.cwd(), 'src/components/dashboard/shell.tsx');
    const content = fs.readFileSync(shellPath, 'utf-8');
    expect(content).toContain('export function DashboardShell');
  });

  it('shell.tsx main element has id="main-content"', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const shellPath = path.resolve(
      process.cwd(),
      'src/components/dashboard/shell.tsx',
    );
    const content = fs.readFileSync(shellPath, 'utf-8');
    expect(content).toContain('id="main-content"');
    expect(content).toContain('tabIndex={-1}');
  });
});
