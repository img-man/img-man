// SPDX-License-Identifier: Apache-2.0
'use client';

import { BLOCKED_EXTENSIONS, getFileCategory, type FileCategory } from '@/lib/file-types';

export type UploadLifecycleStage =
  | 'requesting-url'
  | 'uploading'
  | 'extracting-metadata'
  | 'confirming'
  | 'done';

export interface UploadMetadata {
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
  pageCount?: number;
  thumbnailBase64?: string;
  fileCategory: FileCategory;
}

export interface UploadResult {
  asset: Record<string, unknown> | null;
  metadata: UploadMetadata;
}

/** Max file size per category (bytes) */
export const FILE_SIZE_LIMITS: Record<string, number> = {
  'image/': 50 * 1024 * 1024,
  'video/': 500 * 1024 * 1024,
  'audio/': 200 * 1024 * 1024,
  'application/pdf': 100 * 1024 * 1024,
  default: 200 * 1024 * 1024,
};

export function getFileSizeLimit(mimeType: string): number {
  for (const [prefix, limit] of Object.entries(FILE_SIZE_LIMITS)) {
    if (prefix === 'default') continue;
    if (mimeType.startsWith(prefix) || mimeType === prefix) return limit;
  }
  return FILE_SIZE_LIMITS.default;
}

export function formatUploadBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function validateUploadFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `"${file.name}" — executable files (.${ext}) are not allowed for security.`;
  }

  const mimeType = file.type || 'application/octet-stream';
  const limit = getFileSizeLimit(mimeType);
  if (file.size > limit) {
    return `"${file.name}" (${formatUploadBytes(file.size)}) exceeds the ${formatUploadBytes(limit)} limit for this file type.`;
  }

  return null;
}

export function summarizeUploadSelection(files: File[]) {
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const error = validateUploadFile(file);
    if (error) {
      errors.push(error);
    } else {
      validFiles.push(file);
    }
  }

  return { validFiles, errors };
}

function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = URL.createObjectURL(file);
  });
}

function getVideoMetadata(file: File): Promise<{
  width: number;
  height: number;
  duration: number;
  thumbnailBase64: string | null;
}> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => URL.revokeObjectURL(objectUrl);

    video.onloadedmetadata = () => {
      const safeDuration = Number.isFinite(video.duration) ? video.duration : 0;
      if (safeDuration <= 0) {
        cleanup();
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: 0,
          thumbnailBase64: null,
        });
        return;
      }

      video.currentTime = Math.min(1, safeDuration * 0.1);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(
          400 / Math.max(video.videoWidth, 1),
          400 / Math.max(video.videoHeight, 1),
          1,
        );
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailBase64 = canvas.toDataURL('image/webp', 0.8);
        cleanup();
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          thumbnailBase64,
        });
      } catch {
        cleanup();
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          thumbnailBase64: null,
        });
      }
    };

    video.onerror = () => {
      cleanup();
      resolve({ width: 0, height: 0, duration: 0, thumbnailBase64: null });
    };

    video.src = objectUrl;
  });
}

function getAudioDuration(file: File): Promise<{ duration: number }> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);

    audio.onloadedmetadata = () => {
      resolve({
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      });
      URL.revokeObjectURL(objectUrl);
    };
    audio.onerror = () => {
      resolve({ duration: 0 });
      URL.revokeObjectURL(objectUrl);
    };

    audio.src = objectUrl;
  });
}

async function getPdfMetadata(
  file: File,
): Promise<{ thumbnailBase64: string | null; pageCount: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjs = await import('pdfjs-dist');

    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      const workerSrc = await import('pdfjs-dist/build/pdf.worker.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default ?? workerSrc;
    }

    const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
      .promise;
    const pageCount = doc.numPages;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(400 / viewport.width, 400 / viewport.height, 1);
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      doc.destroy();
      return { thumbnailBase64: null, pageCount };
    }

    await page.render({
      canvas,
      canvasContext: ctx,
      viewport: scaledViewport,
    }).promise;
    const thumbnailBase64 = canvas.toDataURL('image/webp', 0.8);

    doc.destroy();
    return { thumbnailBase64, pageCount };
  } catch (err) {
    console.error('[Upload] PDF thumbnail extraction failed:', err);
    return { thumbnailBase64: null, pageCount: 0 };
  }
}

export async function extractUploadMetadata(file: File): Promise<UploadMetadata> {
  const mimeType = file.type || 'application/octet-stream';
  const metadata: UploadMetadata = {
    mimeType,
    fileCategory: getFileCategory(mimeType),
  };

  if (mimeType.startsWith('image/')) {
    const { width, height } = await getImageDimensions(file);
    metadata.width = width;
    metadata.height = height;
  } else if (mimeType.startsWith('video/')) {
    const { width, height, duration, thumbnailBase64 } =
      await getVideoMetadata(file);
    metadata.width = width;
    metadata.height = height;
    metadata.duration = duration;
    if (thumbnailBase64) metadata.thumbnailBase64 = thumbnailBase64;
  } else if (mimeType.startsWith('audio/')) {
    const { duration } = await getAudioDuration(file);
    metadata.duration = duration;
  } else if (mimeType === 'application/pdf') {
    const { thumbnailBase64, pageCount } = await getPdfMetadata(file);
    metadata.pageCount = pageCount;
    if (thumbnailBase64) metadata.thumbnailBase64 = thumbnailBase64;
  }

  return metadata;
}

async function parseJsonSafe(response: Response) {
  return response.json().catch(() => null) as Promise<Record<string, unknown> | null>;
}

type StorageUploadTarget = {
  uploadUrl: string;
  storageKey: string;
};

type StorageUploadResult = {
  storageKey: string;
};

type StorageUploadOptions = {
  preferServerUpload?: boolean;
};

function shouldPreferServerUpload(preferServerUpload?: boolean): boolean {
  if (preferServerUpload) {
    return true;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return true;
  }

  return window.location.pathname.startsWith('/embed/');
}

async function requestStorageUploadTarget(
  fileName: string,
  mimeType: string,
): Promise<StorageUploadTarget> {
  const uploadUrlRes = await fetch('/api/assets/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName,
      contentType: mimeType,
    }),
  });

  const uploadUrlData = await parseJsonSafe(uploadUrlRes);
  if (!uploadUrlRes.ok || !uploadUrlData?.uploadUrl || !uploadUrlData.storageKey) {
    throw new Error(
      (uploadUrlData?.error as string | undefined) ||
        `Failed to get upload URL (${uploadUrlRes.status})`,
    );
  }

  return {
    uploadUrl: uploadUrlData.uploadUrl as string,
    storageKey: uploadUrlData.storageKey as string,
  };
}

async function uploadBinaryViaServer(
  blob: Blob,
  fileName: string,
  mimeType: string,
): Promise<StorageUploadResult> {
  const formData = new FormData();
  formData.append('file', blob, fileName);
  formData.append('fileName', fileName);
  formData.append('contentType', mimeType);

  const uploadRes = await fetch('/api/assets/upload', {
    method: 'POST',
    body: formData,
  });

  const uploadData = await parseJsonSafe(uploadRes);
  if (!uploadRes.ok || !uploadData?.storageKey) {
    throw new Error(
      (uploadData?.error as string | undefined) ||
        `Fallback upload failed (${uploadRes.status})`,
    );
  }

  return { storageKey: uploadData.storageKey as string };
}

export async function uploadBinaryToStorage(
  blob: Blob,
  fileName: string,
  mimeType: string,
  options?: StorageUploadOptions,
): Promise<StorageUploadResult> {
  if (shouldPreferServerUpload(options?.preferServerUpload)) {
    return uploadBinaryViaServer(blob, fileName, mimeType);
  }

  const { uploadUrl, storageKey } = await requestStorageUploadTarget(
    fileName,
    mimeType,
  );

  try {
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: blob,
    });

    if (!putRes.ok) {
      throw new Error(`Upload to storage failed (${putRes.status})`);
    }

    return { storageKey };
  } catch (error) {
    console.warn(
      '[Upload] Direct storage upload failed, retrying via app server.',
      error,
    );
    return uploadBinaryViaServer(blob, fileName, mimeType);
  }
}

export async function uploadAssetFile(
  file: File,
  options?: {
    folderId?: string | null;
    onStageChange?: (stage: UploadLifecycleStage) => void;
    preferServerUpload?: boolean;
  },
): Promise<UploadResult> {
  const mimeType = file.type || 'application/octet-stream';
  options?.onStageChange?.('requesting-url');

  options?.onStageChange?.('uploading');
  const { storageKey } = await uploadBinaryToStorage(
    file,
    file.name,
    mimeType,
    { preferServerUpload: options?.preferServerUpload },
  );

  options?.onStageChange?.('extracting-metadata');
  const metadata = await extractUploadMetadata(file);

  options?.onStageChange?.('confirming');
  const confirmRes = await fetch('/api/assets/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storageKey,
      originalName: file.name,
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      width: metadata.width,
      height: metadata.height,
      duration: metadata.duration,
      fileCategory: metadata.fileCategory,
      thumbnailBase64: metadata.thumbnailBase64,
      pageCount: metadata.pageCount,
      folderId: options?.folderId || undefined,
    }),
  });

  const confirmData = await parseJsonSafe(confirmRes);
  if (!confirmRes.ok) {
    throw new Error(
      (confirmData?.error as string | undefined) ||
        `Failed to confirm upload (${confirmRes.status})`,
    );
  }

  const asset = (confirmData?.asset as Record<string, unknown> | undefined) ?? null;
  if (mimeType.startsWith('image/') && asset?._id) {
    fetch('/api/assets/thumbnail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: asset._id }),
    }).catch(() => {
      /* thumbnail generation is best-effort */
    });
  }

  options?.onStageChange?.('done');
  return { asset, metadata };
}
