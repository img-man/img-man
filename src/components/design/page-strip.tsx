// SPDX-License-Identifier: Apache-2.0
/**
 * PageStrip Component
 *
 * Horizontal page thumbnails strip at the bottom of the Design Studio.
 * Shows miniature previews of each page with:
 * - Click to navigate
 * - Active page highlight
 * - Add page button
 * - Right-click context menu (duplicate, delete, rename)
 * - Drag-to-reorder support
 *
 * Architecture: Pure presentational component — receives pages + callbacks.
 */

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Plus, Copy, Trash2, Type, GripVertical } from 'lucide-react';
import type { DesignPage } from './editor-types';

/* ──────────────────────── Props ──────────────────────── */

export interface PageStripProps {
  pages: DesignPage[];
  currentPageIndex: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  onDuplicatePage: (index: number) => void;
  onDeletePage: (index: number) => void;
  onRenamePage: (index: number, name: string) => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
  /** Thumbnail render function — given a page, return a data URL or React node */
  renderThumbnail?: (page: DesignPage, index: number) => React.ReactNode;
}

/* ──────────────────────── Context Menu ──────────────────────── */

interface ContextMenuState {
  x: number;
  y: number;
  pageIndex: number;
}

/* ──────────────────────── Component ──────────────────────── */

export function PageStrip({
  pages,
  currentPageIndex,
  onPageSelect,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onRenamePage,
  onReorderPages,
  renderThumbnail,
}: PageStripProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  /* ── Close context menu on outside click / Escape ── */
  useEffect(() => {
    if (!contextMenu) return;

    const handleClick = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  /* ── Focus name edit input ── */
  useEffect(() => {
    if (editingIndex !== null && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingIndex]);

  /* ── Handlers ── */

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, pageIndex });
    },
    [],
  );

  const handleDuplicate = useCallback(
    (index: number) => {
      onDuplicatePage(index);
      setContextMenu(null);
    },
    [onDuplicatePage],
  );

  const handleDelete = useCallback(
    (index: number) => {
      if (pages.length <= 1) return;
      onDeletePage(index);
      setContextMenu(null);
    },
    [onDeletePage, pages.length],
  );

  const handleStartRename = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setEditName(pages[index]?.name || '');
      setContextMenu(null);
    },
    [pages],
  );

  const handleCommitRename = useCallback(() => {
    if (editingIndex !== null && editName.trim()) {
      onRenamePage(editingIndex, editName.trim());
    }
    setEditingIndex(null);
    setEditName('');
  }, [editingIndex, editName, onRenamePage]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDragFrom(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (dragFrom !== null && dragFrom !== toIndex) {
        onReorderPages(dragFrom, toIndex);
      }
      setDragFrom(null);
      setDragOver(null);
    },
    [dragFrom, onReorderPages],
  );

  const handleDragEnd = useCallback(() => {
    setDragFrom(null);
    setDragOver(null);
  }, []);

  return (
    <div
      className="flex items-center gap-2 border-t border-dash-border bg-dash-surface px-3 py-2 overflow-x-auto"
      role="tablist"
      aria-label="Design pages"
    >
      {/* Page thumbnails */}
      {pages.map((page, index) => (
        <div
          key={page.id}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={`relative group transition-all ${
            dragOver === index && dragFrom !== index
              ? 'translate-x-1 opacity-70'
              : ''
          }`}
        >
          {/* Drop indicator */}
          {dragOver === index && dragFrom !== null && dragFrom !== index && (
            <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-[var(--im-primary)] rounded-full z-10" />
          )}

          <button
            role="tab"
            aria-selected={index === currentPageIndex}
            aria-label={`${page.name} (Page ${index + 1})`}
            onClick={() => onPageSelect(index)}
            onContextMenu={(e) => handleContextMenu(e, index)}
            onDoubleClick={() => handleStartRename(index)}
            className={`relative flex flex-col items-center gap-1 rounded-lg border-2 transition-all px-1 py-1 min-w-[72px] ${
              index === currentPageIndex
                ? 'border-[var(--im-primary)] shadow-md shadow-[var(--im-primary)]/20'
                : 'border-transparent hover:border-dash-border'
            }`}
          >
            {/* Drag handle */}
            <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-50 transition-opacity">
              <GripVertical className="h-3 w-3 text-dash-text-muted" />
            </div>

            {/* Thumbnail preview */}
            <div
              className="w-16 h-12 rounded overflow-hidden flex items-center justify-center text-[9px] text-dash-text-muted"
              style={{ backgroundColor: page.background }}
            >
              {renderThumbnail ? (
                renderThumbnail(page, index)
              ) : (
                <span className="opacity-50">
                  {page.elements.length > 0
                    ? `${page.elements.length} items`
                    : 'Empty'}
                </span>
              )}
            </div>

            {/* Page name / inline rename */}
            {editingIndex === index ? (
              <input
                ref={editInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleCommitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCommitRename();
                  if (e.key === 'Escape') {
                    setEditingIndex(null);
                    setEditName('');
                  }
                }}
                className="w-16 text-[10px] text-center bg-dash-surface border border-dash-border rounded px-0.5 py-0 outline-none focus:border-[var(--im-primary)]"
                maxLength={30}
              />
            ) : (
              <span
                className={`text-[10px] font-medium truncate max-w-[64px] ${
                  index === currentPageIndex
                    ? 'text-[var(--im-primary)]'
                    : 'text-dash-text-muted'
                }`}
              >
                {page.name}
              </span>
            )}
          </button>
        </div>
      ))}

      {/* Add page button */}
      <button
        onClick={onAddPage}
        className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-dash-border hover:border-[var(--im-primary)] hover:text-[var(--im-primary)] transition-colors min-w-[72px] h-[72px] text-dash-text-muted"
        title="Add Page (Ctrl+Shift+N)"
        aria-label="Add new page"
      >
        <Plus className="h-5 w-5" />
        <span className="text-[10px]">Add</span>
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[140px] rounded-lg border border-dash-border bg-dash-surface shadow-lg py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            role="menuitem"
            onClick={() => handleDuplicate(contextMenu.pageIndex)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-dash-text hover:bg-dash-surface-hover transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate Page
          </button>
          <button
            role="menuitem"
            onClick={() => handleStartRename(contextMenu.pageIndex)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-dash-text hover:bg-dash-surface-hover transition-colors"
          >
            <Type className="h-3.5 w-3.5" />
            Rename Page
          </button>
          {pages.length > 1 && (
            <>
              <div className="my-1 border-t border-dash-border" />
              <button
                role="menuitem"
                onClick={() => handleDelete(contextMenu.pageIndex)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Page
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default PageStrip;
