// SPDX-License-Identifier: Apache-2.0
/**
 * Auto-Save Engine
 *
 * Manages saving/restoring editor drafts to localStorage.
 * Each draft is keyed by a hash of the original PDF bytes,
 * allowing restoration when the same file is re-opened.
 */

import type { Annotation, DraftState, PageMeta } from '../types';
import { AUTO_SAVE_STORAGE_KEY, MAX_DRAFTS } from '../constants';

/* ──────────────────────── Hash ──────────────────────── */

/**
 * Compute a simple hash string from PDF bytes for identity.
 * Uses a fast non-crypto hash (FNV-1a 32-bit) for performance.
 */
export function computeFileHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < bytes.length; i += 64) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(36);
}

/* ──────────────────────── Serialization ──────────────────────── */

function annotationsToRecord(
  annotations: Map<number, Annotation[]>,
): Record<number, Annotation[]> {
  const record: Record<number, Annotation[]> = {};
  for (const [page, anns] of annotations) {
    record[page] = anns;
  }
  return record;
}

function recordToAnnotations(
  record: Record<number, Annotation[]>,
): Map<number, Annotation[]> {
  const map = new Map<number, Annotation[]>();
  for (const [pageStr, anns] of Object.entries(record)) {
    map.set(Number(pageStr), anns);
  }
  return map;
}

/* ──────────────────────── Storage Operations ──────────────────────── */

function getDraftsIndex(): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${AUTO_SAVE_STORAGE_KEY}-index`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setDraftsIndex(index: Record<string, number>): void {
  try {
    localStorage.setItem(
      `${AUTO_SAVE_STORAGE_KEY}-index`,
      JSON.stringify(index),
    );
  } catch {
    // Storage full — clean up oldest drafts
    pruneOldDrafts();
  }
}

function pruneOldDrafts(): void {
  const index = getDraftsIndex();
  const entries = Object.entries(index).sort((a, b) => a[1] - b[1]);

  // Remove oldest half
  const removeCount = Math.max(1, Math.floor(entries.length / 2));
  for (let i = 0; i < removeCount; i++) {
    const key = entries[i][0];
    localStorage.removeItem(`${AUTO_SAVE_STORAGE_KEY}-${key}`);
    delete index[key];
  }
  localStorage.setItem(`${AUTO_SAVE_STORAGE_KEY}-index`, JSON.stringify(index));
}

/* ──────────────────────── Public API ──────────────────────── */

/**
 * Save a draft to localStorage.
 */
export function saveDraft(
  fileHash: string,
  fileName: string,
  fileSize: number,
  totalPages: number,
  annotations: Map<number, Annotation[]>,
  pageMetadata: PageMeta[],
  currentPage: number,
  zoom: number,
): boolean {
  const draft: DraftState = {
    fileName,
    fileSize,
    totalPages,
    annotations: annotationsToRecord(annotations),
    pageMetadata,
    currentPage,
    zoom,
    savedAt: Date.now(),
    fileHash,
  };

  try {
    const json = JSON.stringify(draft);
    localStorage.setItem(`${AUTO_SAVE_STORAGE_KEY}-${fileHash}`, json);

    // Update index
    const index = getDraftsIndex();
    index[fileHash] = Date.now();

    // Enforce max drafts
    const entries = Object.entries(index).sort((a, b) => b[1] - a[1]);
    if (entries.length > MAX_DRAFTS) {
      for (let i = MAX_DRAFTS; i < entries.length; i++) {
        localStorage.removeItem(`${AUTO_SAVE_STORAGE_KEY}-${entries[i][0]}`);
        delete index[entries[i][0]];
      }
    }

    setDraftsIndex(index);
    return true;
  } catch {
    // localStorage full or unavailable
    return false;
  }
}

/**
 * Load a draft from localStorage.
 * Returns null if no draft found for the given hash.
 */
export function loadDraft(fileHash: string): {
  annotations: Map<number, Annotation[]>;
  currentPage: number;
  zoom: number;
  savedAt: Date;
} | null {
  try {
    const raw = localStorage.getItem(`${AUTO_SAVE_STORAGE_KEY}-${fileHash}`);
    if (!raw) return null;

    const draft: DraftState = JSON.parse(raw);
    return {
      annotations: recordToAnnotations(draft.annotations),
      currentPage: draft.currentPage,
      zoom: draft.zoom,
      savedAt: new Date(draft.savedAt),
    };
  } catch {
    return null;
  }
}

/**
 * Delete a draft.
 */
export function deleteDraft(fileHash: string): void {
  try {
    localStorage.removeItem(`${AUTO_SAVE_STORAGE_KEY}-${fileHash}`);
    const index = getDraftsIndex();
    delete index[fileHash];
    setDraftsIndex(index);
  } catch {
    // Ignore
  }
}

/**
 * Check if a draft exists for the given file hash.
 */
export function hasDraft(fileHash: string): boolean {
  try {
    return (
      localStorage.getItem(`${AUTO_SAVE_STORAGE_KEY}-${fileHash}`) !== null
    );
  } catch {
    return false;
  }
}

/**
 * List all saved drafts with metadata.
 */
export function listDrafts(): Array<{
  fileHash: string;
  fileName: string;
  savedAt: Date;
}> {
  const index = getDraftsIndex();
  const drafts: Array<{ fileHash: string; fileName: string; savedAt: Date }> =
    [];

  for (const [hash, timestamp] of Object.entries(index)) {
    try {
      const raw = localStorage.getItem(`${AUTO_SAVE_STORAGE_KEY}-${hash}`);
      if (raw) {
        const draft: DraftState = JSON.parse(raw);
        drafts.push({
          fileHash: hash,
          fileName: draft.fileName,
          savedAt: new Date(timestamp),
        });
      }
    } catch {
      // Skip corrupt entries
    }
  }

  return drafts.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
}

/**
 * Clear all drafts.
 */
export function clearAllDrafts(): void {
  const index = getDraftsIndex();
  for (const hash of Object.keys(index)) {
    localStorage.removeItem(`${AUTO_SAVE_STORAGE_KEY}-${hash}`);
  }
  localStorage.removeItem(`${AUTO_SAVE_STORAGE_KEY}-index`);
}
