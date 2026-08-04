// SPDX-License-Identifier: Apache-2.0
/**
 * DS-7.4 Batch Compressor Helper Tests
 * Tests for exported pure helpers in compressor-client.tsx
 */
import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  calcDimensions,
  FORMAT_OPTIONS,
} from '@/app/dashboard/tools/compressor-client';

describe('DS-7.4 Compressor — FORMAT_OPTIONS', () => {
  it('contains jpeg, png, webp', () => {
    const values = FORMAT_OPTIONS.map((o) => o.value);
    expect(values).toContain('jpeg');
    expect(values).toContain('png');
    expect(values).toContain('webp');
  });

  it('has labels for each option', () => {
    FORMAT_OPTIONS.forEach((o) => {
      expect(o.label).toBeTruthy();
      expect(typeof o.label).toBe('string');
    });
  });
});

describe('DS-7.4 Compressor — formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes < 1KB', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats KB range', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats MB range', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(5242880)).toBe('5.0 MB');
  });

  it('formats GB range', () => {
    expect(formatBytes(1073741824)).toBe('1.0 GB');
  });
});

describe('DS-7.4 Compressor — calcDimensions', () => {
  it('returns original when no limits', () => {
    expect(calcDimensions(800, 600, 0, 0)).toEqual({ w: 800, h: 600 });
  });

  it('scales down to maxWidth maintaining aspect ratio', () => {
    const result = calcDimensions(1000, 500, 500, 0);
    expect(result.w).toBe(500);
    expect(result.h).toBe(250);
  });

  it('scales down to maxHeight maintaining aspect ratio', () => {
    const result = calcDimensions(500, 1000, 0, 500);
    expect(result.w).toBe(250);
    expect(result.h).toBe(500);
  });

  it('respects both maxWidth and maxHeight', () => {
    // 1000x600, max 400x300 → width-limited first to 400x240, then height is 240<300, so 400x240
    const result = calcDimensions(1000, 600, 400, 300);
    expect(result.w).toBe(400);
    expect(result.h).toBe(240);
  });

  it('respects both limits when height is the binding constraint', () => {
    // 600x1000, max 400x300 → width-limited: 400x667 → height-limited: 180x300
    const result = calcDimensions(600, 1000, 400, 300);
    expect(result.h).toBe(300);
    expect(result.w).toBe(180);
  });

  it('does not scale up if image is smaller than limits', () => {
    const result = calcDimensions(200, 100, 500, 500);
    expect(result).toEqual({ w: 200, h: 100 });
  });
});

describe('DS-7.4 Compressor — module exports', () => {
  it('exports default CompressorModal component', async () => {
    const mod = await import('@/app/dashboard/tools/compressor-client');
    expect(mod.default).toBeDefined();
    expect(mod.default.name).toBe('CompressorModal');
  });
});
