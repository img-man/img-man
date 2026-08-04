// SPDX-License-Identifier: Apache-2.0
/**
 * DS-7.5 Batch Rename Helper Tests
 * Tests for exported pure helpers in batch-rename-client.tsx
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RENAME_TOKENS,
  applyPattern,
} from '@/app/dashboard/tools/batch-rename-client';

describe('DS-7.5 Batch Rename — RENAME_TOKENS', () => {
  it('contains expected tokens', () => {
    const tokens = RENAME_TOKENS.map((t) => t.token);
    expect(tokens).toContain('{original}');
    expect(tokens).toContain('{counter}');
    expect(tokens).toContain('{date}');
    expect(tokens).toContain('{time}');
    expect(tokens).toContain('{random}');
  });

  it('each token has label and description', () => {
    RENAME_TOKENS.forEach((t) => {
      expect(t.label).toBeTruthy();
      expect(t.desc).toBeTruthy();
    });
  });
});

describe('DS-7.5 Batch Rename — applyPattern', () => {
  const entry = { id: 'test-1', originalName: 'photo', extension: 'jpg' };

  it('replaces {original} with filename', () => {
    const result = applyPattern(entry, '{original}', 0, '', '');
    expect(result).toBe('photo.jpg');
  });

  it('replaces {counter} with zero-padded index+1', () => {
    const result = applyPattern(entry, '{counter}', 0, '', '');
    expect(result).toBe('001.jpg');

    const result2 = applyPattern(entry, '{counter}', 9, '', '');
    expect(result2).toBe('010.jpg');
  });

  it('replaces {date} with YYYY-MM-DD format', () => {
    const result = applyPattern(entry, '{date}', 0, '', '');
    // Should match date format
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}\.jpg$/);
  });

  it('replaces {time} with HH-MM-SS format', () => {
    const result = applyPattern(entry, '{time}', 0, '', '');
    expect(result).toMatch(/^\d{2}-\d{2}-\d{2}\.jpg$/);
  });

  it('replaces {random} with 4-char alphanumeric', () => {
    const result = applyPattern(entry, '{random}', 0, '', '');
    expect(result).toMatch(/^[a-z0-9]{4}\.jpg$/);
  });

  it('applies prefix and suffix', () => {
    const result = applyPattern(entry, '{original}', 0, 'proj_', '_final');
    expect(result).toBe('proj_photo_final.jpg');
  });

  it('combines multiple tokens', () => {
    const result = applyPattern(entry, '{original}_{counter}', 2, '', '');
    expect(result).toBe('photo_003.jpg');
  });

  it('sanitizes invalid filename characters', () => {
    const badEntry = { id: 'test-2', originalName: 'file<>name', extension: 'png' };
    const result = applyPattern(badEntry, '{original}', 0, '', '');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('file__name');
  });

  it('handles empty pattern gracefully', () => {
    const result = applyPattern(entry, '', 0, '', '');
    expect(result).toBe('.jpg');
  });

  it('handles prefix only with no pattern', () => {
    const result = applyPattern(entry, '', 0, 'IMG_', '');
    expect(result).toBe('IMG_.jpg');
  });
});

describe('DS-7.5 Batch Rename — module exports', () => {
  it('exports default BatchRenameModal component', async () => {
    const mod = await import('@/app/dashboard/tools/batch-rename-client');
    expect(mod.default).toBeDefined();
    expect(mod.default.name).toBe('BatchRenameModal');
  });
});
