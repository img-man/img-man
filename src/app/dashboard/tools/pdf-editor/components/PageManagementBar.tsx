// SPDX-License-Identifier: Apache-2.0
/**
 * PageManagementBar Component
 *
 * Contextual toolbar for page-level operations:
 * - Insert blank page (before/after)
 * - Delete current page
 * - Duplicate current page
 * - Rotate page (90° CW / CCW / 180°)
 * - Extract selected pages
 * - Full-screen toggle
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  RotateCw,
  RotateCcw,
  Maximize,
  Minimize,
  Download,
  Loader2,
  ChevronDown,
  FileText,
} from 'lucide-react';
import type { PageSize } from '../types';

/* ──────────────────────── Types ──────────────────────── */

interface PageManagementBarProps {
  currentPage: number;
  totalPages: number;
  isProcessing: boolean;
  isFullScreen: boolean;
  onInsertBlank: (afterPage: number, pageSize: PageSize) => void;
  onDeletePage: (pageNumber: number) => void;
  onDuplicatePage: (pageNumber: number) => void;
  onRotatePage: (pageNumber: number, degrees: 90 | 180 | 270) => void;
  onExtractPages: (pageNumbers: number[], fileName: string) => void;
  onToggleFullScreen: () => void;
}

/* ──────────────────────── Dropdown ──────────────────────── */

function DropdownMenu({
  trigger,
  items,
  isOpen,
  onToggle,
  onClose,
}: {
  trigger: React.ReactNode;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
    divider?: boolean;
  }>;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div ref={menuRef} className="relative">
      <div onClick={onToggle}>{trigger}</div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] rounded-lg border border-dash-border bg-dash-surface shadow-lg py-1">
          {items.map((item, i) =>
            item.divider ? (
              <div key={i} className="h-px bg-dash-border my-1" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    onClose();
                  }
                }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                  item.danger
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                    : 'text-dash-text hover:bg-dash-surface-hover'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────── Mini Button ──────────────────────── */

function MiniButton({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
        danger
          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
          : 'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

/* ──────────────────────── Main Component ──────────────────────── */

export default function PageManagementBar({
  currentPage,
  totalPages,
  isProcessing,
  isFullScreen,
  onInsertBlank,
  onDeletePage,
  onDuplicatePage,
  onRotatePage,
  onExtractPages,
  onToggleFullScreen,
}: PageManagementBarProps) {
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [rotateMenuOpen, setRotateMenuOpen] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractRange, setExtractRange] = useState('');
  const iconSize = 'h-3.5 w-3.5';

  const handleInsert = useCallback(
    (afterPage: number, size: PageSize) => {
      onInsertBlank(afterPage, size);
    },
    [onInsertBlank],
  );

  const handleExtractSubmit = useCallback(() => {
    // Parse range string like "1,3,5-7"
    const pages = parsePageRange(extractRange, totalPages);
    if (pages.length > 0) {
      onExtractPages(pages, `extracted_pages`);
      setExtractDialogOpen(false);
      setExtractRange('');
    }
  }, [extractRange, totalPages, onExtractPages]);

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-t border-dash-border bg-dash-surface">
      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-1 text-[var(--im-primary)] mr-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-[10px] font-medium">Processing...</span>
        </div>
      )}

      {/* Insert Page */}
      <DropdownMenu
        isOpen={insertMenuOpen}
        onToggle={() => setInsertMenuOpen(!insertMenuOpen)}
        onClose={() => setInsertMenuOpen(false)}
        trigger={
          <button
            disabled={isProcessing}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 transition-colors"
            title="Insert Page"
          >
            <Plus className={iconSize} />
            <span className="hidden lg:inline">Insert</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        }
        items={[
          {
            label: 'Before current page (A4)',
            icon: <FileText className="h-3 w-3" />,
            onClick: () => handleInsert(currentPage - 1, 'a4'),
          },
          {
            label: 'After current page (A4)',
            icon: <FileText className="h-3 w-3" />,
            onClick: () => handleInsert(currentPage, 'a4'),
          },
          { label: '', onClick: () => {}, divider: true },
          {
            label: 'Before current (Letter)',
            icon: <FileText className="h-3 w-3" />,
            onClick: () => handleInsert(currentPage - 1, 'letter'),
          },
          {
            label: 'After current (Letter)',
            icon: <FileText className="h-3 w-3" />,
            onClick: () => handleInsert(currentPage, 'letter'),
          },
          { label: '', onClick: () => {}, divider: true },
          {
            label: 'Same size as current page',
            icon: <FileText className="h-3 w-3" />,
            onClick: () => handleInsert(currentPage, 'same-as-adjacent'),
          },
        ]}
      />

      {/* Duplicate */}
      <MiniButton
        icon={<Copy className={iconSize} />}
        label="Duplicate"
        onClick={() => onDuplicatePage(currentPage)}
        disabled={isProcessing}
      />

      {/* Rotate */}
      <DropdownMenu
        isOpen={rotateMenuOpen}
        onToggle={() => setRotateMenuOpen(!rotateMenuOpen)}
        onClose={() => setRotateMenuOpen(false)}
        trigger={
          <button
            disabled={isProcessing}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 transition-colors"
            title="Rotate Page"
          >
            <RotateCw className={iconSize} />
            <span className="hidden lg:inline">Rotate</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        }
        items={[
          {
            label: 'Rotate 90° Clockwise',
            icon: <RotateCw className="h-3 w-3" />,
            onClick: () => onRotatePage(currentPage, 90),
          },
          {
            label: 'Rotate 90° Counter-clockwise',
            icon: <RotateCcw className="h-3 w-3" />,
            onClick: () => onRotatePage(currentPage, 270),
          },
          {
            label: 'Rotate 180°',
            icon: <RotateCw className="h-3 w-3" />,
            onClick: () => onRotatePage(currentPage, 180),
          },
        ]}
      />

      {/* Delete */}
      <MiniButton
        icon={<Trash2 className={iconSize} />}
        label="Delete"
        onClick={() => {
          if (totalPages <= 1) return;
          if (confirm(`Delete page ${currentPage}?`)) {
            onDeletePage(currentPage);
          }
        }}
        disabled={isProcessing || totalPages <= 1}
        danger
      />

      <div className="w-px h-4 bg-dash-border mx-1" />

      {/* Extract Pages */}
      <div className="relative">
        <MiniButton
          icon={<Download className={iconSize} />}
          label="Extract"
          onClick={() => setExtractDialogOpen(!extractDialogOpen)}
          disabled={isProcessing}
        />

        {extractDialogOpen && (
          <div className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-lg border border-dash-border bg-dash-surface shadow-lg p-3">
            <p className="text-xs font-medium text-dash-text mb-2">
              Extract Pages
            </p>
            <p className="text-[10px] text-dash-text-muted mb-2">
              Enter page numbers (e.g., 1,3,5-7)
            </p>
            <input
              value={extractRange}
              onChange={(e) => setExtractRange(e.target.value)}
              placeholder="1-3, 5, 7-10"
              className="w-full px-2 py-1 text-xs rounded border border-dash-border bg-transparent text-dash-text focus:outline-none focus:border-[var(--im-primary)]"
              onKeyDown={(e) => e.key === 'Enter' && handleExtractSubmit()}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  setExtractDialogOpen(false);
                  setExtractRange('');
                }}
                className="px-2 py-1 text-[10px] rounded text-dash-text-muted hover:bg-dash-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleExtractSubmit}
                disabled={!extractRange.trim()}
                className="px-2 py-1 text-[10px] rounded bg-[var(--im-primary)] text-[var(--im-primary-fg)] hover:brightness-110 disabled:opacity-50"
              >
                Extract
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Full-screen toggle */}
      <MiniButton
        icon={
          isFullScreen ? (
            <Minimize className={iconSize} />
          ) : (
            <Maximize className={iconSize} />
          )
        }
        label={isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}
        onClick={onToggleFullScreen}
      />
    </div>
  );
}

/* ──────────────────────── Helpers ──────────────────────── */

/**
 * Parse a page range string like "1,3,5-7" into an array of page numbers.
 */
function parsePageRange(input: string, maxPage: number): number[] {
  const pages = new Set<number>();
  const parts = input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(maxPage, end); i++) {
          pages.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= maxPage) {
        pages.add(num);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
}
