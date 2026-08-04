// SPDX-License-Identifier: Apache-2.0
/**
 * ThumbnailSidebar Component
 *
 * Left sidebar showing scrollable page thumbnails.
 * Click to navigate, active page is highlighted.
 * Supports drag-to-reorder pages and context menu.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCw,
  Copy,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { PageRenderer } from '../engine/page-renderer';
import { generateThumbnail } from '../engine/thumbnail-generator';
import type { PageMeta } from '../types';

/* ──────────────────────── PageThumbnail ──────────────────────── */

interface PageThumbnailProps {
  pageNumber: number;
  isActive: boolean;
  thumbnailUrl: string | null;
  isLoading: boolean;
  onClick: (page: number) => void;
  isDragOver: boolean;
  onDragStart: (page: number) => void;
  onDragOver: (page: number) => void;
  onDragEnd: () => void;
  onContextMenu: (page: number, e: React.MouseEvent) => void;
}

function PageThumbnail({
  pageNumber,
  isActive,
  thumbnailUrl,
  isLoading,
  onClick,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onContextMenu,
}: PageThumbnailProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(pageNumber));
        onDragStart(pageNumber);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(pageNumber);
      }}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(pageNumber, e);
      }}
      className={`relative transition-all ${isDragOver ? 'translate-y-1 opacity-70' : ''}`}
    >
      {/* Drop indicator line */}
      {isDragOver && (
        <div className="absolute -top-1 left-0 right-0 h-0.5 bg-[var(--im-primary)] rounded-full z-10" />
      )}

      <button
        onClick={() => onClick(pageNumber)}
        className={`group relative w-full rounded-lg border-2 transition-all overflow-hidden ${
          isActive
            ? 'border-[var(--im-primary)] shadow-md shadow-[var(--im-primary)]/20'
            : 'border-transparent hover:border-dash-border'
        }`}
        title={`Page ${pageNumber}`}
      >
        {/* Drag handle */}
        <div className="absolute top-0.5 left-0.5 z-10 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3 text-dash-text-muted" />
        </div>

        {/* Thumbnail image */}
        <div className="relative aspect-[0.707] w-full bg-white dark:bg-gray-800 rounded-md overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-dash-text-muted" />
            </div>
          ) : thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt={`Page ${pageNumber}`}
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-dash-muted">
              <span className="text-xs text-dash-text-muted">{pageNumber}</span>
            </div>
          )}
        </div>

        {/* Page number label */}
        <div
          className={`mt-1 text-center text-[10px] font-medium ${
            isActive ? 'text-[var(--im-primary)]' : 'text-dash-text-muted'
          }`}
        >
          {pageNumber}
        </div>
      </button>
    </div>
  );
}

/* ──────────────────────── Context Menu ──────────────────────── */

interface ContextMenuProps {
  x: number;
  y: number;
  pageNumber: number;
  totalPages: number;
  onRotate: (page: number, degrees: 90 | 180 | 270) => void;
  onDuplicate: (page: number) => void;
  onDelete: (page: number) => void;
  onClose: () => void;
}

function ThumbnailContextMenu({
  x,
  y,
  pageNumber,
  totalPages,
  onRotate,
  onDuplicate,
  onDelete,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const items = [
    {
      icon: <RotateCw className="h-3 w-3" />,
      label: 'Rotate 90° CW',
      onClick: () => {
        onRotate(pageNumber, 90);
        onClose();
      },
    },
    {
      icon: <Copy className="h-3 w-3" />,
      label: 'Duplicate',
      onClick: () => {
        onDuplicate(pageNumber);
        onClose();
      },
    },
    {
      icon: <Trash2 className="h-3 w-3 text-red-500" />,
      label: 'Delete',
      onClick: () => {
        if (totalPages > 1) {
          onDelete(pageNumber);
        }
        onClose();
      },
      disabled: totalPages <= 1,
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[140px] rounded-lg border border-dash-border bg-dash-surface shadow-lg py-1"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.onClick}
          disabled={item.disabled}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
            item.danger
              ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
              : 'text-dash-text hover:bg-dash-surface-hover'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────── ThumbnailSidebar ──────────────────────── */

interface ThumbnailSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  totalPages: number;
  currentPage: number;
  onPageClick: (page: number) => void;
  renderer: PageRenderer | null;
  pageMetadata: PageMeta[];
  onReorderPage?: (fromIndex: number, toIndex: number) => void;
  onRotatePage?: (pageNumber: number, degrees: 90 | 180 | 270) => void;
  onDuplicatePage?: (pageNumber: number) => void;
  onDeletePage?: (pageNumber: number) => void;
}

export default function ThumbnailSidebar({
  isOpen,
  onToggle,
  totalPages,
  currentPage,
  onPageClick,
  renderer,
  pageMetadata,
  onReorderPage,
  onRotatePage,
  onDuplicatePage,
  onDeletePage,
}: ThumbnailSidebarProps) {
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState<Set<number>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop state
  const [dragSource, setDragSource] = useState<number | null>(null);
  const [dragTarget, setDragTarget] = useState<number | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    pageNumber: number;
  } | null>(null);

  // Generate thumbnails progressively
  useEffect(() => {
    if (!renderer || totalPages === 0) return;

    let cancelled = false;

    const generateAll = async () => {
      for (let i = 1; i <= totalPages; i++) {
        if (cancelled) break;

        setLoading((prev) => new Set(prev).add(i));
        try {
          const url = await generateThumbnail(renderer, i);
          if (!cancelled) {
            setThumbnails((prev) => {
              const next = new Map(prev);
              next.set(i, url);
              return next;
            });
          }
        } catch {
          // Skip failed thumbnails
        } finally {
          if (!cancelled) {
            setLoading((prev) => {
              const next = new Set(prev);
              next.delete(i);
              return next;
            });
          }
        }
      }
    };

    generateAll();
    return () => {
      cancelled = true;
    };
  }, [renderer, totalPages]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentPage]);

  // Handle drag-and-drop reorder
  const handleDragStart = useCallback(
    (page: number) => setDragSource(page),
    [],
  );
  const handleDragOver = useCallback((page: number) => setDragTarget(page), []);

  const handleDragEnd = useCallback(() => {
    if (
      dragSource !== null &&
      dragTarget !== null &&
      dragSource !== dragTarget
    ) {
      onReorderPage?.(dragSource - 1, dragTarget - 1);
      // Clear thumbnails since pages changed
      setThumbnails(new Map());
    }
    setDragSource(null);
    setDragTarget(null);
  }, [dragSource, dragTarget, onReorderPage]);

  const handleContextMenu = useCallback((page: number, e: React.MouseEvent) => {
    setContextMenu({ x: e.clientX, y: e.clientY, pageNumber: page });
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 rounded-r-lg border border-l-0 border-dash-border bg-dash-surface p-1.5 shadow-md hover:bg-dash-surface-hover transition-colors"
        title="Show thumbnails"
      >
        <ChevronRight className="h-4 w-4 text-dash-text-muted" />
      </button>
    );
  }

  return (
    <>
      <div className="flex w-[140px] shrink-0 flex-col border-r border-dash-border bg-dash-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-3 py-2">
          <span className="text-[11px] font-semibold text-dash-text-muted uppercase tracking-wider">
            Pages
          </span>
          <button
            onClick={onToggle}
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
            title="Hide thumbnails"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Thumbnails scroll area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-2 space-y-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDragEnd}
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(
            (pageNum) => (
              <div
                key={pageNum}
                ref={pageNum === currentPage ? activeRef : undefined}
              >
                <PageThumbnail
                  pageNumber={pageNum}
                  isActive={pageNum === currentPage}
                  thumbnailUrl={thumbnails.get(pageNum) ?? null}
                  isLoading={loading.has(pageNum)}
                  onClick={onPageClick}
                  isDragOver={dragTarget === pageNum && dragSource !== pageNum}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                  onContextMenu={handleContextMenu}
                />
              </div>
            ),
          )}
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ThumbnailContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          pageNumber={contextMenu.pageNumber}
          totalPages={totalPages}
          onRotate={(p, d) => onRotatePage?.(p, d)}
          onDuplicate={(p) => onDuplicatePage?.(p)}
          onDelete={(p) => onDeletePage?.(p)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
