// SPDX-License-Identifier: Apache-2.0
/**
 * save-to-library.ts
 *
 * Shared utility for saving tool output (Blob / Uint8Array) to the
 * user's asset library via the dashboard upload flow. It prefers direct
 * signed uploads, but falls back to a same-origin server upload when the
 * bucket cannot satisfy browser CORS preflights.
 */

import { uploadBinaryToStorage } from '@/lib/upload-helpers';

export interface SaveToLibraryOptions {
  /** The file bytes to save */
  blob: Blob;
  /** Display name for the asset */
  fileName: string;
  /** MIME type (e.g. 'application/pdf', 'image/png') */
  mimeType: string;
  /** Optional folder ID to place the asset in */
  folderId?: string;
}

export interface SaveToLibraryResult {
  success: boolean;
  assetId?: string;
  error?: string;
}

export async function saveToLibrary(
  opts: SaveToLibraryOptions,
): Promise<SaveToLibraryResult> {
  const { blob, fileName, mimeType, folderId } = opts;

  try {
    const { storageKey } = await uploadBinaryToStorage(blob, fileName, mimeType);

    // Confirm asset creation
    const confirmRes = await fetch('/api/assets/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storageKey,
        name: fileName,
        originalName: fileName,
        mimeType,
        sizeBytes: blob.size,
        folderId: folderId || undefined,
      }),
    });

    if (!confirmRes.ok) {
      const err = await confirmRes
        .json()
        .catch(() => ({ error: 'Confirm failed' }));
      return {
        success: false,
        error: err.error ?? 'Failed to save asset record',
      };
    }

    const { asset } = await confirmRes.json();
    return { success: true, assetId: String(asset._id) };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
