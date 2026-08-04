// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  SortAsc,
  SortDesc,
  Filter,
  X,
  Calendar,
  FileText,
  HardDrive,
  Image,
  Video,
  Music,
  FileArchive,
  FileCode,
  Layers,
  Sparkles,
  Type,
  Palette,
} from 'lucide-react';

export type SearchMode = 'text' | 'semantic';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchMode?: SearchMode;
  onSearchModeChange?: (mode: SearchMode) => void;
  isSemanticLoading?: boolean;
  sort: string;
  sortDir: 'asc' | 'desc';
  onSortChange: (sort: string, dir: 'asc' | 'desc') => void;
  mimeType: string;
  onMimeTypeChange: (type: string) => void;
  /** Sprint 9: Color filter */
  colorFilter?: string;
  onColorFilterChange?: (color: string) => void;
  totalSelected: number;
  onClearSelection: () => void;
  onBatchDelete?: () => void;
  onBatchMove?: () => void;
  onBatchShare?: () => void;
  onBatchFilter?: () => void;
}

/** Sprint 9: Predefined color swatches for color-based search */
const COLOR_SWATCHES = [
  { label: 'Red', hex: '#e00000' },
  { label: 'Orange', hex: '#e06000' },
  { label: 'Yellow', hex: '#e0c000' },
  { label: 'Green', hex: '#00a000' },
  { label: 'Teal', hex: '#008080' },
  { label: 'Blue', hex: '#0060e0' },
  { label: 'Purple', hex: '#8000c0' },
  { label: 'Pink', hex: '#e000a0' },
  { label: 'Brown', hex: '#804000' },
  { label: 'Black', hex: '#202020' },
  { label: 'Gray', hex: '#808080' },
  { label: 'White', hex: '#e0e0e0' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Date uploaded', icon: Calendar },
  { value: 'name', label: 'Name', icon: FileText },
  { value: 'sizeBytes', label: 'File size', icon: HardDrive },
  { value: 'updatedAt', label: 'Last modified', icon: Calendar },
];

const MIME_FILTERS = [
  { value: '', label: 'All types', icon: Layers },
  { value: 'image/', label: 'Images', icon: Image },
  { value: 'video/', label: 'Videos', icon: Video },
  { value: 'application/pdf', label: 'PDFs', icon: FileText },
  { value: 'audio/', label: 'Audio', icon: Music },
  { value: 'document', label: 'Documents', icon: FileCode },
  { value: 'archive', label: 'Archives', icon: FileArchive },
];

export function DashboardToolbar({
  searchQuery,
  onSearchChange,
  searchMode = 'text',
  onSearchModeChange,
  isSemanticLoading,
  sort,
  sortDir,
  onSortChange,
  mimeType,
  onMimeTypeChange,
  colorFilter,
  onColorFilterChange,
  totalSelected,
  onClearSelection,
  onBatchDelete,
  onBatchMove,
  onBatchShare,
  onBatchFilter,
}: ToolbarProps) {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const colorMenuRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const handleSearchInput = useCallback(
    (value: string) => {
      setLocalQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 350);
    },
    [onSearchChange],
  );

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(e.target as Node)
      ) {
        setShowSortMenu(false);
      }
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(e.target as Node)
      ) {
        setShowFilterMenu(false);
      }
      if (
        colorMenuRef.current &&
        !colorMenuRef.current.contains(e.target as Node)
      ) {
        setShowColorMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentSortLabel =
    SORT_OPTIONS.find((s) => s.value === sort)?.label ?? 'Date uploaded';

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-dash-border bg-dash-bg/80 backdrop-blur-md px-6 py-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        {isSemanticLoading ? (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
          </div>
        ) : searchMode === 'semantic' ? (
          <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-500" />
        ) : (
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-text-muted" />
        )}
        <input
          type="text"
          value={localQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder={
            searchMode === 'semantic'
              ? "AI Search: describe what you're looking for…"
              : 'Search assets by name or tag…'
          }
          className={`w-full rounded-lg border py-2 pl-9 pr-9 text-sm outline-none transition-all duration-200 text-dash-text placeholder-dash-text-muted ${
            searchMode === 'semantic'
              ? 'border-purple-300 dark:border-purple-500/50 bg-purple-50/50 dark:bg-purple-900/10 focus:border-purple-500 focus:ring-1 focus:ring-purple-500'
              : 'border-dash-border bg-dash-surface focus:border-primary focus:ring-1 focus:ring-primary'
          }`}
        />
        {localQuery && (
          <button
            onClick={() => handleSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-dash-text-muted hover:text-dash-text"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Mode Toggle */}
      {onSearchModeChange && (
        <div className="flex items-center rounded-lg border border-dash-border overflow-hidden">
          <button
            onClick={() => onSearchModeChange('text')}
            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition ${
              searchMode === 'text'
                ? 'bg-dash-surface-hover text-dash-text'
                : 'text-dash-text-muted hover:bg-dash-surface-hover/50'
            }`}
            title="Text Search (keyword matching)"
          >
            <Type className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Text</span>
          </button>
          <div className="h-5 w-px bg-dash-border" />
          <button
            onClick={() => onSearchModeChange('semantic')}
            className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition ${
              searchMode === 'semantic'
                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                : 'text-dash-text-muted hover:bg-dash-surface-hover/50'
            }`}
            title="AI Search (semantic understanding)"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>
      )}

      {/* Sort Dropdown */}
      <div className="relative" ref={sortMenuRef}>
        <button
          onClick={() => setShowSortMenu(!showSortMenu)}
          className="flex items-center gap-1.5 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 transition hover:border-dash-border-hover hover:bg-dash-surface-hover"
        >
          {sortDir === 'asc' ? (
            <SortAsc className="h-3.5 w-3.5" />
          ) : (
            <SortDesc className="h-3.5 w-3.5" />
          )}
          {currentSortLabel}
        </button>

        {showSortMenu && (
          <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-dash-border bg-dash-surface2 py-1 shadow-lg">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = sort === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (isActive) {
                      onSortChange(sort, sortDir === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange(opt.value, 'desc');
                    }
                    setShowSortMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-dash-surface-hover ${
                    isActive
                      ? 'font-semibold text-dash-text'
                      : 'text-dash-text2 dark:text-dash-text-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                  {isActive && (
                    <span className="ml-auto text-[10px] text-dash-text-muted">
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Filter Dropdown */}
      <div className="relative" ref={filterMenuRef}>
        <button
          onClick={() => setShowFilterMenu(!showFilterMenu)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-dash-surface-hover ${
            mimeType
              ? 'border-blue-300 dark:border-blue-500/50 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
              : 'border-dash-border text-dash-text2 hover:border-dash-border-hover '
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {mimeType
            ? (MIME_FILTERS.find((f) => f.value === mimeType)?.label ??
              'Filter')
            : 'Filter'}
        </button>

        {showFilterMenu && (
          <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-dash-border bg-dash-surface2 py-1 shadow-lg">
            {MIME_FILTERS.map((opt) => {
              const FilterIcon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    onMimeTypeChange(opt.value);
                    setShowFilterMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-dash-surface-hover ${
                    mimeType === opt.value
                      ? 'font-semibold text-dash-text'
                      : 'text-dash-text2 dark:text-dash-text-muted'
                  }`}
                >
                  <FilterIcon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Color Filter Dropdown */}
      {onColorFilterChange && (
        <div className="relative" ref={colorMenuRef}>
          <button
            onClick={() => setShowColorMenu(!showColorMenu)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:bg-dash-surface-hover ${
              colorFilter
                ? 'border-purple-300 dark:border-purple-500/50 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400'
                : 'border-dash-border text-dash-text2 hover:border-dash-border-hover'
            }`}
          >
            {colorFilter ? (
              <span
                className="h-3.5 w-3.5 rounded-full border border-black/10 dark:border-white/20"
                style={{ backgroundColor: colorFilter }}
              />
            ) : (
              <Palette className="h-3.5 w-3.5" />
            )}
            Color
          </button>

          {showColorMenu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-dash-border bg-dash-surface2 p-2 shadow-lg">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold text-dash-text-muted uppercase tracking-wide">
                  Filter by color
                </span>
                {colorFilter && (
                  <button
                    onClick={() => {
                      onColorFilterChange('');
                      setShowColorMenu(false);
                    }}
                    className="text-[10px] text-purple-500 hover:text-purple-700"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    onClick={() => {
                      onColorFilterChange(
                        colorFilter === swatch.hex ? '' : swatch.hex,
                      );
                      setShowColorMenu(false);
                    }}
                    className={`group relative h-6 w-6 rounded-full border-2 transition ${
                      colorFilter === swatch.hex
                        ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800 scale-110'
                        : 'border-transparent hover:border-dash-border-hover hover:scale-110'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                    title={swatch.label}
                  >
                    {colorFilter === swatch.hex && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="h-1.5 w-1.5 rounded-full bg-white shadow" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Action Bar */}
      {totalSelected > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
            {totalSelected} selected
          </span>
          <div className="h-4 w-px bg-blue-200 dark:bg-blue-800" />
          {onBatchShare && (
            <button
              onClick={onBatchShare}
              className="rounded px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 transition hover:bg-blue-100 dark:hover:bg-blue-900/40"
            >
              Share
            </button>
          )}
          {onBatchMove && (
            <button
              onClick={onBatchMove}
              className="rounded px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 transition hover:bg-blue-100 dark:hover:bg-blue-900/40"
            >
              Move
            </button>
          )}
          {onBatchFilter && (
            <button
              onClick={onBatchFilter}
              className="rounded px-2 py-1 text-xs font-medium text-violet-700 dark:text-violet-400 transition hover:bg-violet-50 dark:hover:bg-violet-900/20"
            >
              Apply Filter
            </button>
          )}
          {onBatchDelete && (
            <button
              onClick={onBatchDelete}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClearSelection}
            className="ml-1 text-blue-400 dark:text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
