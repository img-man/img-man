// SPDX-License-Identifier: Apache-2.0
/**
 * Activity Logger Engine — Tests
 * Sprint 13.1
 */

import { describe, it, expect } from 'vitest';
import {
  buildActivityEntry,
  generateDescription,
  generateEditDescription,
  buildActivityQuery,
  escapeRegex,
  aggregateByField,
  buildActivitySummary,
  exportToCsv,
  exportToJson,
  formatDate,
  csvEscape,
  relativeTime,
  groupByDate,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ACTION_LABELS,
  TARGET_TYPE_LABELS,
  ACTION_CATEGORIES,
} from '@/lib/activity-logger';

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-logger constants', () => {
  it('ACTION_LABELS covers all 20 action types', () => {
    expect(Object.keys(ACTION_LABELS)).toHaveLength(20);
  });

  it('TARGET_TYPE_LABELS covers all 7 target types', () => {
    expect(Object.keys(TARGET_TYPE_LABELS)).toHaveLength(7);
  });

  it('ACTION_CATEGORIES includes all actions at least once', () => {
    const allCategorised = Object.values(ACTION_CATEGORIES).flat();
    for (const action of Object.keys(ACTION_LABELS)) {
      expect(allCategorised).toContain(action);
    }
  });

  it('has sensible page size defaults', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
    expect(MAX_PAGE_SIZE).toBe(200);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  buildActivityEntry                                                    */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildActivityEntry', () => {
  const base = {
    orgId: 'org1',
    userId: 'user1',
    action: 'upload' as const,
    targetType: 'asset' as const,
    targetId: 'asset1',
  };

  it('returns valid entry with auto-generated description', () => {
    const { entry, valid } = buildActivityEntry(base);
    expect(valid).toBe(true);
    expect(entry.description).toBe('Uploaded asset');
  });

  it('preserves custom description', () => {
    const { entry, valid } = buildActivityEntry({
      ...base,
      description: 'Custom desc',
    });
    expect(valid).toBe(true);
    expect(entry.description).toBe('Custom desc');
  });

  it('rejects missing orgId', () => {
    const { valid, error } = buildActivityEntry({ ...base, orgId: '' });
    expect(valid).toBe(false);
    expect(error).toContain('orgId');
  });

  it('rejects missing userId', () => {
    const { valid, error } = buildActivityEntry({ ...base, userId: '' });
    expect(valid).toBe(false);
    expect(error).toContain('userId');
  });

  it('rejects missing action', () => {
    const { valid, error } = buildActivityEntry({
      ...base,
      action: '' as never,
    });
    expect(valid).toBe(false);
    expect(error).toContain('action');
  });

  it('rejects missing targetType', () => {
    const { valid, error } = buildActivityEntry({
      ...base,
      targetType: '' as never,
    });
    expect(valid).toBe(false);
    expect(error).toContain('targetType');
  });

  it('rejects missing targetId', () => {
    const { valid, error } = buildActivityEntry({ ...base, targetId: '' });
    expect(valid).toBe(false);
    expect(error).toContain('targetId');
  });

  it('defaults metadata, ip, and userAgent', () => {
    const { entry } = buildActivityEntry(base);
    expect(entry.metadata).toEqual({});
    expect(entry.ip).toBe('');
    expect(entry.userAgent).toBe('');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  generateDescription                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('generateDescription', () => {
  it('generates basic description', () => {
    expect(generateDescription('upload', 'asset')).toBe('Uploaded asset');
  });

  it('includes name from metadata', () => {
    expect(generateDescription('delete', 'folder', { name: 'Vacation' })).toBe(
      'Deleted folder "Vacation"',
    );
  });

  it('uses fileName fallback', () => {
    expect(
      generateDescription('edit', 'asset', { fileName: 'photo.jpg' }),
    ).toBe('Edited asset "photo.jpg"');
  });

  it('uses title fallback', () => {
    expect(
      generateDescription('create_design', 'design', { title: 'Logo v2' }),
    ).toBe('Created design design "Logo v2"');
  });
});

describe('generateEditDescription', () => {
  it('generates description with changes', () => {
    const result = generateEditDescription('rename', 'asset', [
      { field: 'name', oldValue: 'old.jpg', newValue: 'new.jpg' },
    ]);
    expect(result).toContain('old.jpg');
    expect(result).toContain('new.jpg');
  });

  it('handles set-to description', () => {
    const result = generateEditDescription('tag', 'asset', [
      { field: 'tags', newValue: 'sunset' },
    ]);
    expect(result).toContain('set to "sunset"');
  });

  it('handles cleared description', () => {
    const result = generateEditDescription('edit', 'asset', [
      { field: 'description' },
    ]);
    expect(result).toContain('cleared');
  });

  it('returns base description for empty changes', () => {
    const result = generateEditDescription('edit', 'asset', []);
    expect(result).toBe('Edited asset');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  buildActivityQuery                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildActivityQuery', () => {
  it('builds basic query with orgId', () => {
    const result = buildActivityQuery({ orgId: 'org1' });
    expect(result.filter.orgId).toBe('org1');
    expect(result.sort).toEqual({ createdAt: -1 });
    expect(result.skip).toBe(0);
    expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  it('adds userId filter', () => {
    const result = buildActivityQuery({ orgId: 'org1', userId: 'user1' });
    expect(result.filter.userId).toBe('user1');
  });

  it('adds actions filter', () => {
    const result = buildActivityQuery({
      orgId: 'org1',
      actions: ['upload', 'delete'],
    });
    expect(result.filter.action).toEqual({ $in: ['upload', 'delete'] });
  });

  it('adds target types filter', () => {
    const result = buildActivityQuery({
      orgId: 'org1',
      targetTypes: ['asset', 'folder'],
    });
    expect(result.filter.targetType).toEqual({ $in: ['asset', 'folder'] });
  });

  it('adds targetId filter', () => {
    const result = buildActivityQuery({
      orgId: 'org1',
      targetId: 'asset-123',
    });
    expect(result.filter.targetId).toBe('asset-123');
  });

  it('adds date range filter', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    const result = buildActivityQuery({
      orgId: 'org1',
      startDate: start,
      endDate: end,
    });
    expect(result.filter.createdAt).toEqual({ $gte: start, $lte: end });
  });

  it('adds search filter with escaped regex', () => {
    const result = buildActivityQuery({
      orgId: 'org1',
      search: 'photo.jpg',
    });
    expect(result.filter.description).toEqual({
      $regex: 'photo\\.jpg',
      $options: 'i',
    });
  });

  it('paginates correctly', () => {
    const result = buildActivityQuery(
      { orgId: 'org1' },
      { page: 3, limit: 20 },
    );
    expect(result.skip).toBe(40);
    expect(result.limit).toBe(20);
  });

  it('clamps limit to MAX_PAGE_SIZE', () => {
    const result = buildActivityQuery(
      { orgId: 'org1' },
      { page: 1, limit: 9999 },
    );
    expect(result.limit).toBe(MAX_PAGE_SIZE);
  });

  it('supports ascending sort', () => {
    const result = buildActivityQuery(
      { orgId: 'org1' },
      { page: 1, limit: 10, sortOrder: 'asc' },
    );
    expect(result.sort).toEqual({ createdAt: 1 });
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  escapeRegex                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('escapeRegex', () => {
  it('escapes special characters', () => {
    expect(escapeRegex('file.jpg')).toBe('file\\.jpg');
    expect(escapeRegex('a*b+c?')).toBe('a\\*b\\+c\\?');
    expect(escapeRegex('[test]')).toBe('\\[test\\]');
  });

  it('leaves plain strings unchanged', () => {
    expect(escapeRegex('hello')).toBe('hello');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Aggregation                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('aggregateByField', () => {
  it('groups and counts by field', () => {
    const items = [{ type: 'upload' }, { type: 'upload' }, { type: 'delete' }];
    const result = aggregateByField(items, (i) => i.type);
    expect(result[0]).toEqual({ key: 'upload', count: 2, percentage: 66.67 });
    expect(result[1]).toEqual({ key: 'delete', count: 1, percentage: 33.33 });
  });

  it('returns empty array for empty input', () => {
    expect(aggregateByField([], () => '')).toEqual([]);
  });
});

describe('buildActivitySummary', () => {
  it('builds summary from entries', () => {
    const entries = [
      {
        action: 'upload',
        targetType: 'asset',
        userId: 'u1',
        createdAt: new Date('2024-01-01'),
      },
      {
        action: 'upload',
        targetType: 'asset',
        userId: 'u2',
        createdAt: new Date('2024-01-02'),
      },
      {
        action: 'delete',
        targetType: 'folder',
        userId: 'u1',
        createdAt: new Date('2024-01-03'),
      },
    ];
    const summary = buildActivitySummary(entries);
    expect(summary.totalActions).toBe(3);
    expect(summary.uniqueUsers).toBe(2);
    expect(summary.byAction).toHaveLength(2);
    expect(summary.byTargetType).toHaveLength(2);
    expect(summary.dateRange?.start).toEqual(new Date('2024-01-01'));
    expect(summary.dateRange?.end).toEqual(new Date('2024-01-03'));
  });

  it('handles empty entries', () => {
    const summary = buildActivitySummary([]);
    expect(summary.totalActions).toBe(0);
    expect(summary.uniqueUsers).toBe(0);
    expect(summary.dateRange).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Export                                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('exportToCsv', () => {
  const entries = [
    {
      createdAt: new Date('2024-06-15T10:30:00Z'),
      userId: 'u1',
      action: 'upload',
      targetType: 'asset',
      targetId: 'a1',
      description: 'Uploaded photo.jpg',
      ip: '1.2.3.4',
      userAgent: 'Chrome',
    },
  ];

  it('generates CSV with header and data rows', () => {
    const csv = exportToCsv(entries);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Timestamp');
    expect(lines[1]).toContain('2024-06-15');
    expect(lines[1]).toContain('upload');
  });

  it('uses userMap for display names', () => {
    const userMap = new Map([['u1', 'Alice']]);
    const csv = exportToCsv(entries, userMap);
    expect(csv).toContain('Alice');
  });
});

describe('exportToJson', () => {
  it('returns structured export rows', () => {
    const entries = [
      {
        createdAt: new Date('2024-06-15T10:30:00Z'),
        userId: 'u1',
        action: 'upload',
        targetType: 'asset',
        targetId: 'a1',
        description: 'desc',
        ip: '',
        userAgent: '',
      },
    ];
    const result = exportToJson(entries);
    expect(result[0].action).toBe('upload');
    expect(result[0].user).toBe('u1');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Date / String Helpers                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('formatDate', () => {
  it('formats date as YYYY-MM-DD HH:mm:ss', () => {
    const d = new Date('2024-03-15T14:30:45Z');
    expect(formatDate(d)).toBe('2024-03-15 14:30:45');
  });
});

describe('csvEscape', () => {
  it('wraps values with commas in quotes', () => {
    expect(csvEscape('hello, world')).toBe('"hello, world"');
  });

  it('escapes internal quotes', () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""');
  });

  it('leaves plain strings unchanged', () => {
    expect(csvEscape('hello')).toBe('hello');
  });
});

describe('relativeTime', () => {
  const now = new Date('2024-06-15T12:00:00Z');

  it('returns "just now" for < 60s', () => {
    const date = new Date('2024-06-15T11:59:30Z');
    expect(relativeTime(date, now)).toBe('just now');
  });

  it('returns minutes', () => {
    const date = new Date('2024-06-15T11:45:00Z');
    expect(relativeTime(date, now)).toBe('15 minutes ago');
  });

  it('returns hours', () => {
    const date = new Date('2024-06-15T09:00:00Z');
    expect(relativeTime(date, now)).toBe('3 hours ago');
  });

  it('returns days', () => {
    const date = new Date('2024-06-10T12:00:00Z');
    expect(relativeTime(date, now)).toBe('5 days ago');
  });

  it('returns months', () => {
    const date = new Date('2024-03-15T12:00:00Z');
    expect(relativeTime(date, now)).toBe('3 months ago');
  });

  it('returns years', () => {
    const date = new Date('2022-06-15T12:00:00Z');
    expect(relativeTime(date, now)).toBe('2 years ago');
  });

  it('handles singular forms', () => {
    const date1 = new Date('2024-06-15T11:59:00Z');
    expect(relativeTime(date1, now)).toBe('1 minute ago');
    const date2 = new Date('2024-06-15T11:00:00Z');
    expect(relativeTime(date2, now)).toBe('1 hour ago');
    const date3 = new Date('2024-06-14T12:00:00Z');
    expect(relativeTime(date3, now)).toBe('1 day ago');
  });
});

describe('groupByDate', () => {
  it('groups entries by YYYY-MM-DD', () => {
    const entries = [
      { createdAt: new Date('2024-06-15T10:00:00Z'), id: 1 },
      { createdAt: new Date('2024-06-15T14:00:00Z'), id: 2 },
      { createdAt: new Date('2024-06-16T08:00:00Z'), id: 3 },
    ];
    const grouped = groupByDate(entries);
    expect(grouped.get('2024-06-15')).toHaveLength(2);
    expect(grouped.get('2024-06-16')).toHaveLength(1);
  });
});
