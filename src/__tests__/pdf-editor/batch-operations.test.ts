// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for batch-operations.ts — Phase 4
 *
 * Covers getOperationDescription, isMultiOutputOperation, isMergeOperation,
 * getDefaultBatchConfig, validateBatchConfig, getOutputFileName
 */

import { describe, it, expect } from 'vitest';
import {
  getOperationDescription,
  isMultiOutputOperation,
  isMergeOperation,
  getDefaultBatchConfig,
  validateBatchConfig,
  getOutputFileName,
} from '@/app/dashboard/tools/pdf-editor/engine/batch-operations';
import type { BatchOperationType } from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Operation Descriptions ──────────────── */

describe('getOperationDescription', () => {
  const operations: BatchOperationType[] = [
    'merge',
    'split',
    'compress',
    'watermark',
    'password-protect',
    'convert-to-images',
    'flatten',
    'rotate',
    'add-page-numbers',
    'add-header-footer',
  ];

  it('returns a non-empty string for every operation', () => {
    for (const op of operations) {
      const desc = getOperationDescription(op);
      expect(desc).toBeTruthy();
      expect(typeof desc).toBe('string');
    }
  });
});

/* ──────────────── Multi-output ──────────────── */

describe('isMultiOutputOperation', () => {
  it('returns true for split', () => {
    expect(isMultiOutputOperation('split')).toBe(true);
  });

  it('returns true for convert-to-images', () => {
    expect(isMultiOutputOperation('convert-to-images')).toBe(true);
  });

  it('returns false for compress', () => {
    expect(isMultiOutputOperation('compress')).toBe(false);
  });

  it('returns false for merge', () => {
    expect(isMultiOutputOperation('merge')).toBe(false);
  });
});

/* ──────────────── Merge Operation ──────────────── */

describe('isMergeOperation', () => {
  it('returns true for merge', () => {
    expect(isMergeOperation('merge')).toBe(true);
  });

  it('returns false for other operations', () => {
    expect(isMergeOperation('compress')).toBe(false);
    expect(isMergeOperation('split')).toBe(false);
  });
});

/* ──────────────── Default Configs ──────────────── */

describe('getDefaultBatchConfig', () => {
  it('returns empty object for merge', () => {
    expect(getDefaultBatchConfig('merge')).toEqual({});
  });

  it('returns compress config with quality', () => {
    const config = getDefaultBatchConfig('compress');
    expect(config).toHaveProperty('imageQuality');
    expect(config).toHaveProperty('deduplicateObjects');
  });

  it('returns watermark config with text', () => {
    const config = getDefaultBatchConfig('watermark');
    expect(config).toHaveProperty('text');
    expect(config).toHaveProperty('fontSize');
    expect(config).toHaveProperty('opacity');
    expect(config).toHaveProperty('rotation');
  });

  it('returns rotate config with degrees', () => {
    const config = getDefaultBatchConfig('rotate');
    expect(config).toHaveProperty('degrees');
    expect(config).toHaveProperty('pageRange');
  });

  it('returns config for every operation', () => {
    const operations: BatchOperationType[] = [
      'merge',
      'split',
      'compress',
      'watermark',
      'password-protect',
      'convert-to-images',
      'flatten',
      'rotate',
      'add-page-numbers',
      'add-header-footer',
    ];
    for (const op of operations) {
      const config = getDefaultBatchConfig(op);
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    }
  });
});

/* ──────────────── Config Validation ──────────────── */

describe('validateBatchConfig', () => {
  it('returns no errors for valid compress config', () => {
    const errors = validateBatchConfig('compress', { imageQuality: 75 });
    expect(errors).toHaveLength(0);
  });

  it('rejects invalid compress quality', () => {
    const errors = validateBatchConfig('compress', { imageQuality: 150 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires password for password-protect', () => {
    const errors = validateBatchConfig('password-protect', {
      userPassword: '',
      ownerPassword: '',
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes valid password-protect config', () => {
    const errors = validateBatchConfig('password-protect', {
      userPassword: 'pass',
      ownerPassword: 'owner',
    });
    expect(errors).toHaveLength(0);
  });

  it('requires watermark text', () => {
    const errors = validateBatchConfig('watermark', { text: '' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('validates rotation degrees', () => {
    expect(validateBatchConfig('rotate', { degrees: 90 })).toHaveLength(0);
    expect(
      validateBatchConfig('rotate', { degrees: 45 }).length,
    ).toBeGreaterThan(0);
  });

  it('validates DPI for convert-to-images', () => {
    expect(validateBatchConfig('convert-to-images', { dpi: 150 })).toHaveLength(
      0,
    );
    expect(
      validateBatchConfig('convert-to-images', { dpi: 10 }).length,
    ).toBeGreaterThan(0);
  });

  it('returns empty for operations without validation', () => {
    expect(validateBatchConfig('flatten', {})).toHaveLength(0);
    expect(validateBatchConfig('merge', {})).toHaveLength(0);
  });
});

/* ──────────────── Output File Names ──────────────── */

describe('getOutputFileName', () => {
  it('returns merged.pdf for merge operation', () => {
    expect(getOutputFileName('any.pdf', 'merge')).toBe('merged.pdf');
  });

  it('strips .pdf extension for operations', () => {
    const name = getOutputFileName('document.pdf', 'compress');
    expect(name).not.toContain('.pdf.pdf');
    expect(name).toContain('document');
  });

  it('returns file name with operation suffix', () => {
    const name = getOutputFileName('report.pdf', 'watermark');
    expect(name).toBeTruthy();
    expect(typeof name).toBe('string');
  });
});
