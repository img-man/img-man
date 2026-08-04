// SPDX-License-Identifier: Apache-2.0
import { getFileCategory } from '@/lib/file-types';

export const UNSUPPORTED_PREVIEW_TOOLTIP =
  'Preview not supported yet — file still stored safely';

export type AssetPreviewKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'csv'
  | 'spreadsheet'
  | 'docx'
  | 'presentation'
  | 'document-text'
  | 'office-fallback'
  | 'text'
  | 'generic';

export interface AssetPreviewInfo {
  kind: AssetPreviewKind;
  supportsInlinePreview: boolean;
  showUnsupportedBadge: boolean;
  tooltip: string;
}

export interface AssetPreviewSourceLike {
  thumbnailBase64?: string | null;
  thumbnailUrl?: string | null;
}

export function hasAssetThumbnailPreview(asset: AssetPreviewSourceLike): boolean {
  const thumbSrc = asset.thumbnailBase64 || asset.thumbnailUrl || '';
  return (
    !!thumbSrc &&
    (thumbSrc.startsWith('data:image') ||
      thumbSrc.startsWith('http://') ||
      thumbSrc.startsWith('https://') ||
      thumbSrc.startsWith('/'))
  );
}

export function getAssetPreviewInfo(mimeType: string): AssetPreviewInfo {
  const normalized = mimeType.toLowerCase();
  const category = getFileCategory(normalized);

  if (!normalized || normalized.startsWith('image/')) {
    return {
      kind: 'image',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Image preview available',
    };
  }

  if (normalized.startsWith('video/')) {
    return {
      kind: 'video',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Video preview available',
    };
  }

  if (normalized.startsWith('audio/')) {
    return {
      kind: 'audio',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Audio preview available',
    };
  }

  if (normalized === 'application/pdf') {
    return {
      kind: 'pdf',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'PDF preview available',
    };
  }

  if (normalized === 'text/csv' || normalized === 'application/csv') {
    return {
      kind: 'csv',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Spreadsheet preview available',
    };
  }

  if (
    normalized.includes('spreadsheet') ||
    normalized.includes('excel') ||
    normalized === 'application/vnd.ms-excel' ||
    normalized.includes('sheet')
  ) {
    return {
      kind: 'spreadsheet',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Spreadsheet preview available',
    };
  }

  if (
    normalized ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalized.includes('wordprocessingml.document')
  ) {
    return {
      kind: 'docx',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Document preview available',
    };
  }

  if (
    normalized ===
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    normalized.includes('presentationml') ||
    normalized.includes('opendocument.presentation')
  ) {
    return {
      kind: 'presentation',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Presentation preview available',
    };
  }

  if (
    normalized === 'application/vnd.oasis.opendocument.text' ||
    normalized.includes('opendocument.text') ||
    normalized === 'application/rtf' ||
    normalized === 'text/rtf'
  ) {
    return {
      kind: 'document-text',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Document preview available',
    };
  }

  if (
    normalized === 'application/msword' ||
    normalized === 'application/vnd.ms-powerpoint'
  ) {
    return {
      kind: 'office-fallback',
      supportsInlinePreview: false,
      showUnsupportedBadge: true,
      tooltip: 'Legacy Office preview not supported yet — guidance available',
    };
  }

  if (category === 'code' || normalized.startsWith('text/')) {
    return {
      kind: 'text',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Text preview available',
    };
  }

  if (category === 'document' || category === 'archive' || category === 'other') {
    return {
      kind: 'generic',
      supportsInlinePreview: false,
      showUnsupportedBadge: true,
      tooltip: UNSUPPORTED_PREVIEW_TOOLTIP,
    };
  }

  return {
    kind: 'generic',
    supportsInlinePreview: false,
    showUnsupportedBadge: true,
    tooltip: UNSUPPORTED_PREVIEW_TOOLTIP,
  };
}
