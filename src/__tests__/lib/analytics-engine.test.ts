// SPDX-License-Identifier: Apache-2.0
/**
 * Analytics Dashboard Engine — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateBandwidthTimeSeries,
  storageByCategory,
  storageByFolder,
  aiCreditsByJobType,
  aiCreditsTimeSeries,
  topAssetsByBandwidth,
  buildActivityHeatmap,
  peakActivityHour,
  computeGrowth,
  computeGrowthBatch,
  buildDashboardSummary,
  resolveDateRange,
  filterByDateRange,
  formatBytes,
  formatNumber,
  DAY_LABELS,
  TREND_CONFIG,
  type RawBandwidthRecord,
  type RawAssetRecord,
  type RawAiJobRecord,
  type RawAccessRecord,
  type RawActivityTimestamp,
} from '@/lib/analytics-engine';

/* ─── Factories ──────────────────────────────────────────────── */

function makeBwRecord(date: string, total = 1000): RawBandwidthRecord {
  return {
    date: new Date(date),
    uploadBytes: total * 0.3,
    downloadBytes: total * 0.4,
    transformBytes: total * 0.2,
    cdnBytes: total * 0.1,
    totalBytes: total,
    requestCount: 5,
  };
}

function makeAsset(overrides: Partial<RawAssetRecord> = {}): RawAssetRecord {
  return {
    fileSize: overrides.fileSize ?? 1024,
    fileCategory: overrides.fileCategory,
    mimeType: overrides.mimeType ?? 'image/png',
    folderId: overrides.folderId,
    folderName: overrides.folderName,
  };
}

function makeAiJob(overrides: Partial<RawAiJobRecord> = {}): RawAiJobRecord {
  return {
    type: overrides.type ?? 'bg_remove',
    creditCost: overrides.creditCost ?? 2,
    status: overrides.status ?? 'completed',
    createdAt: overrides.createdAt ?? new Date('2025-06-15T10:00:00Z'),
  };
}

function makeAccess(overrides: Partial<RawAccessRecord> = {}): RawAccessRecord {
  return {
    assetId: overrides.assetId ?? 'a1',
    assetName: overrides.assetName ?? 'photo.png',
    bytes: overrides.bytes ?? 5000,
    accessType: overrides.accessType ?? 'view',
    timestamp: overrides.timestamp ?? new Date('2025-06-15T10:00:00Z'),
  };
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Bandwidth Time-Series                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('aggregateBandwidthTimeSeries', () => {
  it('groups daily records correctly', () => {
    const records = [
      makeBwRecord('2025-06-15', 1000),
      makeBwRecord('2025-06-15', 2000),
      makeBwRecord('2025-06-16', 500),
    ];
    const result = aggregateBandwidthTimeSeries(records, 'daily');
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2025-06-15');
    expect(result[0].totalBytes).toBe(3000);
    expect(result[1].totalBytes).toBe(500);
  });

  it('aggregates by month', () => {
    const records = [
      makeBwRecord('2025-06-01', 100),
      makeBwRecord('2025-06-20', 200),
      makeBwRecord('2025-07-05', 300),
    ];
    const result = aggregateBandwidthTimeSeries(records, 'monthly');
    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2025-06');
    expect(result[0].totalBytes).toBe(300);
  });

  it('aggregates by week', () => {
    const records = [
      makeBwRecord('2025-06-09', 100), // week 24
      makeBwRecord('2025-06-10', 200), // week 24
      makeBwRecord('2025-06-16', 300), // week 25
    ];
    const result = aggregateBandwidthTimeSeries(records, 'weekly');
    expect(result).toHaveLength(2);
  });

  it('returns empty for no records', () => {
    expect(aggregateBandwidthTimeSeries([])).toEqual([]);
  });

  it('sorts by date ascending', () => {
    const records = [
      makeBwRecord('2025-06-20', 100),
      makeBwRecord('2025-06-10', 200),
    ];
    const result = aggregateBandwidthTimeSeries(records, 'daily');
    expect(result[0].date).toBe('2025-06-10');
    expect(result[1].date).toBe('2025-06-20');
  });

  it('sums request counts', () => {
    const records = [
      makeBwRecord('2025-06-15', 100),
      makeBwRecord('2025-06-15', 200),
    ];
    const result = aggregateBandwidthTimeSeries(records, 'daily');
    expect(result[0].requestCount).toBe(10);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Storage Breakdown                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('storageByCategory', () => {
  it('groups by file category', () => {
    const assets = [
      makeAsset({ fileCategory: 'Images', fileSize: 1000 }),
      makeAsset({ fileCategory: 'Images', fileSize: 2000 }),
      makeAsset({ fileCategory: 'PDFs', fileSize: 500 }),
    ];
    const result = storageByCategory(assets);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Images');
    expect(result[0].bytes).toBe(3000);
    expect(result[0].count).toBe(2);
  });

  it('categorises by MIME type when fileCategory is missing', () => {
    const assets = [
      makeAsset({ mimeType: 'image/jpeg', fileSize: 100, fileCategory: undefined }),
      makeAsset({ mimeType: 'application/pdf', fileSize: 200, fileCategory: undefined }),
      makeAsset({ mimeType: 'video/mp4', fileSize: 300, fileCategory: undefined }),
    ];
    const result = storageByCategory(assets);
    const labels = result.map((b) => b.label);
    expect(labels).toContain('Images');
    expect(labels).toContain('PDFs');
    expect(labels).toContain('Videos');
  });

  it('computes percentages that sum to ~100', () => {
    const assets = [
      makeAsset({ fileSize: 700 }),
      makeAsset({ fileSize: 300, mimeType: 'application/pdf' }),
    ];
    const result = storageByCategory(assets);
    const totalPct = result.reduce((s, b) => s + b.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });

  it('returns empty for no assets', () => {
    expect(storageByCategory([])).toEqual([]);
  });

  it('sorts by bytes descending', () => {
    const assets = [
      makeAsset({ fileSize: 100, mimeType: 'audio/mp3' }),
      makeAsset({ fileSize: 9000, mimeType: 'image/png' }),
    ];
    const result = storageByCategory(assets);
    expect(result[0].bytes).toBeGreaterThan(result[1].bytes);
  });
});

describe('storageByFolder', () => {
  it('groups by folder name', () => {
    const assets = [
      makeAsset({ folderName: 'Photos', fileSize: 500 }),
      makeAsset({ folderName: 'Photos', fileSize: 300 }),
      makeAsset({ folderName: 'Documents', fileSize: 200 }),
    ];
    const result = storageByFolder(assets);
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Photos');
  });

  it('uses "Root" when no folder info', () => {
    const assets = [makeAsset({ fileSize: 100 })];
    const result = storageByFolder(assets);
    expect(result[0].label).toBe('Root');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  AI Credits                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('aiCreditsByJobType', () => {
  it('aggregates credits by job type', () => {
    const jobs = [
      makeAiJob({ type: 'bg_remove', creditCost: 2, status: 'completed' }),
      makeAiJob({ type: 'bg_remove', creditCost: 2, status: 'failed' }),
      makeAiJob({ type: 'upscale', creditCost: 3, status: 'completed' }),
    ];
    const result = aiCreditsByJobType(jobs);
    expect(result).toHaveLength(2);

    const bgRemove = result.find((b) => b.jobType === 'bg_remove');
    expect(bgRemove?.totalCredits).toBe(4);
    expect(bgRemove?.successCount).toBe(1);
    expect(bgRemove?.failureCount).toBe(1);
    expect(bgRemove?.avgCreditsPerJob).toBe(2);
  });

  it('sorts by totalCredits descending', () => {
    const jobs = [
      makeAiJob({ type: 'upscale', creditCost: 1 }),
      makeAiJob({ type: 'generate', creditCost: 10 }),
    ];
    const result = aiCreditsByJobType(jobs);
    expect(result[0].jobType).toBe('generate');
  });

  it('returns empty for no jobs', () => {
    expect(aiCreditsByJobType([])).toEqual([]);
  });
});

describe('aiCreditsTimeSeries', () => {
  it('groups credits by day', () => {
    const jobs = [
      makeAiJob({ creditCost: 2, createdAt: new Date('2025-06-15T10:00:00Z') }),
      makeAiJob({ creditCost: 3, createdAt: new Date('2025-06-15T14:00:00Z') }),
      makeAiJob({ creditCost: 1, createdAt: new Date('2025-06-16T08:00:00Z') }),
    ];
    const result = aiCreditsTimeSeries(jobs);
    expect(result).toHaveLength(2);
    expect(result[0].credits).toBe(5);
    expect(result[0].jobCount).toBe(2);
  });

  it('sorts by date ascending', () => {
    const jobs = [
      makeAiJob({ createdAt: new Date('2025-06-20T00:00:00Z') }),
      makeAiJob({ createdAt: new Date('2025-06-10T00:00:00Z') }),
    ];
    const result = aiCreditsTimeSeries(jobs);
    expect(result[0].date).toBe('2025-06-10');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Top Assets                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('topAssetsByBandwidth', () => {
  it('ranks assets by total bytes', () => {
    const records = [
      makeAccess({ assetId: 'a1', bytes: 100 }),
      makeAccess({ assetId: 'a1', bytes: 200 }),
      makeAccess({ assetId: 'a2', bytes: 500 }),
    ];
    const result = topAssetsByBandwidth(records);
    expect(result[0].assetId).toBe('a2');
    expect(result[0].totalBytes).toBe(500);
    expect(result[1].totalBytes).toBe(300);
  });

  it('limits results to N', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      makeAccess({ assetId: `a${i}`, bytes: i * 100 }),
    );
    const result = topAssetsByBandwidth(records, 5);
    expect(result).toHaveLength(5);
  });

  it('counts view and download separately', () => {
    const records = [
      makeAccess({ assetId: 'a1', accessType: 'view' }),
      makeAccess({ assetId: 'a1', accessType: 'download' }),
      makeAccess({ assetId: 'a1', accessType: 'view' }),
    ];
    const result = topAssetsByBandwidth(records);
    expect(result[0].viewCount).toBe(2);
    expect(result[0].downloadCount).toBe(1);
    expect(result[0].accessCount).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Activity Heatmap                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildActivityHeatmap', () => {
  it('builds 168 cells (24h × 7d)', () => {
    const heatmap = buildActivityHeatmap([]);
    expect(heatmap).toHaveLength(168);
  });

  it('counts activity in correct cell', () => {
    // Sunday at 10:00 UTC
    const entries: RawActivityTimestamp[] = [
      { createdAt: new Date('2025-06-15T10:00:00Z') }, // Sunday
      { createdAt: new Date('2025-06-15T10:30:00Z') }, // Sunday
    ];
    const heatmap = buildActivityHeatmap(entries);
    const sundayAt10 = heatmap.find((c) => c.dayOfWeek === 0 && c.hour === 10);
    expect(sundayAt10?.count).toBe(2);
  });

  it('all cells start at 0 for empty input', () => {
    const heatmap = buildActivityHeatmap([]);
    expect(heatmap.every((c) => c.count === 0)).toBe(true);
  });
});

describe('peakActivityHour', () => {
  it('finds the cell with highest count', () => {
    const entries: RawActivityTimestamp[] = Array.from({ length: 10 }, () => ({
      createdAt: new Date('2025-06-15T14:00:00Z'), // Sunday 14:00
    }));
    const heatmap = buildActivityHeatmap(entries);
    const peak = peakActivityHour(heatmap);
    expect(peak?.hour).toBe(14);
    expect(peak?.count).toBe(10);
  });

  it('returns null for empty heatmap', () => {
    expect(peakActivityHour([])).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Growth & Trends                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('computeGrowth', () => {
  it('computes positive growth', () => {
    const g = computeGrowth('Bandwidth', 200, 100);
    expect(g.change).toBe(100);
    expect(g.changePercent).toBe(100);
    expect(g.trend).toBe('up');
  });

  it('computes negative growth', () => {
    const g = computeGrowth('Downloads', 50, 100);
    expect(g.change).toBe(-50);
    expect(g.changePercent).toBe(-50);
    expect(g.trend).toBe('down');
  });

  it('detects flat trend', () => {
    const g = computeGrowth('Storage', 100, 100);
    expect(g.trend).toBe('flat');
    expect(g.changePercent).toBe(0);
  });

  it('handles zero previous value', () => {
    const g = computeGrowth('New', 100, 0);
    expect(g.changePercent).toBe(100);
    expect(g.trend).toBe('up');
  });

  it('handles both zero', () => {
    const g = computeGrowth('Empty', 0, 0);
    expect(g.trend).toBe('flat');
    expect(g.changePercent).toBe(0);
  });
});

describe('computeGrowthBatch', () => {
  it('computes multiple metrics at once', () => {
    const result = computeGrowthBatch([
      { label: 'A', current: 200, previous: 100 },
      { label: 'B', current: 50, previous: 100 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].trend).toBe('up');
    expect(result[1].trend).toBe('down');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Dashboard Summary                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildDashboardSummary', () => {
  it('builds a complete summary', () => {
    const summary = buildDashboardSummary({
      bandwidthRecords: [makeBwRecord('2025-06-15', 5000)],
      assets: [makeAsset({ fileSize: 2048 }), makeAsset({ fileSize: 1024 })],
      aiJobs: [makeAiJob({ creditCost: 5 })],
      accessRecords: [makeAccess({ bytes: 3000 })],
      activityTimestamps: [{ createdAt: new Date() }],
    });

    expect(summary.bandwidth.totalBytes).toBe(5000);
    expect(summary.storage.totalBytes).toBe(3072);
    expect(summary.storage.totalCount).toBe(2);
    expect(summary.aiCredits.totalCredits).toBe(5);
    expect(summary.aiCredits.totalJobs).toBe(1);
    expect(summary.topAssets).toHaveLength(1);
    expect(summary.activityHeatmap).toHaveLength(168);
  });

  it('handles all empty inputs', () => {
    const summary = buildDashboardSummary({
      bandwidthRecords: [],
      assets: [],
      aiJobs: [],
      accessRecords: [],
      activityTimestamps: [],
    });
    expect(summary.bandwidth.totalBytes).toBe(0);
    expect(summary.storage.totalCount).toBe(0);
    expect(summary.aiCredits.totalJobs).toBe(0);
    expect(summary.topAssets).toHaveLength(0);
    expect(summary.peakHour).toBeDefined(); // peak of empty heatmap
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Date Range                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('resolveDateRange', () => {
  it('resolves 7d preset', () => {
    const { start, end } = resolveDateRange('7d');
    const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThanOrEqual(7);
    expect(diffDays).toBeLessThan(9);
  });

  it('resolves 30d preset', () => {
    const { start, end } = resolveDateRange('30d');
    const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThanOrEqual(30);
    expect(diffDays).toBeLessThan(32);
  });

  it('resolves 90d preset', () => {
    const { start, end } = resolveDateRange('90d');
    const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
    expect(diffDays).toBeGreaterThanOrEqual(90);
    expect(diffDays).toBeLessThan(92);
  });

  it('resolves custom range', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-03-01');
    const result = resolveDateRange('custom', start, end);
    expect(result.start).toEqual(start);
    expect(result.end).toEqual(end);
  });

  it('defaults custom range to 30d when no dates given', () => {
    const { start, end } = resolveDateRange('custom');
    const diffDays = (end.getTime() - start.getTime()) / 86_400_000;
    expect(diffDays).toBeCloseTo(30, 0);
  });
});

describe('filterByDateRange', () => {
  it('filters records within range', () => {
    const records = [
      { date: new Date('2025-06-01'), value: 1 },
      { date: new Date('2025-06-15'), value: 2 },
      { date: new Date('2025-07-01'), value: 3 },
    ];
    const result = filterByDateRange(
      records,
      new Date('2025-06-10'),
      new Date('2025-06-20'),
    );
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(2);
  });

  it('handles string dates', () => {
    const records = [
      { date: '2025-06-15', value: 1 },
      { date: '2025-07-15', value: 2 },
    ];
    const result = filterByDateRange(
      records,
      new Date('2025-06-01'),
      new Date('2025-06-30'),
    );
    expect(result).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Utility                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('formatBytes', () => {
  it('formats 0', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats KB', () => {
    expect(formatBytes(2048)).toBe('2.00 KB');
  });

  it('formats MB', () => {
    const mb = 1024 * 1024 * 3;
    expect(formatBytes(mb)).toContain('MB');
  });

  it('formats GB', () => {
    const gb = 1024 * 1024 * 1024 * 1.5;
    expect(formatBytes(gb)).toContain('GB');
  });
});

describe('formatNumber', () => {
  it('formats small numbers as-is', () => {
    expect(formatNumber(42)).toBe('42');
  });

  it('formats thousands with K suffix', () => {
    expect(formatNumber(1500)).toBe('1.5K');
  });

  it('formats millions with M suffix', () => {
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });

  it('formats billions with B suffix', () => {
    expect(formatNumber(1_200_000_000)).toBe('1.2B');
  });
});

describe('constants', () => {
  it('DAY_LABELS has 7 entries', () => {
    expect(DAY_LABELS).toHaveLength(7);
    expect(DAY_LABELS[0]).toBe('Sun');
  });

  it('TREND_CONFIG covers up/down/flat', () => {
    expect(TREND_CONFIG.up.arrow).toBe('↑');
    expect(TREND_CONFIG.down.arrow).toBe('↓');
    expect(TREND_CONFIG.flat.arrow).toBe('→');
  });
});
