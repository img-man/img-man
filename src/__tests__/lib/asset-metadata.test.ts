// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  formatAssetCategoryLabel,
  formatAssetDuration,
  formatAssetSize,
  formatMetadataKeyLabel,
  getAssetCountLabel,
  getAssetInsightSummary,
  getAssetPreviewStatusLabel,
} from '@/lib/asset-metadata';

describe('asset metadata helpers', () => {
  it('formats file sizes consistently', () => {
    expect(formatAssetSize(512_000)).toBe('500.0 KB');
    expect(formatAssetSize(1_500_000)).toBe('1.4 MB');
  });

  it('formats durations for media assets', () => {
    expect(formatAssetDuration(65)).toBe('1:05');
    expect(formatAssetDuration(3672)).toBe('1:01:12');
  });

  it('formats category and metadata labels for UI display', () => {
    expect(formatAssetCategoryLabel('document')).toBe('Document');
    expect(formatAssetCategoryLabel('design_asset')).toBe('Design Asset');
    expect(formatMetadataKeyLabel('approvalStatus')).toBe('Approval Status');
    expect(formatMetadataKeyLabel('source_system')).toBe('Source system');
  });

  it('uses document-aware count labels', () => {
    expect(
      getAssetCountLabel(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).toBe('Slides');
    expect(getAssetCountLabel('application/vnd.ms-excel')).toBe('Sheets');
    expect(getAssetCountLabel('application/pdf')).toBe('Pages');
  });

  it('returns preview status labels by preview mode', () => {
    expect(getAssetPreviewStatusLabel('docx')).toBe('Inline preview');
    expect(getAssetPreviewStatusLabel('office-fallback')).toBe('Guided download');
    expect(getAssetPreviewStatusLabel('generic')).toBe('Download to view');
  });

  it('builds legacy office insight summaries', () => {
    const summary = getAssetInsightSummary({
      mimeType: 'application/msword',
      pageCount: 3,
      isCopy: true,
    });

    expect(summary.title).toBe('Legacy Office file');
    expect(summary.badges).toContain('Guided download');
    expect(summary.badges).toContain('3 pages');
    expect(summary.badges).toContain('Copy');
  });
});
