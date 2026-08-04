// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for bookmark-engine.ts — Phase 4
 *
 * Covers createBookmark, parseOutlineFromPdfJs, findBookmark, findParent,
 * addBookmark, removeBookmark, updateBookmark, moveBookmark, toggleExpanded,
 * recalculateLevels, flattenBookmarks, countBookmarks, getMaxDepth,
 * validateBookmarkTree, sortBookmarksByPage
 */

import { describe, it, expect } from 'vitest';
import {
  createBookmark,
  parseOutlineFromPdfJs,
  findBookmark,
  findParent,
  addBookmark,
  removeBookmark,
  updateBookmark,
  moveBookmark,
  toggleExpanded,
  recalculateLevels,
  flattenBookmarks,
  countBookmarks,
  getMaxDepth,
  validateBookmarkTree,
  sortBookmarksByPage,
} from '@/app/dashboard/tools/pdf-editor/engine/bookmark-engine';
import type { PdfBookmark } from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helper ──────────────── */

function makeTree(): PdfBookmark[] {
  return [
    {
      id: 'bm-1',
      title: 'Chapter 1',
      page: 1,
      yOffset: 0,
      level: 0,
      children: [
        {
          id: 'bm-1-1',
          title: 'Section 1.1',
          page: 2,
          yOffset: 0,
          level: 1,
          children: [],
          expanded: true,
        },
        {
          id: 'bm-1-2',
          title: 'Section 1.2',
          page: 3,
          yOffset: 0,
          level: 1,
          children: [],
          expanded: true,
        },
      ],
      expanded: true,
    },
    {
      id: 'bm-2',
      title: 'Chapter 2',
      page: 5,
      yOffset: 0,
      level: 0,
      children: [],
      expanded: true,
    },
  ];
}

/* ──────────────── Creation ──────────────── */

describe('createBookmark', () => {
  it('creates a bookmark with correct fields', () => {
    const bm = createBookmark('Test', 3, 100, 0);
    expect(bm.title).toBe('Test');
    expect(bm.page).toBe(3);
    expect(bm.yOffset).toBe(100);
    expect(bm.level).toBe(0);
    expect(bm.children).toEqual([]);
    expect(bm.expanded).toBe(true);
    expect(bm.id).toMatch(/^bm-/);
  });

  it('generates unique IDs', () => {
    const a = createBookmark('A', 1);
    const b = createBookmark('B', 2);
    expect(a.id).not.toBe(b.id);
  });

  it('defaults yOffset to 0 and level to 0', () => {
    const bm = createBookmark('X', 1);
    expect(bm.yOffset).toBe(0);
    expect(bm.level).toBe(0);
  });
});

/* ──────────────── Parsing ──────────────── */

describe('parseOutlineFromPdfJs', () => {
  it('returns empty array for null/empty input', () => {
    expect(parseOutlineFromPdfJs([])).toEqual([]);
    expect(parseOutlineFromPdfJs(null as unknown as [])).toEqual([]);
  });

  it('parses flat outline', () => {
    const outline = [
      { title: 'Ch 1', dest: null, items: [] },
      { title: 'Ch 2', dest: null, items: [] },
    ];
    const result = parseOutlineFromPdfJs(outline);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Ch 1');
    expect(result[0].level).toBe(0);
  });

  it('parses nested outline', () => {
    const outline = [
      {
        title: 'Parent',
        dest: null,
        items: [{ title: 'Child', dest: null, items: [] }],
      },
    ];
    const result = parseOutlineFromPdfJs(outline);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].title).toBe('Child');
    expect(result[0].children[0].level).toBe(1);
  });

  it('defaults missing title to Untitled', () => {
    const outline = [{ title: '', dest: null, items: [] }];
    const result = parseOutlineFromPdfJs(outline);
    expect(result[0].title).toBe('Untitled');
  });
});

/* ──────────────── Find ──────────────── */

describe('findBookmark', () => {
  it('finds root-level bookmark', () => {
    const tree = makeTree();
    const found = findBookmark(tree, 'bm-2');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Chapter 2');
  });

  it('finds nested bookmark', () => {
    const tree = makeTree();
    const found = findBookmark(tree, 'bm-1-1');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('Section 1.1');
  });

  it('returns null for non-existent ID', () => {
    expect(findBookmark(makeTree(), 'not-exist')).toBeNull();
  });
});

describe('findParent', () => {
  it('returns null parent and index for root-level bookmark', () => {
    const tree = makeTree();
    const { parent, index } = findParent(tree, 'bm-1');
    expect(parent).toBeNull();
    expect(index).toBe(0);
  });

  it('returns parent array and index for nested bookmark', () => {
    const tree = makeTree();
    const { parent, index } = findParent(tree, 'bm-1-2');
    expect(parent).not.toBeNull();
    expect(index).toBe(1);
  });

  it('returns -1 index for non-existent ID', () => {
    const { index } = findParent(makeTree(), 'does-not-exist');
    expect(index).toBe(-1);
  });
});

/* ──────────────── CRUD ──────────────── */

describe('addBookmark', () => {
  it('adds to root level', () => {
    const tree = makeTree();
    const newBm = createBookmark('Chapter 3', 10);
    const result = addBookmark(tree, newBm);
    expect(result).toHaveLength(3);
    expect(result[2].title).toBe('Chapter 3');
  });

  it('adds as child of a parent', () => {
    const tree = makeTree();
    const newBm = createBookmark('Section 1.3', 4);
    const result = addBookmark(tree, newBm, 'bm-1');
    expect(result[0].children).toHaveLength(3);
    expect(result[0].children[2].title).toBe('Section 1.3');
  });

  it('inserts at specific index', () => {
    const tree = makeTree();
    const newBm = createBookmark('Inserted', 1);
    const result = addBookmark(tree, newBm, undefined, 0);
    expect(result[0].title).toBe('Inserted');
    expect(result).toHaveLength(3);
  });

  it('is immutable — does not modify original', () => {
    const tree = makeTree();
    const newBm = createBookmark('New', 1);
    addBookmark(tree, newBm);
    expect(tree).toHaveLength(2); // unchanged
  });
});

describe('removeBookmark', () => {
  it('removes root-level bookmark', () => {
    const tree = makeTree();
    const result = removeBookmark(tree, 'bm-2');
    expect(result).toHaveLength(1);
  });

  it('removes nested bookmark', () => {
    const tree = makeTree();
    const result = removeBookmark(tree, 'bm-1-1');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].title).toBe('Section 1.2');
  });

  it('is immutable', () => {
    const tree = makeTree();
    removeBookmark(tree, 'bm-1');
    expect(tree).toHaveLength(2);
  });
});

describe('updateBookmark', () => {
  it('updates title', () => {
    const tree = makeTree();
    const result = updateBookmark(tree, 'bm-1', { title: 'Chapter One' });
    expect(result[0].title).toBe('Chapter One');
  });

  it('updates page of nested bookmark', () => {
    const tree = makeTree();
    const result = updateBookmark(tree, 'bm-1-2', { page: 10 });
    expect(result[0].children[1].page).toBe(10);
  });

  it('is immutable', () => {
    const tree = makeTree();
    updateBookmark(tree, 'bm-1', { title: 'Changed' });
    expect(tree[0].title).toBe('Chapter 1');
  });
});

/* ──────────────── Move ──────────────── */

describe('moveBookmark', () => {
  it('moves bookmark to root', () => {
    const tree = makeTree();
    const result = moveBookmark(tree, 'bm-1-1', null, 2);
    // bm-1-1 should be at root level now
    const flat = flattenBookmarks(result);
    const moved = flat.find((b) => b.id === 'bm-1-1');
    expect(moved).toBeDefined();
    expect(moved!.level).toBe(0);
  });

  it('returns original tree for non-existent source', () => {
    const tree = makeTree();
    const result = moveBookmark(tree, 'no-exist', null, 0);
    expect(countBookmarks(result)).toBe(countBookmarks(tree));
  });
});

/* ──────────────── Toggle Expanded ──────────────── */

describe('toggleExpanded', () => {
  it('toggles expanded state', () => {
    const tree = makeTree();
    const result = toggleExpanded(tree, 'bm-1');
    expect(result[0].expanded).toBe(false);
  });

  it('toggles nested bookmark', () => {
    const tree = makeTree();
    const result = toggleExpanded(tree, 'bm-1-1');
    expect(result[0].children[0].expanded).toBe(false);
  });
});

/* ──────────────── Utilities ──────────────── */

describe('recalculateLevels', () => {
  it('sets correct levels', () => {
    const tree = makeTree();
    // Mess up levels
    tree[0].level = 5;
    tree[0].children[0].level = 99;
    const fixed = recalculateLevels(tree, 0);
    expect(fixed[0].level).toBe(0);
    expect(fixed[0].children[0].level).toBe(1);
  });
});

describe('flattenBookmarks', () => {
  it('returns all bookmarks in flat array', () => {
    const flat = flattenBookmarks(makeTree());
    expect(flat).toHaveLength(4); // 2 root + 2 children
  });

  it('returns empty for empty tree', () => {
    expect(flattenBookmarks([])).toEqual([]);
  });
});

describe('countBookmarks', () => {
  it('counts all bookmarks including nested', () => {
    expect(countBookmarks(makeTree())).toBe(4);
  });

  it('returns 0 for empty tree', () => {
    expect(countBookmarks([])).toBe(0);
  });
});

describe('getMaxDepth', () => {
  it('returns 2 for two-level tree', () => {
    expect(getMaxDepth(makeTree())).toBe(2);
  });

  it('returns 0 for empty tree', () => {
    expect(getMaxDepth([])).toBe(0);
  });

  it('returns 1 for flat tree', () => {
    const flat: PdfBookmark[] = [
      {
        id: 'a',
        title: 'A',
        page: 1,
        yOffset: 0,
        level: 0,
        children: [],
        expanded: true,
      },
    ];
    expect(getMaxDepth(flat)).toBe(1);
  });
});

/* ──────────────── Validation ──────────────── */

describe('validateBookmarkTree', () => {
  it('returns no errors for valid tree', () => {
    const errors = validateBookmarkTree(makeTree(), 10);
    expect(errors).toHaveLength(0);
  });

  it('reports invalid page numbers', () => {
    const tree: PdfBookmark[] = [
      {
        id: 'a',
        title: 'Bad',
        page: 99,
        yOffset: 0,
        level: 0,
        children: [],
        expanded: true,
      },
    ];
    const errors = validateBookmarkTree(tree, 10);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('invalid page');
  });

  it('reports empty titles', () => {
    const tree: PdfBookmark[] = [
      {
        id: 'a',
        title: '  ',
        page: 1,
        yOffset: 0,
        level: 0,
        children: [],
        expanded: true,
      },
    ];
    const errors = validateBookmarkTree(tree, 10);
    expect(errors.some((e) => e.includes('empty title'))).toBe(true);
  });
});

/* ──────────────── Sorting ──────────────── */

describe('sortBookmarksByPage', () => {
  it('sorts bookmarks by page ascending', () => {
    const tree: PdfBookmark[] = [
      {
        id: 'b',
        title: 'B',
        page: 5,
        yOffset: 0,
        level: 0,
        children: [],
        expanded: true,
      },
      {
        id: 'a',
        title: 'A',
        page: 1,
        yOffset: 0,
        level: 0,
        children: [],
        expanded: true,
      },
    ];
    const sorted = sortBookmarksByPage(tree);
    expect(sorted[0].page).toBe(1);
    expect(sorted[1].page).toBe(5);
  });

  it('sorts children too', () => {
    const tree: PdfBookmark[] = [
      {
        id: 'p',
        title: 'P',
        page: 1,
        yOffset: 0,
        level: 0,
        expanded: true,
        children: [
          {
            id: 'c2',
            title: 'C2',
            page: 5,
            yOffset: 0,
            level: 1,
            children: [],
            expanded: true,
          },
          {
            id: 'c1',
            title: 'C1',
            page: 2,
            yOffset: 0,
            level: 1,
            children: [],
            expanded: true,
          },
        ],
      },
    ];
    const sorted = sortBookmarksByPage(tree);
    expect(sorted[0].children[0].page).toBe(2);
    expect(sorted[0].children[1].page).toBe(5);
  });
});
