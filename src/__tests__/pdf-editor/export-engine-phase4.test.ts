// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for export-engine.ts Phase 4 additions
 *
 * Covers createDefaultExportConfig, validateExportConfig,
 * checkPdfAMetadataCompliance, getPdfARequirements, getPdfXRequirements,
 * isLinearizationBeneficial, estimateCompressedSize, createExportResult,
 * createFailedExportResult, getFormatDescription, getRecommendedConfig,
 * formatFileSize
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultExportConfig,
  validateExportConfig,
  checkPdfAMetadataCompliance,
  getPdfARequirements,
  getPdfXRequirements,
  isLinearizationBeneficial,
  estimateCompressedSize,
  createExportResult,
  createFailedExportResult,
  getFormatDescription,
  getRecommendedConfig,
  formatFileSize,
} from '@/app/dashboard/tools/pdf-editor/engine/export-engine';
import type {
  PdfMetadata,
  ExportConfig,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helper ──────────────── */

function makeMetadata(overrides: Partial<PdfMetadata> = {}): PdfMetadata {
  return {
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    creationDate: undefined,
    modificationDate: undefined,
    custom: {},
    ...overrides,
  };
}

/* ──────────────── Export Config ──────────────── */

describe('createDefaultExportConfig', () => {
  it('creates config with standard format', () => {
    const config = createDefaultExportConfig();
    expect(config.format).toBe('standard');
    expect(config.imageQuality).toBeGreaterThan(0);
    expect(config.imageQuality).toBeLessThanOrEqual(100);
    expect(typeof config.embedFonts).toBe('boolean');
  });
});

describe('validateExportConfig', () => {
  it('validates valid config', () => {
    const config = createDefaultExportConfig();
    expect(validateExportConfig(config)).toEqual([]);
  });

  it('rejects quality below 1', () => {
    const config: ExportConfig = {
      ...createDefaultExportConfig(),
      imageQuality: 0,
    };
    expect(validateExportConfig(config).length).toBeGreaterThan(0);
  });

  it('rejects quality above 100', () => {
    const config: ExportConfig = {
      ...createDefaultExportConfig(),
      imageQuality: 101,
    };
    expect(validateExportConfig(config).length).toBeGreaterThan(0);
  });
});

/* ──────────────── PDF/A Compliance ──────────────── */

describe('checkPdfAMetadataCompliance', () => {
  it('reports missing title', () => {
    const result = checkPdfAMetadataCompliance(makeMetadata());
    expect(result.compliant).toBe(false);
    expect(result.issues.some((i) => i.toLowerCase().includes('title'))).toBe(
      true,
    );
  });

  it('passes when title is set', () => {
    const result = checkPdfAMetadataCompliance(
      makeMetadata({ title: 'My Document' }),
    );
    expect(result.compliant).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

describe('getPdfARequirements', () => {
  it('returns a non-empty list of requirements', () => {
    const reqs = getPdfARequirements();
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs.some((r) => r.toLowerCase().includes('font'))).toBe(true);
  });
});

/* ──────────────── PDF/X Compliance ──────────────── */

describe('getPdfXRequirements', () => {
  it('returns a non-empty list of requirements', () => {
    const reqs = getPdfXRequirements();
    expect(reqs.length).toBeGreaterThan(0);
    expect(reqs.some((r) => r.toLowerCase().includes('cmyk'))).toBe(true);
  });
});

/* ──────────────── Linearization ──────────────── */

describe('isLinearizationBeneficial', () => {
  it('returns false for small files', () => {
    expect(isLinearizationBeneficial(50 * 1024)).toBe(false);
  });

  it('returns true for larger files', () => {
    expect(isLinearizationBeneficial(200 * 1024)).toBe(true);
  });

  it('threshold is around 100KB', () => {
    expect(isLinearizationBeneficial(100 * 1024)).toBe(false); // exactly 100KB
    expect(isLinearizationBeneficial(100 * 1024 + 1)).toBe(true);
  });
});

/* ──────────────── Compression Estimation ──────────────── */

describe('estimateCompressedSize', () => {
  it('returns original size at quality 100 with no other options', () => {
    const config: ExportConfig = {
      format: 'standard',
      imageQuality: 100,
      flattenAnnotations: false,
      embedFonts: true,
      deduplicateResources: false,
      subsetFonts: false,
    };
    const result = estimateCompressedSize(100000, config);
    expect(result.estimatedSize).toBe(100000);
    expect(result.reductionPercent).toBe(0);
  });

  it('reduces size at lower quality', () => {
    const config: ExportConfig = {
      format: 'standard',
      imageQuality: 50,
      flattenAnnotations: false,
      embedFonts: true,
      deduplicateResources: false,
      subsetFonts: false,
    };
    const result = estimateCompressedSize(100000, config);
    expect(result.estimatedSize).toBeLessThan(100000);
    expect(result.reductionPercent).toBeGreaterThan(0);
  });

  it('deduplication further reduces size', () => {
    const base: ExportConfig = {
      format: 'standard',
      imageQuality: 80,
      flattenAnnotations: false,
      embedFonts: true,
      deduplicateResources: false,
      subsetFonts: false,
    };
    const withDedup: ExportConfig = { ...base, deduplicateResources: true };
    const r1 = estimateCompressedSize(100000, base);
    const r2 = estimateCompressedSize(100000, withDedup);
    expect(r2.estimatedSize).toBeLessThan(r1.estimatedSize);
  });

  it('font subsetting reduces size', () => {
    const base: ExportConfig = {
      format: 'standard',
      imageQuality: 100,
      flattenAnnotations: false,
      embedFonts: true,
      deduplicateResources: false,
      subsetFonts: false,
    };
    const withSubset: ExportConfig = { ...base, subsetFonts: true };
    const r1 = estimateCompressedSize(100000, base);
    const r2 = estimateCompressedSize(100000, withSubset);
    expect(r2.estimatedSize).toBeLessThan(r1.estimatedSize);
  });
});

/* ──────────────── Export Results ──────────────── */

describe('createExportResult', () => {
  it('creates successful result', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const result = createExportResult(bytes, ['warn1'], ['issue1']);
    expect(result.success).toBe(true);
    expect(result.fileSize).toBe(3);
    expect(result.warnings).toEqual(['warn1']);
    expect(result.complianceIssues).toEqual(['issue1']);
  });

  it('defaults to empty warnings and issues', () => {
    const result = createExportResult(new Uint8Array(10));
    expect(result.warnings).toEqual([]);
    expect(result.complianceIssues).toEqual([]);
  });
});

describe('createFailedExportResult', () => {
  it('creates failed result', () => {
    const result = createFailedExportResult('Something broke');
    expect(result.success).toBe(false);
    expect(result.fileSize).toBe(0);
    expect(result.warnings).toContain('Something broke');
  });
});

/* ──────────────── Format Descriptions ──────────────── */

describe('getFormatDescription', () => {
  it('returns description for all formats', () => {
    const formats = ['standard', 'pdf-a', 'pdf-x', 'linearized'] as const;
    for (const fmt of formats) {
      const desc = getFormatDescription(fmt);
      expect(desc).toBeTruthy();
      expect(typeof desc).toBe('string');
    }
  });
});

/* ──────────────── Recommended Config ──────────────── */

describe('getRecommendedConfig', () => {
  it('returns standard config', () => {
    const config = getRecommendedConfig('standard');
    expect(config.format).toBe('standard');
  });

  it('returns PDF/A config with 100% quality and embed fonts', () => {
    const config = getRecommendedConfig('pdf-a');
    expect(config.format).toBe('pdf-a');
    expect(config.imageQuality).toBe(100);
    expect(config.embedFonts).toBe(true);
  });

  it('returns PDF/X config with flattened annotations', () => {
    const config = getRecommendedConfig('pdf-x');
    expect(config.format).toBe('pdf-x');
    expect(config.flattenAnnotations).toBe(true);
  });

  it('returns linearized config with font subsetting', () => {
    const config = getRecommendedConfig('linearized');
    expect(config.format).toBe('linearized');
    expect(config.subsetFonts).toBe(true);
  });
});

/* ──────────────── Format File Size ──────────────── */

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    const result = formatFileSize(1536);
    expect(result).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    const result = formatFileSize(5 * 1024 * 1024);
    expect(result).toBe('5 MB');
  });
});
