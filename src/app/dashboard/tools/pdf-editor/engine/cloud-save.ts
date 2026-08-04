// SPDX-License-Identifier: Apache-2.0
/**
 * Cloud Save Engine — Phase 3, Week 12
 *
 * Manages saving/loading PDFs and annotation state to/from cloud storage (GCP).
 * Uses Server Actions for actual storage operations — this module provides
 * the client-side serialization/deserialization and state management.
 *
 * Architecture: Client prepares payloads → Server Action uploads to GCP.
 * This avoids importing @google-cloud/storage on the client.
 */

import type { Annotation, PageMeta, PdfVersion, RecentFile } from '../types';
import {
  PDF_STORAGE_PREFIX,
  VERSION_STORAGE_PREFIX,
  MAX_VERSIONS,
} from '../constants';

/* ──────────────────────── Serialization ──────────────────────── */

/**
 * Serialize annotations Map to a JSON-safe record.
 */
export function serializeAnnotations(
  annotations: Map<number, Annotation[]>,
): Record<number, Annotation[]> {
  const record: Record<number, Annotation[]> = {};
  for (const [page, anns] of annotations) {
    record[page] = anns;
  }
  return record;
}

/**
 * Deserialize annotations from JSON record back to Map.
 */
export function deserializeAnnotations(
  record: Record<number, Annotation[]>,
): Map<number, Annotation[]> {
  const map = new Map<number, Annotation[]>();
  for (const [pageStr, anns] of Object.entries(record)) {
    map.set(Number(pageStr), anns);
  }
  return map;
}

/* ──────────────────────── State Payload ──────────────────────── */

export interface CloudSavePayload {
  /** The modified PDF bytes as base64 */
  pdfBase64: string;
  /** Serialized annotations */
  annotations: Record<number, Annotation[]>;
  /** Page metadata */
  pageMetadata: PageMeta[];
  /** Original file name */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Total page count */
  totalPages: number;
  /** Timestamp of save */
  savedAt: string;
}

/**
 * Build a cloud save payload from editor state.
 */
export function buildSavePayload(
  pdfBytes: Uint8Array,
  annotations: Map<number, Annotation[]>,
  pageMetadata: PageMeta[],
  fileName: string,
): CloudSavePayload {
  return {
    pdfBase64: uint8ArrayToBase64(pdfBytes),
    annotations: serializeAnnotations(annotations),
    pageMetadata,
    fileName,
    fileSize: pdfBytes.byteLength,
    totalPages: pageMetadata.length,
    savedAt: new Date().toISOString(),
  };
}

/**
 * Restore editor state from a cloud save payload.
 */
export function restoreFromPayload(payload: CloudSavePayload): {
  pdfBytes: Uint8Array;
  annotations: Map<number, Annotation[]>;
  pageMetadata: PageMeta[];
  fileName: string;
} {
  return {
    pdfBytes: base64ToUint8Array(payload.pdfBase64),
    annotations: deserializeAnnotations(payload.annotations),
    pageMetadata: payload.pageMetadata,
    fileName: payload.fileName,
  };
}

/* ──────────────────────── Storage Path Helpers ──────────────────────── */

/**
 * Generate a storage path for a PDF document.
 */
export function getPdfStoragePath(orgId: string, documentId: string): string {
  return `${PDF_STORAGE_PREFIX}/${orgId}/${documentId}.pdf`;
}

/**
 * Generate a storage path for annotations JSON.
 */
export function getAnnotationsStoragePath(
  orgId: string,
  documentId: string,
): string {
  return `${PDF_STORAGE_PREFIX}/${orgId}/${documentId}.annotations.json`;
}

/**
 * Generate a storage path for a version snapshot.
 */
export function getVersionStoragePath(
  orgId: string,
  documentId: string,
  versionId: string,
): string {
  return `${VERSION_STORAGE_PREFIX}/${orgId}/${documentId}/${versionId}.pdf`;
}

/**
 * Generate a storage path for version annotations.
 */
export function getVersionAnnotationsPath(
  orgId: string,
  documentId: string,
  versionId: string,
): string {
  return `${VERSION_STORAGE_PREFIX}/${orgId}/${documentId}/${versionId}.annotations.json`;
}

/* ──────────────────────── Version Management ──────────────────────── */

/**
 * Create a new version record.
 */
export function createVersionRecord(
  documentId: string,
  orgId: string,
  name: string,
  fileSize: number,
  annotationCount: number,
  isAutoSave: boolean,
): PdfVersion {
  const versionId = `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id: versionId,
    name: name || `Version ${new Date().toLocaleString()}`,
    createdAt: new Date(),
    pdfPath: getVersionStoragePath(orgId, documentId, versionId),
    annotationsPath: getVersionAnnotationsPath(orgId, documentId, versionId),
    fileSize,
    annotationCount,
    isAutoSave,
  };
}

/**
 * Prune old versions, keeping the most recent MAX_VERSIONS.
 * Auto-save versions are pruned first.
 */
export function pruneVersions(versions: PdfVersion[]): {
  keep: PdfVersion[];
  prune: PdfVersion[];
} {
  if (versions.length <= MAX_VERSIONS) {
    return { keep: versions, prune: [] };
  }

  // Sort by date descending
  const sorted = [...versions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Keep named versions (non-auto-save) first
  const named = sorted.filter((v) => !v.isAutoSave);
  const autoSaved = sorted.filter((v) => v.isAutoSave);

  const keep: PdfVersion[] = [];
  const prune: PdfVersion[] = [];

  // Add named versions first
  for (const v of named) {
    if (keep.length < MAX_VERSIONS) {
      keep.push(v);
    } else {
      prune.push(v);
    }
  }

  // Fill remaining with auto-saves
  for (const v of autoSaved) {
    if (keep.length < MAX_VERSIONS) {
      keep.push(v);
    } else {
      prune.push(v);
    }
  }

  return { keep, prune };
}

/* ──────────────────────── Recent Files ──────────────────────── */

const RECENT_FILES_KEY = 'pdf-editor-recent-files';
const MAX_RECENT_FILES = 20;

/**
 * Save a file to the recent files list in localStorage.
 */
export function addToRecentFiles(file: RecentFile): void {
  if (typeof window === 'undefined') return;

  const existing = getRecentFiles();
  // Remove duplicate
  const filtered = existing.filter((f) => f.id !== file.id);
  // Add at the beginning
  filtered.unshift(file);
  // Trim
  const trimmed = filtered.slice(0, MAX_RECENT_FILES);

  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(trimmed));
}

/**
 * Get recent files from localStorage.
 */
export function getRecentFiles(): RecentFile[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFile[];
    return parsed.map((f) => ({
      ...f,
      lastEditedAt: new Date(f.lastEditedAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Remove a file from recent files.
 */
export function removeFromRecentFiles(fileId: string): void {
  if (typeof window === 'undefined') return;

  const existing = getRecentFiles();
  const filtered = existing.filter((f) => f.id !== fileId);
  localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(filtered));
}

/**
 * Clear all recent files.
 */
export function clearRecentFiles(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(RECENT_FILES_KEY);
}

/* ──────────────────────── Base64 Helpers ──────────────────────── */

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Count total annotations across all pages.
 */
export function countAnnotations(
  annotations: Map<number, Annotation[]>,
): number {
  let count = 0;
  for (const [, anns] of annotations) {
    count += anns.length;
  }
  return count;
}
