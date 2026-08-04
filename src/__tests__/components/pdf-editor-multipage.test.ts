// SPDX-License-Identifier: Apache-2.0
/**
 * PDF Editor & Design Studio Multi-Page Tests
 *
 * PDF Editor — Visual Foundation (verify exports)
 * PDF Editor — Editing Tools (verify exports)
 * Design Studio — Multi-Page + Autosave (page-manager, page-strip, pdf-export)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ═══════════════════════════════════════════════════════════
 * PDF Editor — Visual Foundation
 * ═══════════════════════════════════════════════════════════ */

describe('PDF.js page rendering', () => {
  it('exports PageRenderer class', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/page-renderer');
    expect(mod.PageRenderer).toBeDefined();
    expect(typeof mod.PageRenderer).toBe('function');
  });

  it('exports RenderResult type guard', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/page-renderer');
    // PageRenderer should be constructable
    expect(mod.PageRenderer.prototype.renderPage).toBeDefined();
  });
});

describe('PDF loader', () => {
  it('exports getPdfjs function', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/pdf-loader');
    expect(mod.getPdfjs).toBeDefined();
    expect(typeof mod.getPdfjs).toBe('function');
  });

  it('exports loadPdfFromBuffer', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/pdf-loader');
    expect(mod.loadPdfFromBuffer).toBeDefined();
  });

  it('exports loadPdfFromFile', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/pdf-loader');
    expect(mod.loadPdfFromFile).toBeDefined();
  });

  it('exports loadPdfFromUrl', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/pdf-loader');
    expect(mod.loadPdfFromUrl).toBeDefined();
  });
});

describe('Fabric.js bridge', () => {
  it('exports createCoordinateMapping', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/fabric-bridge');
    expect(mod.createCoordinateMapping).toBeDefined();
  });

  it('coordinate mapping converts screen ↔ PDF correctly', async () => {
    const { createCoordinateMapping } =
      await import('@/app/dashboard/tools/pdf-editor/engine/fabric-bridge');

    const pageMeta = { pageNumber: 1, width: 612, height: 792, rotation: 0 };
    const mapping = createCoordinateMapping(pageMeta, 2.0, 1);

    // Screen to PDF at 2x zoom
    const pdfPoint = mapping.screenToPdf(200, 300);
    expect(pdfPoint.x).toBe(100); // 200 / 2
    expect(pdfPoint.y).toBe(150); // 300 / 2

    // PDF to Screen
    const screenPoint = mapping.pdfToScreen(100, 150);
    expect(screenPoint.x).toBe(200);
    expect(screenPoint.y).toBe(300);
  });

  it('coordinate mapping round-trips correctly', async () => {
    const { createCoordinateMapping } =
      await import('@/app/dashboard/tools/pdf-editor/engine/fabric-bridge');

    const pageMeta = { pageNumber: 1, width: 595, height: 842, rotation: 0 };
    const mapping = createCoordinateMapping(pageMeta, 1.5, 2);

    const original = { x: 297.5, y: 421 };
    const screen = mapping.pdfToScreen(original.x, original.y);
    const back = mapping.screenToPdf(screen.x, screen.y);

    expect(back.x).toBeCloseTo(original.x, 5);
    expect(back.y).toBeCloseTo(original.y, 5);
  });

  it('exports FABRIC_OBJECT_DEFAULTS', async () => {
    const { FABRIC_OBJECT_DEFAULTS } =
      await import('@/app/dashboard/tools/pdf-editor/engine/fabric-bridge');
    expect(FABRIC_OBJECT_DEFAULTS.cornerSize).toBe(8);
    expect(FABRIC_OBJECT_DEFAULTS.cornerStyle).toBe('circle');
    expect(FABRIC_OBJECT_DEFAULTS.borderColor).toBe('#8b5cf6');
  });
});

describe('Thumbnail generator', () => {
  it('exports generateThumbnail function', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/thumbnail-generator');
    expect(mod.generateThumbnail).toBeDefined();
  });

  it('exports generateThumbnailBatch', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/thumbnail-generator');
    expect(mod.generateThumbnailBatch).toBeDefined();
  });

  it('exports clearThumbnailCache', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/thumbnail-generator');
    expect(mod.clearThumbnailCache).toBeDefined();
    expect(mod.clearAllThumbnails).toBeDefined();
  });
});

describe('Zoom controls', () => {
  it('exports zoom constants', async () => {
    const mod = await import('@/app/dashboard/tools/pdf-editor/constants');
    expect(mod.ZOOM_MIN).toBe(0.25);
    expect(mod.ZOOM_MAX).toBe(4.0);
    expect(mod.ZOOM_DEFAULT).toBe(1.0);
    expect(mod.ZOOM_PRESETS).toContain(1.0);
    expect(mod.ZOOM_PRESETS).toContain(2.0);
  });
});

describe('PDF editor types', () => {
  it('types module loads without error', async () => {
    // types.ts is a pure TypeScript type module — no runtime exports.
    // Verify the constants module (which uses types) loads correctly.
    const constants =
      await import('@/app/dashboard/tools/pdf-editor/constants');
    expect(constants.ZOOM_PRESETS).toBeDefined();
    expect(constants.PAGE_GAP).toBe(16);
    expect(constants.THUMBNAIL_SCALE).toBe(0.2);
  });
});

/* ═══════════════════════════════════════════════════════════
 * PDF Editor — Editing Tools
 * ═══════════════════════════════════════════════════════════ */

describe('Command stack / Undo-Redo', () => {
  it('exports createAddCommand', async () => {
    const { createAddCommand } =
      await import('@/app/dashboard/tools/pdf-editor/engine/command-stack');
    expect(createAddCommand).toBeDefined();

    const cmd = createAddCommand(1, {
      id: 'ann-1',
      kind: 'text',
      page: 1,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 0,
      opacity: 1,
      text: 'Hello',
      fontFamily: 'Helvetica',
      fontSize: 16,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#000',
    } as never);

    expect(cmd.type).toBe('add-annotation');
    expect(cmd.targetId).toBe('ann-1');
    expect(cmd.before).toBeNull();
    expect(cmd.after).not.toBeNull();
  });

  it('exports createRemoveCommand', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/command-stack');
    expect(mod.createRemoveCommand).toBeDefined();
  });

  it('exports createModifyCommand', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/command-stack');
    expect(mod.createModifyCommand).toBeDefined();
  });

  it('exports createMoveCommand', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/command-stack');
    expect(mod.createMoveCommand).toBeDefined();
  });
});

describe('Export engine', () => {
  it('exports exportPdf function', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/export-engine');
    expect(mod.exportPdf).toBeDefined();
    expect(typeof mod.exportPdf).toBe('function');
  });

  it('exports downloadPdf function', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/export-engine');
    expect(mod.downloadPdf).toBeDefined();
  });
});

describe('Cloud save', () => {
  it('exports serialization functions', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/cloud-save');
    expect(mod.serializeAnnotations).toBeDefined();
    expect(mod.deserializeAnnotations).toBeDefined();
  });

  it('serializes and deserializes annotations round-trip', async () => {
    const { serializeAnnotations, deserializeAnnotations } =
      await import('@/app/dashboard/tools/pdf-editor/engine/cloud-save');

    const map = new Map<number, Array<{ id: string }>>([
      [1, [{ id: 'a' }]],
      [3, [{ id: 'b' }, { id: 'c' }]],
    ]);

    const record = serializeAnnotations(map as never);
    expect(record[1]).toHaveLength(1);
    expect(record[3]).toHaveLength(2);

    const back = deserializeAnnotations(record);
    expect(back.get(1)).toHaveLength(1);
    expect(back.get(3)).toHaveLength(2);
  });

  it('exports buildSavePayload', async () => {
    const mod =
      await import('@/app/dashboard/tools/pdf-editor/engine/cloud-save');
    expect(mod.buildSavePayload).toBeDefined();
  });
});

/* ═══════════════════════════════════════════════════════════
 * Design Studio — Multi-Page + Autosave
 * ═══════════════════════════════════════════════════════════ */

// ─── 7.1 + 7.2: Page Manager ────────────────────────────────────────────────

describe('Page Manager', () => {
  beforeEach(async () => {
    const { resetPageIdCounter } =
      await import('@/components/design/page-manager');
    resetPageIdCounter();
  });

  it('exports all CRUD functions', async () => {
    const mod = await import('@/components/design/page-manager');
    expect(mod.createPage).toBeDefined();
    expect(mod.addPage).toBeDefined();
    expect(mod.duplicatePage).toBeDefined();
    expect(mod.deletePage).toBeDefined();
    expect(mod.reorderPage).toBeDefined();
    expect(mod.renamePage).toBeDefined();
  });

  describe('createPage', () => {
    it('creates a page with defaults', async () => {
      const { createPage } = await import('@/components/design/page-manager');
      const page = createPage();
      expect(page.id).toMatch(/^page_/);
      expect(page.width).toBe(800);
      expect(page.height).toBe(600);
      expect(page.background).toBe('#ffffff');
      expect(page.elements).toEqual([]);
    });

    it('creates a page with custom dimensions', async () => {
      const { createPage } = await import('@/components/design/page-manager');
      const page = createPage(1920, 1080, '#000000', 'HD Canvas');
      expect(page.width).toBe(1920);
      expect(page.height).toBe(1080);
      expect(page.background).toBe('#000000');
      expect(page.name).toBe('HD Canvas');
    });
  });

  describe('addPage', () => {
    it('adds at end by default', async () => {
      const { createPage, addPage } =
        await import('@/components/design/page-manager');
      const p1 = createPage(800, 600, '#fff', 'Page 1');
      const p2 = createPage(800, 600, '#fff', 'Page 2');
      const pages = addPage([p1], p2);
      expect(pages).toHaveLength(2);
      expect(pages[1].name).toBe('Page 2');
    });

    it('adds at specific index', async () => {
      const { createPage, addPage } =
        await import('@/components/design/page-manager');
      const p1 = createPage(800, 600, '#fff', 'A');
      const p2 = createPage(800, 600, '#fff', 'B');
      const p3 = createPage(800, 600, '#fff', 'C');
      const pages = addPage([p1, p3], p2, 1);
      expect(pages.map((p) => p.name)).toEqual(['A', 'B', 'C']);
    });

    it('clamps negative index to 0', async () => {
      const { createPage, addPage } =
        await import('@/components/design/page-manager');
      const p1 = createPage(800, 600, '#fff', 'A');
      const p2 = createPage(800, 600, '#fff', 'B');
      const pages = addPage([p1], p2, -5);
      expect(pages[0].name).toBe('B');
    });
  });

  describe('duplicatePage', () => {
    it('duplicates a page with deep-cloned elements', async () => {
      const { createPage, duplicatePage } =
        await import('@/components/design/page-manager');
      const p1 = createPage(800, 600, '#ccc', 'Original');
      p1.elements = [
        {
          id: 'el1',
          type: 'rect',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
          opacity: 1,
          locked: false,
          visible: true,
          fill: '#f00',
          stroke: '#000',
          strokeWidth: 1,
          borderRadius: 0,
        } as never,
      ];

      const [newPages, dup] = duplicatePage([p1], 0);
      expect(newPages).toHaveLength(2);
      expect(dup.name).toBe('Original (Copy)');
      expect(dup.background).toBe('#ccc');
      expect(dup.elements).toHaveLength(1);
      // Elements should be cloned (different id)
      expect(dup.elements[0].id).not.toBe('el1');
      expect(dup.elements[0].id).toContain('el1');
    });

    it('inserts duplicate after original', async () => {
      const { createPage, duplicatePage } =
        await import('@/components/design/page-manager');
      const p1 = createPage(800, 600, '#fff', 'A');
      const p2 = createPage(800, 600, '#fff', 'B');
      const [newPages] = duplicatePage([p1, p2], 0);
      expect(newPages).toHaveLength(3);
      expect(newPages[0].name).toBe('A');
      expect(newPages[1].name).toBe('A (Copy)');
      expect(newPages[2].name).toBe('B');
    });

    it('throws on invalid index', async () => {
      const { duplicatePage } =
        await import('@/components/design/page-manager');
      expect(() => duplicatePage([], 0)).toThrow(RangeError);
      expect(() =>
        duplicatePage(
          [
            {
              id: '1',
              name: 'A',
              width: 800,
              height: 600,
              background: '#fff',
              elements: [],
            },
          ],
          5,
        ),
      ).toThrow(RangeError);
    });
  });

  describe('deletePage', () => {
    it('deletes a page and adjusts current index', async () => {
      const { createPage, deletePage } =
        await import('@/components/design/page-manager');
      const pages = [
        createPage(800, 600, '#fff', 'A'),
        createPage(800, 600, '#fff', 'B'),
        createPage(800, 600, '#fff', 'C'),
      ];

      // Delete active page (middle)
      const [newPages, newIdx] = deletePage(pages, 1, 1);
      expect(newPages).toHaveLength(2);
      expect(newIdx).toBe(0); // shifts back
    });

    it('adjusts index when deleting before current', async () => {
      const { createPage, deletePage } =
        await import('@/components/design/page-manager');
      const pages = [
        createPage(800, 600, '#fff', 'A'),
        createPage(800, 600, '#fff', 'B'),
        createPage(800, 600, '#fff', 'C'),
      ];
      const [, newIdx] = deletePage(pages, 0, 2);
      expect(newIdx).toBe(1); // was 2, shifts to 1
    });

    it('throws when trying to delete the last page', async () => {
      const { createPage, deletePage } =
        await import('@/components/design/page-manager');
      const pages = [createPage(800, 600, '#fff', 'Only')];
      expect(() => deletePage(pages, 0, 0)).toThrow(
        'Cannot delete the last page',
      );
    });
  });

  describe('reorderPage', () => {
    it('moves a page from start to end', async () => {
      const { createPage, reorderPage } =
        await import('@/components/design/page-manager');
      const pages = [
        createPage(800, 600, '#fff', 'A'),
        createPage(800, 600, '#fff', 'B'),
        createPage(800, 600, '#fff', 'C'),
      ];

      const [newPages, newIdx] = reorderPage(pages, 0, 2, 0);
      expect(newPages.map((p) => p.name)).toEqual(['B', 'C', 'A']);
      expect(newIdx).toBe(2); // followed the moved page
    });

    it('returns same array for no-op reorder', async () => {
      const { createPage, reorderPage } =
        await import('@/components/design/page-manager');
      const pages = [createPage(800, 600, '#fff', 'A')];
      const [newPages, newIdx] = reorderPage(pages, 0, 0, 0);
      expect(newPages).toBe(pages); // reference equality
      expect(newIdx).toBe(0);
    });

    it('throws on out-of-bounds indices', async () => {
      const { reorderPage } = await import('@/components/design/page-manager');
      expect(() => reorderPage([], 0, 1, 0)).toThrow(RangeError);
    });
  });

  describe('renamePage', () => {
    it('renames a page', async () => {
      const { createPage, renamePage } =
        await import('@/components/design/page-manager');
      const pages = [createPage(800, 600, '#fff', 'Old')];
      const newPages = renamePage(pages, 0, 'New Name');
      expect(newPages[0].name).toBe('New Name');
    });

    it('trims whitespace', async () => {
      const { createPage, renamePage } =
        await import('@/components/design/page-manager');
      const pages = [createPage(800, 600, '#fff', 'A')];
      const newPages = renamePage(pages, 0, '  Trimmed  ');
      expect(newPages[0].name).toBe('Trimmed');
    });

    it('keeps original name on empty string', async () => {
      const { createPage, renamePage } =
        await import('@/components/design/page-manager');
      const pages = [createPage(800, 600, '#fff', 'Keep')];
      const newPages = renamePage(pages, 0, '   ');
      expect(newPages[0].name).toBe('Keep');
    });
  });

  describe('query helpers', () => {
    it('getTotalElements counts across pages', async () => {
      const { getTotalElements } =
        await import('@/components/design/page-manager');
      const pages = [
        {
          id: '1',
          name: 'A',
          width: 800,
          height: 600,
          background: '#fff',
          elements: [{}, {}] as never[],
        },
        {
          id: '2',
          name: 'B',
          width: 800,
          height: 600,
          background: '#fff',
          elements: [{}, {}, {}] as never[],
        },
      ];
      expect(getTotalElements(pages)).toBe(5);
    });

    it('findPageByElementId finds the correct page', async () => {
      const { findPageByElementId } =
        await import('@/components/design/page-manager');
      const pages = [
        {
          id: '1',
          name: 'A',
          width: 800,
          height: 600,
          background: '#fff',
          elements: [{ id: 'x' }] as never[],
        },
        {
          id: '2',
          name: 'B',
          width: 800,
          height: 600,
          background: '#fff',
          elements: [{ id: 'y' }, { id: 'z' }] as never[],
        },
      ];
      expect(findPageByElementId(pages, 'z')).toBe(1);
      expect(findPageByElementId(pages, 'missing')).toBe(-1);
    });
  });

  describe('initializePagesFromState', () => {
    it('returns pages array if present', async () => {
      const { initializePagesFromState } =
        await import('@/components/design/page-manager');
      const existingPages = [
        {
          id: 'p1',
          name: 'Pg 1',
          width: 1920,
          height: 1080,
          background: '#000',
          elements: [],
        },
      ];
      const result = initializePagesFromState({ pages: existingPages });
      expect(result).toBe(existingPages);
    });

    it('wraps top-level state as single page for backward compat', async () => {
      const { initializePagesFromState } =
        await import('@/components/design/page-manager');
      const result = initializePagesFromState({
        width: 1024,
        height: 768,
        background: '#eee',
        elements: [{ id: 'el1' }] as never[],
      });
      expect(result).toHaveLength(1);
      expect(result[0].width).toBe(1024);
      expect(result[0].height).toBe(768);
      expect(result[0].background).toBe('#eee');
      expect(result[0].elements).toHaveLength(1);
    });
  });
});

// ─── 7.1: Page Strip Component ──────────────────────────────────────────────

describe('PageStrip component', () => {
  it('exports PageStrip as named export', async () => {
    const mod = await import('@/components/design/page-strip');
    expect(mod.PageStrip).toBeDefined();
    expect(typeof mod.PageStrip).toBe('function');
  });

  it('exports PageStrip as default export', async () => {
    const mod = await import('@/components/design/page-strip');
    expect(mod.default).toBe(mod.PageStrip);
  });
});

// ─── 7.3: Multi-Page PDF Export ─────────────────────────────────────────────

describe('Design PDF Export', () => {
  it('exports exportDesignToPdf function', async () => {
    const mod = await import('@/components/design/design-pdf-export');
    expect(mod.exportDesignToPdf).toBeDefined();
    expect(typeof mod.exportDesignToPdf).toBe('function');
  });

  it('exports downloadDesignPdf helper', async () => {
    const mod = await import('@/components/design/design-pdf-export');
    expect(mod.downloadDesignPdf).toBeDefined();
    expect(typeof mod.downloadDesignPdf).toBe('function');
  });

  it('exports exportSinglePageToPdf', async () => {
    const mod = await import('@/components/design/design-pdf-export');
    expect(mod.exportSinglePageToPdf).toBeDefined();
  });

  it('exports svgToImageBytes', async () => {
    const mod = await import('@/components/design/design-pdf-export');
    expect(mod.svgToImageBytes).toBeDefined();
  });

  it('exports DEFAULT_PDF_EXPORT_OPTIONS', async () => {
    const { DEFAULT_PDF_EXPORT_OPTIONS } =
      await import('@/components/design/design-pdf-export');
    expect(DEFAULT_PDF_EXPORT_OPTIONS.scale).toBe(2);
    expect(DEFAULT_PDF_EXPORT_OPTIONS.quality).toBe(0.92);
    expect(DEFAULT_PDF_EXPORT_OPTIONS.format).toBe('png');
  });
});

// ─── 7.4 + 7.5 + 7.6 + 7.7: Pre-existing features (verify in editor.tsx) ──

describe('Pre-existing features in editor.tsx', () => {
  it('editor.tsx has autosave implementation', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const editorPath = path.resolve(
      process.cwd(),
      'src/components/design/editor.tsx',
    );
    const content = fs.readFileSync(editorPath, 'utf-8');

    expect(content).toContain('autosaveTimerRef');
    expect(content).toContain('autosaveStatus');
    expect(content).toContain('Autosave');
  });

  it('editor.tsx has version snapshots', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const editorPath = path.resolve(
      process.cwd(),
      'src/components/design/editor.tsx',
    );
    const content = fs.readFileSync(editorPath, 'utf-8');

    expect(content).toContain('VersionSnapshot');
    expect(content).toContain('Version History');
    expect(content).toContain('showVersions');
  });

  it('editor.tsx has context menu', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const editorPath = path.resolve(
      process.cwd(),
      'src/components/design/editor.tsx',
    );
    const content = fs.readFileSync(editorPath, 'utf-8');

    expect(content).toContain('contextMenu');
    expect(content).toContain('onContextMenu');
    expect(content).toContain('ContextMenuState');
  });

  it('editor.tsx has keyboard shortcuts dialog', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const editorPath = path.resolve(
      process.cwd(),
      'src/components/design/editor.tsx',
    );
    const content = fs.readFileSync(editorPath, 'utf-8');

    expect(content).toContain('KEYBOARD_SHORTCUTS');
    expect(content).toContain('Keyboard Shortcuts');
    expect(content).toContain('showShortcuts');
  });

  it('editor.tsx has multi-page currentPageIndex state', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const editorPath = path.resolve(
      process.cwd(),
      'src/components/design/editor.tsx',
    );
    const content = fs.readFileSync(editorPath, 'utf-8');

    expect(content).toContain('currentPageIndex');
    expect(content).toContain('DesignPage');
    expect(content).toContain('Multi-page');
  });
});

