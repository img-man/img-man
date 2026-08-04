// SPDX-License-Identifier: Apache-2.0
/**
 * FindReplaceBar Component — Phase 3, Week 9
 *
 * Floating search bar for Find & Replace across all PDF pages.
 * Supports case-sensitive search, regex, replace one/all.
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Replace,
  ReplaceAll,
  CaseSensitive,
  Regex,
} from 'lucide-react';

/* ──────────────────────── Props ──────────────────────── */

interface FindReplaceBarProps {
  isOpen: boolean;
  query: string;
  replacement: string;
  caseSensitive: boolean;
  useRegex: boolean;
  matchCount: number;
  activeMatchIndex: number;
  onQueryChange: (query: string) => void;
  onReplacementChange: (replacement: string) => void;
  onToggleCaseSensitive: () => void;
  onToggleRegex: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReplaceOne: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

/* ──────────────────────── Component ──────────────────────── */

export default function FindReplaceBar({
  isOpen,
  query,
  replacement,
  caseSensitive,
  useRegex,
  matchCount,
  activeMatchIndex,
  onQueryChange,
  onReplacementChange,
  onToggleCaseSensitive,
  onToggleRegex,
  onNext,
  onPrev,
  onReplaceOne,
  onReplaceAll,
  onClose,
}: FindReplaceBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard handler: Enter = next, Shift+Enter = prev, Escape = close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          onPrev();
        } else {
          onNext();
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onNext, onPrev, onClose],
  );

  if (!isOpen) return null;

  const matchLabel =
    matchCount > 0
      ? `${activeMatchIndex + 1} of ${matchCount}`
      : query
        ? 'No results'
        : '';

  return (
    <div className="absolute top-2 right-4 z-50 flex flex-col gap-1.5 rounded-lg border border-dash-border bg-dash-surface p-2.5 shadow-lg backdrop-blur-sm min-w-[360px]">
      {/* ─── Search Row ─── */}
      <div className="flex items-center gap-1.5">
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Find..."
          className="flex-1 rounded border border-dash-border bg-transparent px-2 py-1 text-xs text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
        />

        {/* Match count */}
        <span className="text-[10px] text-dash-text-muted whitespace-nowrap min-w-[60px] text-center">
          {matchLabel}
        </span>

        {/* Toggle buttons */}
        <ToggleButton
          icon={<CaseSensitive className="h-3.5 w-3.5" />}
          label="Match Case"
          active={caseSensitive}
          onClick={onToggleCaseSensitive}
        />
        <ToggleButton
          icon={<Regex className="h-3.5 w-3.5" />}
          label="Use Regex"
          active={useRegex}
          onClick={onToggleRegex}
        />

        {/* Prev / Next */}
        <button
          onClick={onPrev}
          disabled={matchCount === 0}
          title="Previous (Shift+Enter)"
          className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onNext}
          disabled={matchCount === 0}
          title="Next (Enter)"
          className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          title="Close (Escape)"
          className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ─── Replace Row ─── */}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={replacement}
          onChange={(e) => onReplacementChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Replace..."
          className="flex-1 rounded border border-dash-border bg-transparent px-2 py-1 text-xs text-dash-text placeholder:text-dash-text-muted focus:outline-none focus:ring-1 focus:ring-[var(--im-primary)]"
        />

        {/* Replace one */}
        <button
          onClick={onReplaceOne}
          disabled={matchCount === 0 || !replacement}
          title="Replace"
          className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Replace className="h-3.5 w-3.5" />
        </button>

        {/* Replace all */}
        <button
          onClick={onReplaceAll}
          disabled={matchCount === 0 || !replacement}
          title="Replace All"
          className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ReplaceAll className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────── ToggleButton ──────────────────────── */

function ToggleButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`rounded p-1 transition ${
        active
          ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
          : 'text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text'
      }`}
    >
      {icon}
    </button>
  );
}
