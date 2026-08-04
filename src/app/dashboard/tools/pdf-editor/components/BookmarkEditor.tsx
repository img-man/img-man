// SPDX-License-Identifier: Apache-2.0
/**
 * BookmarkEditor Component — Phase 4, Week 15
 *
 * Tree-based bookmark editor with add, edit, delete, and reorder support.
 * Uses indentation levels to represent hierarchy.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import type { PdfBookmark } from '../types';
import {
  createBookmark,
  addBookmark,
  removeBookmark,
  updateBookmark,
  toggleExpanded,
  sortBookmarksByPage,
  countBookmarks,
  validateBookmarkTree,
} from '../engine/bookmark-engine';

/* ──────────────────────── Props ──────────────────────── */

interface BookmarkEditorProps {
  bookmarks: PdfBookmark[];
  onChange: (bookmarks: PdfBookmark[]) => void;
  totalPages: number;
  onNavigateToPage: (page: number) => void;
}

/* ──────────────────────── Bookmark Item ──────────────────────── */

interface BookmarkItemProps {
  bookmark: PdfBookmark;
  onToggle: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onPageChange: (id: string, page: number) => void;
  onNavigate: (page: number) => void;
  onAddChild: (parentId: string) => void;
  totalPages: number;
}

function BookmarkItem({
  bookmark,
  onToggle,
  onEdit,
  onDelete,
  onPageChange,
  onNavigate,
  onAddChild,
  totalPages,
}: BookmarkItemProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(bookmark.title);

  const handleSave = () => {
    if (editTitle.trim()) {
      onEdit(bookmark.id, editTitle.trim());
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(bookmark.title);
    setEditing(false);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1.5 hover:bg-dash-surface-hover rounded group"
        style={{ paddingLeft: `${bookmark.level * 16 + 8}px` }}
      >
        {/* Expand/Collapse */}
        {bookmark.children.length > 0 ? (
          <button
            onClick={() => onToggle(bookmark.id)}
            className="p-0.5 text-dash-text-muted hover:text-dash-text"
          >
            {bookmark.expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Drag Handle */}
        <GripVertical className="h-3 w-3 text-dash-text-muted/40 cursor-grab flex-shrink-0" />

        {/* Title */}
        {editing ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
              autoFocus
              className="flex-1 rounded border border-im-primary bg-dash-surface px-1.5 py-0.5 text-[11px] text-dash-text focus:outline-none"
            />
            <button
              onClick={handleSave}
              className="text-green-400 hover:text-green-300"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={handleCancel}
              className="text-dash-text-muted hover:text-dash-text"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onNavigate(bookmark.page)}
            className="flex-1 text-left text-[11px] text-dash-text truncate hover:text-im-primary"
            title={bookmark.title}
          >
            {bookmark.title}
          </button>
        )}

        {/* Page Number */}
        {!editing && (
          <input
            type="number"
            value={bookmark.page}
            onChange={(e) =>
              onPageChange(
                bookmark.id,
                Math.max(
                  1,
                  Math.min(totalPages, parseInt(e.target.value) || 1),
                ),
              )
            }
            min={1}
            max={totalPages}
            className="w-10 rounded border border-dash-border bg-transparent px-1 py-0.5 text-[10px] text-dash-text-muted text-center focus:border-im-primary focus:outline-none"
          />
        )}

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => setEditing(true)}
              className="rounded p-0.5 text-dash-text-muted hover:text-dash-text hover:bg-dash-surface-hover"
              title="Edit title"
            >
              <Edit3 className="h-3 w-3" />
            </button>
            <button
              onClick={() => onAddChild(bookmark.id)}
              className="rounded p-0.5 text-dash-text-muted hover:text-im-primary hover:bg-im-primary/10"
              title="Add child bookmark"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(bookmark.id)}
              className="rounded p-0.5 text-dash-text-muted hover:text-red-400 hover:bg-red-500/10"
              title="Delete bookmark"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {bookmark.expanded &&
        bookmark.children.map((child) => (
          <BookmarkItem
            key={child.id}
            bookmark={child}
            onToggle={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
            onPageChange={onPageChange}
            onNavigate={onNavigate}
            onAddChild={onAddChild}
            totalPages={totalPages}
          />
        ))}
    </div>
  );
}

/* ──────────────────────── Main Component ──────────────────────── */

export default function BookmarkEditor({
  bookmarks,
  onChange,
  totalPages,
  onNavigateToPage,
}: BookmarkEditorProps) {
  const count = countBookmarks(bookmarks);
  const errors = validateBookmarkTree(bookmarks, totalPages);

  const handleToggle = useCallback(
    (id: string) => onChange(toggleExpanded(bookmarks, id)),
    [bookmarks, onChange],
  );

  const handleEdit = useCallback(
    (id: string, title: string) =>
      onChange(updateBookmark(bookmarks, id, { title })),
    [bookmarks, onChange],
  );

  const handleDelete = useCallback(
    (id: string) => onChange(removeBookmark(bookmarks, id)),
    [bookmarks, onChange],
  );

  const handlePageChange = useCallback(
    (id: string, page: number) =>
      onChange(updateBookmark(bookmarks, id, { page })),
    [bookmarks, onChange],
  );

  const handleAddRoot = useCallback(() => {
    const bm = createBookmark('New Bookmark', 1);
    onChange(addBookmark(bookmarks, bm));
  }, [bookmarks, onChange]);

  const handleAddChild = useCallback(
    (parentId: string) => {
      const bm = createBookmark('New Bookmark', 1, 0, 1);
      onChange(addBookmark(bookmarks, bm, parentId));
    },
    [bookmarks, onChange],
  );

  const handleSort = useCallback(() => {
    onChange(sortBookmarksByPage(bookmarks));
  }, [bookmarks, onChange]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dash-border">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-im-primary" />
          <h3 className="text-xs font-semibold text-dash-text">Bookmarks</h3>
          <span className="text-[10px] text-dash-text-muted">({count})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleSort}
            className="rounded px-1.5 py-0.5 text-[10px] text-dash-text-muted hover:bg-dash-surface-hover transition"
            title="Sort by page"
          >
            Sort
          </button>
          <button
            onClick={handleAddRoot}
            className="rounded p-1 text-dash-text-muted hover:text-im-primary hover:bg-im-primary/10 transition"
            title="Add bookmark"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Validation */}
      {errors.length > 0 && (
        <div className="mx-3 mt-2 rounded-md bg-red-500/10 border border-red-500/30 p-2">
          {errors.map((err, i) => (
            <p key={i} className="text-[10px] text-red-400">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {bookmarks.length === 0 ? (
          <div className="p-4 text-center text-xs text-dash-text-muted">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p>No bookmarks yet.</p>
            <button
              onClick={handleAddRoot}
              className="mt-2 text-im-primary hover:underline text-[11px]"
            >
              Add first bookmark
            </button>
          </div>
        ) : (
          bookmarks.map((bm) => (
            <BookmarkItem
              key={bm.id}
              bookmark={bm}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onPageChange={handlePageChange}
              onNavigate={onNavigateToPage}
              onAddChild={handleAddChild}
              totalPages={totalPages}
            />
          ))
        )}
      </div>
    </div>
  );
}
