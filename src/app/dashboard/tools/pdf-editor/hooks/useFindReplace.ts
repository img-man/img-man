// SPDX-License-Identifier: Apache-2.0
/**
 * useFindReplace Hook — Phase 3, Week 9
 *
 * Manages find & replace state for the PDF editor.
 * Integrates with text-extractor engine for searching across pages.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import type { ExtractedTextBlock, FindMatch, FindReplaceState } from '../types';
import {
  findInTextBlocks,
  replaceMatch,
  replaceAllMatches,
} from '../engine/text-extractor';

/* ──────────────────────── Hook ──────────────────────── */

export function useFindReplace(textBlocks: Map<number, ExtractedTextBlock[]>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);

  // Compute matches whenever query or options change
  const matches = useMemo<FindMatch[]>(() => {
    if (!query || !isOpen) return [];
    return findInTextBlocks(textBlocks, query, caseSensitive, useRegex);
  }, [textBlocks, query, caseSensitive, useRegex, isOpen]);

  // Auto-select first match when matches change
  const effectiveActiveIndex = useMemo(() => {
    if (matches.length === 0) return -1;
    if (activeMatchIndex < 0 || activeMatchIndex >= matches.length) return 0;
    return activeMatchIndex;
  }, [matches, activeMatchIndex]);

  // Active match
  const activeMatch = useMemo<FindMatch | null>(() => {
    if (effectiveActiveIndex < 0 || effectiveActiveIndex >= matches.length)
      return null;
    return matches[effectiveActiveIndex];
  }, [matches, effectiveActiveIndex]);

  // ─── Actions ───

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setReplacement('');
    setActiveMatchIndex(-1);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  const nextMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const prevMatch = useCallback(() => {
    if (matches.length === 0) return;
    setActiveMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const replaceOne = useCallback((): boolean => {
    if (!activeMatch || !replacement.length) return false;
    const result = replaceMatch(textBlocks, activeMatch, replacement);
    if (result !== null) {
      // If match was replaced, move to next (index stays same, matches recalculate)
      setQuery((q) => q); // trigger re-render
      return true;
    }
    return false;
  }, [activeMatch, replacement, textBlocks]);

  const replaceAll = useCallback((): number => {
    if (matches.length === 0 || !replacement.length) return 0;
    const count = replaceAllMatches(textBlocks, matches, replacement);
    setQuery((q) => q); // trigger re-render
    setActiveMatchIndex(-1);
    return count;
  }, [matches, replacement, textBlocks]);

  // ─── State object ───

  const state: FindReplaceState = {
    isOpen,
    query,
    replacement,
    caseSensitive,
    useRegex,
    matches,
    activeMatchIndex: effectiveActiveIndex,
  };

  return {
    state,
    activeMatch,
    matchCount: matches.length,

    // Open/Close
    open,
    close,
    toggle,

    // Query
    setQuery,
    setReplacement,
    setCaseSensitive,
    setUseRegex,

    // Navigation
    nextMatch,
    prevMatch,

    // Replace
    replaceOne,
    replaceAll,
  };
}
