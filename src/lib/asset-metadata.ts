// SPDX-License-Identifier: Apache-2.0
import {
  getAssetPreviewInfo,
  type AssetPreviewKind,
} from '@/lib/asset-preview';

export interface AssetMetadataLike {
  mimeType: string;
  fileCategory?: string;
  pageCount?: number | null;
  duration?: number | null;
  isCopy?: boolean;
}

export function formatAssetCategoryLabel(
  category?: string | null,
): string | null {
  if (!category) return null;

  return category
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatMetadataKeyLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function formatAssetSize(sizeBytes?: number | null): string {
  if (sizeBytes == null || Number.isNaN(sizeBytes)) return '—';
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAssetDuration(duration?: number | null): string | null {
  if (duration == null || duration <= 0) return null;

  const totalSeconds = Math.round(duration);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function getAssetCountLabel(
  mimeType: string,
  previewKind?: AssetPreviewKind,
): string {
  const normalized = mimeType.toLowerCase();
  const kind = previewKind ?? getAssetPreviewInfo(normalized).kind;

  if (kind === 'presentation') return 'Slides';
  if (kind === 'spreadsheet' || kind === 'csv') return 'Sheets';
  if (normalized === 'application/vnd.ms-powerpoint') return 'Slides';

  return 'Pages';
}

export function getAssetPreviewStatusLabel(
  previewKind: AssetPreviewKind,
): string {
  switch (previewKind) {
    case 'office-fallback':
      return 'Guided download';
    case 'generic':
      return 'Download to view';
    default:
      return 'Inline preview';
  }
}

export function getAssetInsightSummary(asset: AssetMetadataLike): {
  title: string;
  description: string;
  badges: string[];
} {
  const previewInfo = getAssetPreviewInfo(asset.mimeType);
  const previewStatus = getAssetPreviewStatusLabel(previewInfo.kind);
  const badges = [previewStatus];

  if (asset.pageCount && asset.pageCount > 0) {
    badges.push(`${asset.pageCount} ${getAssetCountLabel(asset.mimeType, previewInfo.kind).toLowerCase()}`);
  }

  const durationLabel = formatAssetDuration(asset.duration);
  if (durationLabel) {
    badges.push(durationLabel);
  }

  if (asset.isCopy) {
    badges.push('Copy');
  }

  switch (previewInfo.kind) {
    case 'pdf':
      return {
        title: 'PDF document',
        description:
          'Review pages inline, download the original file, and keep document context inside the asset drawer.',
        badges,
      };
    case 'spreadsheet':
    case 'csv':
      return {
        title: 'Spreadsheet workspace',
        description:
          'Inspect tabular content inline before exporting or handing off to downstream workflows.',
        badges,
      };
    case 'docx':
      return {
        title: 'Word document',
        description:
          'Read extracted document text inline so reviewers can verify content without leaving the dashboard.',
        badges,
      };
    case 'presentation':
      return {
        title: 'Presentation deck',
        description:
          'Scan slide text inline to validate messaging, structure, and delivery assets faster.',
        badges,
      };
    case 'document-text':
      return {
        title: 'Text document',
        description:
          'Open structured document text inline for quick review and download the source when deeper editing is needed.',
        badges,
      };
    case 'office-fallback':
      return {
        title: 'Legacy Office file',
        description:
          'This legacy format is stored safely. Use guided download to open it in a native desktop app when needed.',
        badges,
      };
    case 'audio':
      return {
        title: 'Audio asset',
        description:
          'Preview playback inline and validate runtime before sharing or publishing.',
        badges,
      };
    case 'video':
      return {
        title: 'Video asset',
        description:
          'Preview motion content inline and confirm duration before distribution.',
        badges,
      };
    case 'text':
      return {
        title: 'Text preview',
        description:
          'Inspect readable source content inline and download the file for local editing when required.',
        badges,
      };
    case 'generic':
      return {
        title: 'Stored file',
        description:
          'This file is available for secure download even when inline rendering is not supported yet.',
        badges,
      };
    default:
      return {
        title: 'Media asset',
        description:
          'Review the asset inline, then continue with download, sharing, or AI-powered follow-up actions.',
        badges,
      };
  }
}
