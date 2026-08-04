// SPDX-License-Identifier: Apache-2.0
/**
 * Inline Preview Components Tests (CsvViewer, AudioPlayer)
 *
 * Tests for:
 * - CsvViewer: component exports, parsing logic, sort/search/pagination
 * - AudioPlayer: component exports, time formatting, controls
 * - Asset drawer MIME routing for CSV and Audio
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ──────────────────────────────────────────────────────────
 * 1. CsvViewer Component Tests
 * ────────────────────────────────────────────────────────── */

describe('CsvViewer Component', () => {
  it('exports CsvViewer as named export', async () => {
    const mod = await import('@/components/dashboard/csv-viewer');
    expect(mod.CsvViewer).toBeDefined();
    expect(typeof mod.CsvViewer).toBe('function');
  });

  it('exports CsvViewer as default export', async () => {
    const mod = await import('@/components/dashboard/csv-viewer');
    expect(mod.default).toBeDefined();
    expect(mod.default).toBe(mod.CsvViewer);
  });
});

describe('CsvViewer — PapaParse integration', () => {
  it('papaparse is available and can parse CSV strings', async () => {
    const Papa = (await import('papaparse')).default;
    expect(Papa).toBeDefined();
    expect(typeof Papa.parse).toBe('function');

    const result = Papa.parse('name,age,city\nAlice,30,NYC\nBob,25,SF', {
      header: false,
      skipEmptyLines: true,
    });

    expect(result.data).toHaveLength(3); // header + 2 rows
    expect(result.data[0]).toEqual(['name', 'age', 'city']);
    expect(result.data[1]).toEqual(['Alice', '30', 'NYC']);
    expect(result.data[2]).toEqual(['Bob', '25', 'SF']);
  });

  it('handles empty CSV gracefully', async () => {
    const Papa = (await import('papaparse')).default;
    const result = Papa.parse('', { header: false, skipEmptyLines: true });
    expect(result.data).toHaveLength(0);
  });

  it('handles CSV with only headers', async () => {
    const Papa = (await import('papaparse')).default;
    const result = Papa.parse('name,age,city\n', {
      header: false,
      skipEmptyLines: true,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(['name', 'age', 'city']);
  });

  it('handles CSV with special characters (quotes, commas)', async () => {
    const Papa = (await import('papaparse')).default;
    const result = Papa.parse(
      'name,description\n"Smith, John","A ""great"" person"\nBob,simple',
      { header: false, skipEmptyLines: true },
    );
    expect(result.data).toHaveLength(3);
    expect(result.data[1]).toEqual(['Smith, John', 'A "great" person']);
  });

  it('supports preview option to limit rows', async () => {
    const Papa = (await import('papaparse')).default;
    const csv =
      'h1,h2\n' +
      Array.from({ length: 100 }, (_, i) => `a${i},b${i}`).join('\n');
    const result = Papa.parse(csv, {
      header: false,
      skipEmptyLines: true,
      preview: 11, // header + 10 rows
    });
    expect(result.data.length).toBeLessThanOrEqual(11);
  });
});

/* ──────────────────────────────────────────────────────────
 * 2. AudioPlayer Component Tests
 * ────────────────────────────────────────────────────────── */

describe('AudioPlayer Component', () => {
  it('exports AudioPlayer as named export', async () => {
    const mod = await import('@/components/dashboard/audio-player');
    expect(mod.AudioPlayer).toBeDefined();
    expect(typeof mod.AudioPlayer).toBe('function');
  });

  it('exports AudioPlayer as default export', async () => {
    const mod = await import('@/components/dashboard/audio-player');
    expect(mod.default).toBeDefined();
    expect(mod.default).toBe(mod.AudioPlayer);
  });
});

/* ──────────────────────────────────────────────────────────
 * 3. Audio Player — Time Formatter (internal logic)
 * ────────────────────────────────────────────────────────── */

describe('Audio/Video time formatting', () => {
  // We test the same pattern used in both video-player and audio-player
  function fmtTime(secs: number): string {
    if (!isFinite(secs) || secs < 0) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0)
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  it('formats 0 seconds', () => {
    expect(fmtTime(0)).toBe('0:00');
  });

  it('formats seconds under a minute', () => {
    expect(fmtTime(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(fmtTime(125)).toBe('2:05');
  });

  it('formats hours', () => {
    expect(fmtTime(3661)).toBe('1:01:01');
  });

  it('handles NaN', () => {
    expect(fmtTime(NaN)).toBe('0:00');
  });

  it('handles Infinity', () => {
    expect(fmtTime(Infinity)).toBe('0:00');
  });

  it('handles negative numbers', () => {
    expect(fmtTime(-10)).toBe('0:00');
  });
});

/* ──────────────────────────────────────────────────────────
 * 4. CSV Sort Logic
 * ────────────────────────────────────────────────────────── */

describe('CSV sort logic', () => {
  const rows = [
    ['Alice', '30', 'NYC'],
    ['Charlie', '25', 'LA'],
    ['Bob', '40', 'SF'],
  ];

  function sortRows(
    data: string[][],
    col: number,
    dir: 'asc' | 'desc',
  ): string[][] {
    const d = dir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = a[col] ?? '';
      const vb = b[col] ?? '';
      const na = Number(va);
      const nb = Number(vb);
      if (!isNaN(na) && !isNaN(nb)) return (na - nb) * d;
      return va.localeCompare(vb) * d;
    });
  }

  it('sorts alphabetically ascending', () => {
    const sorted = sortRows(rows, 0, 'asc');
    expect(sorted[0][0]).toBe('Alice');
    expect(sorted[1][0]).toBe('Bob');
    expect(sorted[2][0]).toBe('Charlie');
  });

  it('sorts alphabetically descending', () => {
    const sorted = sortRows(rows, 0, 'desc');
    expect(sorted[0][0]).toBe('Charlie');
    expect(sorted[2][0]).toBe('Alice');
  });

  it('sorts numerically ascending', () => {
    const sorted = sortRows(rows, 1, 'asc');
    expect(sorted[0][1]).toBe('25');
    expect(sorted[1][1]).toBe('30');
    expect(sorted[2][1]).toBe('40');
  });

  it('sorts numerically descending', () => {
    const sorted = sortRows(rows, 1, 'desc');
    expect(sorted[0][1]).toBe('40');
    expect(sorted[2][1]).toBe('25');
  });
});

/* ──────────────────────────────────────────────────────────
 * 5. CSV Search/Filter Logic
 * ────────────────────────────────────────────────────────── */

describe('CSV search filter logic', () => {
  const rows = [
    ['Alice', '30', 'New York'],
    ['Bob', '25', 'San Francisco'],
    ['Charlie', '40', 'Los Angeles'],
  ];

  function filterRows(data: string[][], query: string): string[][] {
    if (!query.trim()) return data;
    const q = query.toLowerCase();
    return data.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(q)),
    );
  }

  it('returns all rows when search is empty', () => {
    expect(filterRows(rows, '')).toHaveLength(3);
    expect(filterRows(rows, '  ')).toHaveLength(3);
  });

  it('filters by name', () => {
    const result = filterRows(rows, 'alice');
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('Alice');
  });

  it('filters by city (partial match)', () => {
    const result = filterRows(rows, 'san');
    expect(result).toHaveLength(1);
    expect(result[0][2]).toBe('San Francisco');
  });

  it('filters by numeric value', () => {
    const result = filterRows(rows, '40');
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('Charlie');
  });

  it('returns empty when no match', () => {
    expect(filterRows(rows, 'xyz')).toHaveLength(0);
  });

  it('is case-insensitive', () => {
    expect(filterRows(rows, 'BOB')).toHaveLength(1);
  });
});

/* ──────────────────────────────────────────────────────────
 * 6. CSV Pagination Logic
 * ────────────────────────────────────────────────────────── */

describe('CSV pagination logic', () => {
  const PAGE_SIZE = 50;
  const rows = Array.from({ length: 123 }, (_, i) => [`row${i}`]);

  it('calculates correct total pages', () => {
    const totalPages = Math.ceil(rows.length / PAGE_SIZE);
    expect(totalPages).toBe(3);
  });

  it('first page has PAGE_SIZE rows', () => {
    const pageRows = rows.slice(0, PAGE_SIZE);
    expect(pageRows).toHaveLength(50);
  });

  it('last page has remaining rows', () => {
    const lastPage = 2;
    const pageRows = rows.slice(
      lastPage * PAGE_SIZE,
      (lastPage + 1) * PAGE_SIZE,
    );
    expect(pageRows).toHaveLength(23);
  });
});

/* ──────────────────────────────────────────────────────────
 * 7. Asset Drawer CSV/Audio MIME Routing
 * ────────────────────────────────────────────────────────── */

describe('Asset drawer MIME routing coverage', () => {
  it('text/csv is recognized by getFileTypeInfo', async () => {
    const { getFileTypeInfo } = await import('@/lib/file-types');
    const info = getFileTypeInfo('text/csv');
    expect(info).toBeDefined();
    expect(info?.label).toBeTruthy();
  });

  it('audio/* is recognized by getFileTypeInfo', async () => {
    const { getFileTypeInfo } = await import('@/lib/file-types');
    const mp3 = getFileTypeInfo('audio/mpeg');
    expect(mp3).toBeDefined();
    expect(mp3?.label).toBe('Audio');
  });

  it('getFileCategory returns correct category for csv', async () => {
    const { getFileCategory } = await import('@/lib/file-types');
    expect(getFileCategory('text/csv')).toBe('document');
  });

  it('getFileCategory returns correct category for audio', async () => {
    const { getFileCategory } = await import('@/lib/file-types');
    expect(getFileCategory('audio/mpeg')).toBe('audio');
    expect(getFileCategory('audio/wav')).toBe('audio');
    expect(getFileCategory('audio/ogg')).toBe('audio');
  });
});

/* ──────────────────────────────────────────────────────────
 * 8. Waveform Data Generation
 * ────────────────────────────────────────────────────────── */

describe('Audio waveform data generation', () => {
  const WAVEFORM_BARS = 48;

  function generateWaveform(fileName: string): number[] {
    const bars: number[] = [];
    let seed = 0;
    for (let i = 0; i < fileName.length; i++) seed += fileName.charCodeAt(i);
    for (let i = 0; i < WAVEFORM_BARS; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = (seed / 0x7fffffff) * 0.6 + 0.2;
      bars.push(v);
    }
    return bars;
  }

  it('generates correct number of bars', () => {
    expect(generateWaveform('test.mp3')).toHaveLength(WAVEFORM_BARS);
  });

  it('all bars are within 0.2-0.8 range', () => {
    const bars = generateWaveform('song.wav');
    bars.forEach((bar) => {
      expect(bar).toBeGreaterThanOrEqual(0.2);
      expect(bar).toBeLessThanOrEqual(0.8);
    });
  });

  it('same file name produces same waveform (deterministic)', () => {
    const a = generateWaveform('podcast.mp3');
    const b = generateWaveform('podcast.mp3');
    expect(a).toEqual(b);
  });

  it('different file names produce different waveforms', () => {
    const a = generateWaveform('song-a.mp3');
    const b = generateWaveform('song-b.mp3');
    expect(a).not.toEqual(b);
  });
});
