// SPDX-License-Identifier: Apache-2.0
/**
 * useAutoSave Hook
 *
 * Periodically saves the editor state to localStorage.
 * On load, checks for an existing draft and offers restoration.
 */

'use client';

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { Annotation, PageMeta } from '../types';
import {
  computeFileHash,
  saveDraft,
  loadDraft,
  deleteDraft,
  hasDraft,
} from '../engine/auto-save';
import { AUTO_SAVE_INTERVAL_MS } from '../constants';

export interface UseAutoSaveReturn {
  /** Whether a draft exists for the current file */
  hasPendingDraft: boolean;
  /** The file hash used for draft storage */
  fileHash: string | null;
  /** Whether auto-save is currently active */
  isAutoSaving: boolean;
  /** Last auto-save timestamp */
  lastAutoSave: Date | null;
  /** Restore saved draft. Returns restored annotations or null. */
  restoreDraft: () => {
    annotations: Map<number, Annotation[]>;
    currentPage: number;
    zoom: number;
  } | null;
  /** Dismiss the draft restoration prompt */
  dismissDraft: () => void;
  /** Force a save now */
  saveNow: () => boolean;
}

export function useAutoSave(
  isLoaded: boolean,
  isDirty: boolean,
  originalBytes: Uint8Array | null,
  fileName: string,
  fileSize: number,
  totalPages: number,
  annotations: Map<number, Annotation[]>,
  pageMetadata: PageMeta[],
  currentPage: number,
  zoom: number,
): UseAutoSaveReturn {
  const [dismissedDraftHash, setDismissedDraftHash] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileHash = useMemo(
    () =>
      originalBytes && originalBytes.length > 0
        ? computeFileHash(originalBytes)
        : null,
    [originalBytes],
  );
  const hasPendingDraft = useMemo(
    () => !!fileHash && dismissedDraftHash !== fileHash && hasDraft(fileHash),
    [dismissedDraftHash, fileHash],
  );

  // Set up auto-save interval
  useEffect(() => {
    if (!isLoaded || !fileHash) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (!isDirty) return;

      setIsAutoSaving(true);
      const success = saveDraft(
        fileHash,
        fileName,
        fileSize,
        totalPages,
        annotations,
        pageMetadata,
        currentPage,
        zoom,
      );
      if (success) {
        setLastAutoSave(new Date());
      }
      setIsAutoSaving(false);
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    isLoaded,
    fileHash,
    isDirty,
    fileName,
    fileSize,
    totalPages,
    annotations,
    pageMetadata,
    currentPage,
    zoom,
  ]);

  const restoreDraft = useCallback((): {
    annotations: Map<number, Annotation[]>;
    currentPage: number;
    zoom: number;
  } | null => {
    if (!fileHash) return null;
    const draft = loadDraft(fileHash);
    if (draft) {
      setDismissedDraftHash(fileHash);
      return {
        annotations: draft.annotations,
        currentPage: draft.currentPage,
        zoom: draft.zoom,
      };
    }
    return null;
  }, [fileHash]);

  const dismissDraft = useCallback(() => {
    if (fileHash) {
      deleteDraft(fileHash);
      setDismissedDraftHash(fileHash);
    }
  }, [fileHash]);

  const saveNow = useCallback((): boolean => {
    if (!fileHash) return false;

    setIsAutoSaving(true);
    const success = saveDraft(
      fileHash,
      fileName,
      fileSize,
      totalPages,
      annotations,
      pageMetadata,
      currentPage,
      zoom,
    );
    if (success) {
      setLastAutoSave(new Date());
    }
    setIsAutoSaving(false);
    return success;
  }, [
    fileHash,
    fileName,
    fileSize,
    totalPages,
    annotations,
    pageMetadata,
    currentPage,
    zoom,
  ]);

  return {
    hasPendingDraft,
    fileHash,
    isAutoSaving,
    lastAutoSave,
    restoreDraft,
    dismissDraft,
    saveNow,
  };
}
