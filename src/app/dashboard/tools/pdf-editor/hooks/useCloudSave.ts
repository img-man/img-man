// SPDX-License-Identifier: Apache-2.0
/**
 * useCloudSave Hook — Phase 3, Week 12
 *
 * Manages cloud save state, auto-save intervals, and version history.
 * Uses the cloud-save engine for serialization and path management.
 *
 * Note: Actual GCP storage operations happen via Server Actions — this hook
 * manages the client-side state and timing logic.
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  Annotation,
  PageMeta,
  CloudSaveStatus,
  PdfVersion,
} from '../types';
import {
  buildSavePayload,
  createVersionRecord,
  addToRecentFiles,
  countAnnotations,
} from '../engine/cloud-save';
import { CLOUD_SAVE_INTERVAL_MS } from '../constants';

/* ──────────────────────── Types ──────────────────────── */

interface CloudSaveActions {
  /** Trigger a manual save to cloud */
  saveToCloud: (name?: string) => Promise<void>;
  /** Create a named version snapshot */
  createVersion: (name: string) => Promise<void>;
  /** Restore a specific version */
  restoreVersion: (version: PdfVersion) => Promise<void>;
  /** Enable/disable auto-save */
  setAutoSaveEnabled: (enabled: boolean) => void;
}

interface CloudSaveReturn extends CloudSaveActions {
  /** Current save status */
  status: CloudSaveStatus;
  /** Last saved timestamp */
  lastSavedAt: Date | null;
  /** Whether auto-save is active */
  autoSaveEnabled: boolean;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Version history */
  versions: PdfVersion[];
  /** Error message */
  error: string | null;
  /** Status label for display */
  statusLabel: string;
}

/* ──────────────────────── Hook ──────────────────────── */

export function useCloudSave(
  isLoaded: boolean,
  isDirty: boolean,
  pdfBytes: Uint8Array | null,
  annotations: Map<number, Annotation[]>,
  pageMetadata: PageMeta[],
  fileName: string,
  orgId: string,
  documentId: string,
  /** Server Action to upload PDF + annotations to GCP */
  onSaveToServer?: (
    payload: ReturnType<typeof buildSavePayload>,
  ) => Promise<void>,
): CloudSaveReturn {
  const [status, setStatus] = useState<CloudSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [versions, setVersions] = useState<PdfVersion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastDirtyRef = useRef(false);

  // Track changes for auto-save
  useEffect(() => {
    lastDirtyRef.current = isDirty;
  }, [isDirty]);

  // ─── Save Logic ───

  const performSave = useCallback(
    async (isAutoSave: boolean, versionName?: string) => {
      if (!pdfBytes || !isLoaded) return;

      setStatus('saving');
      setError(null);

      try {
        const payload = buildSavePayload(
          pdfBytes,
          annotations,
          pageMetadata,
          fileName,
        );

        if (onSaveToServer) {
          await onSaveToServer(payload);
        }

        const now = new Date();
        setLastSavedAt(now);
        setStatus('saved');

        // Auto-revert to idle after 3 seconds
        setTimeout(() => {
          setStatus((s) => (s === 'saved' ? 'idle' : s));
        }, 3000);

        // Create version record
        if (versionName || isAutoSave) {
          const version = createVersionRecord(
            documentId,
            orgId,
            versionName || `Auto-save ${now.toLocaleTimeString()}`,
            pdfBytes.byteLength,
            countAnnotations(annotations),
            isAutoSave,
          );
          setVersions((prev) => [version, ...prev]);
        }

        // Update recent files
        addToRecentFiles({
          id: documentId,
          fileName,
          fileSize: pdfBytes.byteLength,
          totalPages: pageMetadata.length,
          lastEditedAt: now,
          storagePath: `pdf-editor/documents/${orgId}/${documentId}.pdf`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Save failed';
        setError(message);
        setStatus('error');
      }
    },
    [
      pdfBytes,
      isLoaded,
      annotations,
      pageMetadata,
      fileName,
      orgId,
      documentId,
      onSaveToServer,
    ],
  );

  // ─── Public Actions ───

  const saveToCloud = useCallback(
    async (name?: string) => {
      await performSave(false, name);
    },
    [performSave],
  );

  const createVersion = useCallback(
    async (name: string) => {
      await performSave(false, name);
    },
    [performSave],
  );

  const restoreVersion = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_version: PdfVersion) => {
      // In the full implementation, this would:
      // 1. Download the version's PDF from GCP
      // 2. Download the version's annotations JSON
      // 3. Call pdf.loadBuffer() and annotCtrl.setAnnotations()
      // For now, this is a placeholder for the Server Action integration
      setError('Version restore requires server integration');
    },
    [],
  );

  // ─── Auto-Save Timer ───

  useEffect(() => {
    if (!isLoaded || !autoSaveEnabled) {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      return;
    }

    saveTimerRef.current = setInterval(() => {
      if (lastDirtyRef.current) {
        performSave(true).catch(console.error);
      }
    }, CLOUD_SAVE_INTERVAL_MS);

    return () => {
      if (saveTimerRef.current) {
        clearInterval(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [isLoaded, autoSaveEnabled, performSave]);

  // ─── Status Label ───

  const statusLabel = (() => {
    switch (status) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved ✓';
      case 'error':
        return error || 'Save failed';
      default:
        return isDirty ? 'Unsaved changes' : 'All changes saved';
    }
  })();

  return {
    status,
    lastSavedAt,
    autoSaveEnabled,
    hasUnsavedChanges: isDirty,
    versions,
    error,
    statusLabel,
    saveToCloud,
    createVersion,
    restoreVersion,
    setAutoSaveEnabled,
  };
}
