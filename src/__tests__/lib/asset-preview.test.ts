// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  getAssetPreviewInfo,
  hasAssetThumbnailPreview,
  UNSUPPORTED_PREVIEW_TOOLTIP,
} from '@/lib/asset-preview';

describe('asset preview matrix', () => {
  it('marks csv as inline-previewable', () => {
    expect(getAssetPreviewInfo('text/csv')).toMatchObject({
      kind: 'csv',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
    });
  });

  it('marks xlsx as inline-previewable spreadsheet content', () => {
    expect(
      getAssetPreviewInfo(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).toMatchObject({
      kind: 'spreadsheet',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
    });
  });

  it('marks docx as inline-previewable document content', () => {
    expect(
      getAssetPreviewInfo(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toMatchObject({
      kind: 'docx',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Document preview available',
    });
  });

  it('marks pptx as inline-previewable presentation content', () => {
    expect(
      getAssetPreviewInfo(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).toMatchObject({
      kind: 'presentation',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Presentation preview available',
    });
  });

  it('marks odp as inline-previewable presentation content', () => {
    expect(
      getAssetPreviewInfo('application/vnd.oasis.opendocument.presentation'),
    ).toMatchObject({
      kind: 'presentation',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Presentation preview available',
    });
  });

  it('routes legacy ppt files to office fallback guidance', () => {
    expect(getAssetPreviewInfo('application/vnd.ms-powerpoint')).toMatchObject({
      kind: 'office-fallback',
      supportsInlinePreview: false,
      showUnsupportedBadge: true,
      tooltip: 'Legacy Office preview not supported yet — guidance available',
    });
  });

  it('marks odt as inline-previewable document text', () => {
    expect(
      getAssetPreviewInfo('application/vnd.oasis.opendocument.text'),
    ).toMatchObject({
      kind: 'document-text',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Document preview available',
    });
  });

  it('marks rtf as inline-previewable document text', () => {
    expect(getAssetPreviewInfo('application/rtf')).toMatchObject({
      kind: 'document-text',
      supportsInlinePreview: true,
      showUnsupportedBadge: false,
      tooltip: 'Document preview available',
    });
  });

  it('routes legacy doc files to office fallback guidance', () => {
    expect(getAssetPreviewInfo('application/msword')).toMatchObject({
      kind: 'office-fallback',
      supportsInlinePreview: false,
      showUnsupportedBadge: true,
      tooltip: 'Legacy Office preview not supported yet — guidance available',
    });
  });

  it('detects valid image thumbnails for card previews', () => {
    expect(
      hasAssetThumbnailPreview({
        thumbnailBase64: 'data:image/webp;base64,abc123',
      }),
    ).toBe(true);
    expect(
      hasAssetThumbnailPreview({
        thumbnailUrl: 'https://example.com/thumb.webp',
      }),
    ).toBe(true);
    expect(
      hasAssetThumbnailPreview({
        thumbnailUrl: 'data:application/pdf;base64,abc123',
      }),
    ).toBe(false);
  });
});
