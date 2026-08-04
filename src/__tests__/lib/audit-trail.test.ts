// SPDX-License-Identifier: Apache-2.0
/**
 * Audit Trail Query Engine — Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildTimeline,
  formatDateKey,
  formatDateLabel,
  buildUserDigest,
  buildAllUserDigests,
  buildTargetHistory,
  computeUserRiskScore,
  classifyRiskLevel,
  detectRiskFlags,
  createRetentionPolicy,
  validateRetentionDays,
  findExpiredEntries,
  paginateEntries,
  filterEntries,
  countDistinct,
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  RISK_THRESHOLDS,
  DESTRUCTIVE_ACTIONS,
  SENSITIVE_ACTIONS,
  RISK_LEVEL_LABELS,
  RISK_LEVEL_COLORS,
  type AuditEntry,
  type RetentionPolicy,
} from '@/lib/audit-trail';

/* ─── Factories ──────────────────────────────────────────────── */

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: overrides.id ?? 'e1',
    orgId: overrides.orgId ?? 'org1',
    userId: overrides.userId ?? 'u1',
    userName: overrides.userName ?? 'Alice',
    userEmail: overrides.userEmail,
    action: overrides.action ?? 'upload',
    targetType: overrides.targetType ?? 'asset',
    targetId: overrides.targetId ?? 'a1',
    targetName: overrides.targetName ?? 'photo.png',
    description: overrides.description ?? 'Uploaded photo.png',
    metadata: overrides.metadata ?? {},
    ip: overrides.ip ?? '127.0.0.1',
    userAgent: overrides.userAgent ?? 'test-agent',
    createdAt: overrides.createdAt ?? new Date('2025-06-15T10:00:00Z'),
  };
}

function makeEntries(count: number, base: Partial<AuditEntry> = {}): AuditEntry[] {
  return Array.from({ length: count }, (_, i) =>
    makeEntry({
      ...base,
      id: `e${i + 1}`,
      createdAt: new Date(`2025-06-15T${String(10 + (i % 12)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`),
    }),
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('audit-trail constants', () => {
  it('default retention days is 90', () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(90);
  });

  it('max retention days is 730', () => {
    expect(MAX_RETENTION_DAYS).toBe(730);
  });

  it('min retention days is 7', () => {
    expect(MIN_RETENTION_DAYS).toBe(7);
  });

  it('default page size is 50', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it('max page size is 200', () => {
    expect(MAX_PAGE_SIZE).toBe(200);
  });

  it('RISK_THRESHOLDS has expected keys', () => {
    expect(RISK_THRESHOLDS).toHaveProperty('bulkDeleteCount');
    expect(RISK_THRESHOLDS).toHaveProperty('offHoursStart');
    expect(RISK_THRESHOLDS).toHaveProperty('offHoursEnd');
    expect(RISK_THRESHOLDS).toHaveProperty('rapidActionCount');
  });

  it('DESTRUCTIVE_ACTIONS is a set of expected actions', () => {
    expect(DESTRUCTIVE_ACTIONS.has('delete')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('unshare')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('remove_member')).toBe(true);
    expect(DESTRUCTIVE_ACTIONS.has('upload')).toBe(false);
  });

  it('SENSITIVE_ACTIONS includes update_settings and share', () => {
    expect(SENSITIVE_ACTIONS.has('update_settings')).toBe(true);
    expect(SENSITIVE_ACTIONS.has('share')).toBe(true);
  });

  it('RISK_LEVEL_LABELS covers all 4 levels', () => {
    expect(Object.keys(RISK_LEVEL_LABELS)).toHaveLength(4);
    expect(RISK_LEVEL_LABELS.low).toBeDefined();
    expect(RISK_LEVEL_LABELS.critical).toBeDefined();
  });

  it('RISK_LEVEL_COLORS covers all 4 levels', () => {
    expect(Object.keys(RISK_LEVEL_COLORS)).toHaveLength(4);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  formatDateKey / formatDateLabel                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('formatDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(formatDateKey(new Date('2025-03-05T12:00:00Z'))).toBe('2025-03-05');
  });

  it('pads single-digit months and days', () => {
    expect(formatDateKey(new Date('2025-01-02T00:00:00Z'))).toBe('2025-01-02');
  });
});

describe('formatDateLabel', () => {
  const ref = new Date('2025-06-15T12:00:00Z');

  it('returns "Today" for matching day', () => {
    expect(formatDateLabel('2025-06-15', ref)).toBe('Today');
  });

  it('returns "Yesterday" for the previous day', () => {
    expect(formatDateLabel('2025-06-14', ref)).toBe('Yesterday');
  });

  it('returns abbreviated date for older dates', () => {
    const label = formatDateLabel('2025-03-05', ref);
    expect(label).toBe('Mar 5, 2025');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  buildTimeline                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildTimeline', () => {
  it('groups entries by date', () => {
    const entries = [
      makeEntry({ id: 'e1', createdAt: new Date('2025-06-15T10:00:00Z') }),
      makeEntry({ id: 'e2', createdAt: new Date('2025-06-15T14:00:00Z') }),
      makeEntry({ id: 'e3', createdAt: new Date('2025-06-14T09:00:00Z') }),
    ];
    const timeline = buildTimeline(entries, new Date('2025-06-15T12:00:00Z'));
    expect(timeline).toHaveLength(2);
    const today = timeline.find((g) => g.date === '2025-06-15');
    expect(today?.count).toBe(2);
    expect(today?.label).toBe('Today');
  });

  it('returns empty array for no entries', () => {
    expect(buildTimeline([])).toEqual([]);
  });

  it('creates a single group when all entries are same day', () => {
    const entries = makeEntries(5);
    const groups = buildTimeline(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(5);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  buildUserDigest                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildUserDigest', () => {
  it('computes correct totals for a user', () => {
    const entries = [
      makeEntry({ userId: 'u1', action: 'upload' }),
      makeEntry({ userId: 'u1', action: 'delete' }),
      makeEntry({ userId: 'u2', action: 'upload' }),
    ];
    const digest = buildUserDigest('u1', entries, 'Alice');
    expect(digest.totalActions).toBe(2);
    expect(digest.userId).toBe('u1');
    expect(digest.userName).toBe('Alice');
    expect(digest.actionBreakdown).toHaveProperty('upload', 1);
    expect(digest.actionBreakdown).toHaveProperty('delete', 1);
  });

  it('returns zero actions for unknown user', () => {
    const digest = buildUserDigest('unknown', [makeEntry()]);
    expect(digest.totalActions).toBe(0);
  });

  it('sets averageActionsPerDay >= 1 when all entries same time', () => {
    const entries = [
      makeEntry({ userId: 'u1' }),
      makeEntry({ userId: 'u1' }),
    ];
    const digest = buildUserDigest('u1', entries);
    expect(digest.averageActionsPerDay).toBeGreaterThanOrEqual(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  buildAllUserDigests                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildAllUserDigests', () => {
  it('creates a digest per unique user', () => {
    const entries = [
      makeEntry({ userId: 'u1' }),
      makeEntry({ userId: 'u2' }),
      makeEntry({ userId: 'u1' }),
    ];
    const digests = buildAllUserDigests(entries);
    expect(digests).toHaveLength(2);
  });

  it('sorts by totalActions descending', () => {
    const entries = [
      makeEntry({ userId: 'u1' }),
      makeEntry({ userId: 'u2' }),
      makeEntry({ userId: 'u2' }),
      makeEntry({ userId: 'u2' }),
    ];
    const digests = buildAllUserDigests(entries);
    expect(digests[0].userId).toBe('u2');
    expect(digests[0].totalActions).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  buildTargetHistory                                                    */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildTargetHistory', () => {
  it('filters entries for a specific target', () => {
    const entries = [
      makeEntry({ targetType: 'asset', targetId: 'a1' }),
      makeEntry({ targetType: 'asset', targetId: 'a2' }),
      makeEntry({ targetType: 'asset', targetId: 'a1', userId: 'u2' }),
    ];
    const history = buildTargetHistory('asset', 'a1', entries, 'photo.png');
    expect(history.totalEntries).toBe(2);
    expect(history.uniqueUsers).toBe(2);
    expect(history.targetName).toBe('photo.png');
  });

  it('returns zero entries for unknown target', () => {
    const history = buildTargetHistory('folder', 'unknown', [makeEntry()]);
    expect(history.totalEntries).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Risk Scoring                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('computeUserRiskScore', () => {
  it('returns 0 for empty entries', () => {
    expect(computeUserRiskScore([])).toBe(0);
  });

  it('returns low score for benign uploads', () => {
    const entries = makeEntries(5, { action: 'upload' });
    const score = computeUserRiskScore(entries);
    expect(score).toBeLessThan(20);
  });

  it('increases score for destructive actions', () => {
    const entries = makeEntries(10, { action: 'delete' });
    const score = computeUserRiskScore(entries);
    expect(score).toBeGreaterThan(20);
  });

  it('never exceeds 100', () => {
    // Create extreme scenario: all destructive + rapid-fire + off-hours
    const entries: AuditEntry[] = [];
    const baseTime = new Date('2025-06-15T02:00:00Z'); // 2 AM = off hours
    for (let i = 0; i < 60; i++) {
      entries.push(
        makeEntry({
          id: `e${i}`,
          action: 'delete',
          createdAt: new Date(baseTime.getTime() + i * 1000), // 1 second apart
        }),
      );
    }
    const score = computeUserRiskScore(entries);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('classifyRiskLevel', () => {
  it('classifies 0 as low', () => {
    expect(classifyRiskLevel(0)).toBe('low');
  });

  it('classifies 19 as low', () => {
    expect(classifyRiskLevel(19)).toBe('low');
  });

  it('classifies 20 as medium', () => {
    expect(classifyRiskLevel(20)).toBe('medium');
  });

  it('classifies 45 as high', () => {
    expect(classifyRiskLevel(45)).toBe('high');
  });

  it('classifies 70 as critical', () => {
    expect(classifyRiskLevel(70)).toBe('critical');
  });

  it('classifies 100 as critical', () => {
    expect(classifyRiskLevel(100)).toBe('critical');
  });
});

describe('detectRiskFlags', () => {
  it('returns empty for benign entries', () => {
    const entries = makeEntries(3, { action: 'upload' });
    const flags = detectRiskFlags(entries);
    expect(flags).toHaveLength(0);
  });

  it('flags users with elevated risk', () => {
    const entries: AuditEntry[] = [];
    const baseTime = new Date('2025-06-15T02:00:00Z');
    for (let i = 0; i < 30; i++) {
      entries.push(
        makeEntry({
          id: `e${i}`,
          userId: 'u1',
          action: 'delete',
          createdAt: new Date(baseTime.getTime() + i * 1000),
        }),
      );
    }
    const flags = detectRiskFlags(entries);
    expect(flags.length).toBeGreaterThanOrEqual(1);
    expect(flags[0].userId).toBe('u1');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Retention Policy                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('createRetentionPolicy', () => {
  it('creates with defaults', () => {
    const policy = createRetentionPolicy('org1');
    expect(policy.orgId).toBe('org1');
    expect(policy.retentionDays).toBe(DEFAULT_RETENTION_DAYS);
    expect(policy.archiveEnabled).toBe(false);
    expect(policy.complianceMode).toBe(false);
  });

  it('allows overrides', () => {
    const policy = createRetentionPolicy('org1', {
      retentionDays: 365,
      complianceMode: true,
    });
    expect(policy.retentionDays).toBe(365);
    expect(policy.complianceMode).toBe(true);
  });
});

describe('validateRetentionDays', () => {
  it('clamps below minimum', () => {
    expect(validateRetentionDays(1)).toBe(MIN_RETENTION_DAYS);
  });

  it('clamps above maximum', () => {
    expect(validateRetentionDays(9999)).toBe(MAX_RETENTION_DAYS);
  });

  it('rounds to integer', () => {
    expect(validateRetentionDays(45.7)).toBe(46);
  });

  it('passes valid values through', () => {
    expect(validateRetentionDays(90)).toBe(90);
  });
});

describe('findExpiredEntries', () => {
  it('returns entries older than retention period', () => {
    const ref = new Date('2025-06-15T00:00:00Z');
    const policy = createRetentionPolicy('org1', { retentionDays: 30 });
    const entries = [
      makeEntry({ id: 'old', createdAt: new Date('2025-05-01T00:00:00Z') }),
      makeEntry({ id: 'new', createdAt: new Date('2025-06-10T00:00:00Z') }),
    ];
    const expired = findExpiredEntries(entries, policy, ref);
    expect(expired).toHaveLength(1);
    expect(expired[0].id).toBe('old');
  });

  it('returns nothing in compliance mode', () => {
    const ref = new Date('2025-06-15T00:00:00Z');
    const policy = createRetentionPolicy('org1', {
      retentionDays: 1,
      complianceMode: true,
    });
    const entries = [
      makeEntry({ createdAt: new Date('2020-01-01T00:00:00Z') }),
    ];
    expect(findExpiredEntries(entries, policy, ref)).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Pagination                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('paginateEntries', () => {
  const entries = makeEntries(120);

  it('returns first page with correct count', () => {
    const result = paginateEntries(entries, 1, 50);
    expect(result.entries).toHaveLength(50);
    expect(result.page).toBe(1);
    expect(result.total).toBe(120);
    expect(result.totalPages).toBe(3);
    expect(result.hasMore).toBe(true);
  });

  it('returns last page', () => {
    const result = paginateEntries(entries, 3, 50);
    expect(result.entries).toHaveLength(20);
    expect(result.hasMore).toBe(false);
  });

  it('clamps page size to MAX_PAGE_SIZE', () => {
    const result = paginateEntries(entries, 1, 999);
    expect(result.pageSize).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });

  it('treats page 0 as page 1', () => {
    const result = paginateEntries(entries, 0);
    expect(result.page).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  filterEntries                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('filterEntries', () => {
  const entries = [
    makeEntry({ id: 'e1', action: 'upload', userId: 'u1', targetType: 'asset', ip: '10.0.0.1' }),
    makeEntry({ id: 'e2', action: 'delete', userId: 'u2', targetType: 'asset', ip: '10.0.0.2' }),
    makeEntry({ id: 'e3', action: 'share', userId: 'u1', targetType: 'folder', ip: '10.0.0.1' }),
  ];

  it('filters by action', () => {
    const result = filterEntries(entries, { actions: ['upload'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('filters by targetType', () => {
    const result = filterEntries(entries, { targetTypes: ['folder'] });
    expect(result).toHaveLength(1);
  });

  it('filters by userId', () => {
    const result = filterEntries(entries, { userIds: ['u1'] });
    expect(result).toHaveLength(2);
  });

  it('filters by IP address', () => {
    const result = filterEntries(entries, { ipAddress: '10.0.0.2' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e2');
  });

  it('filters by search text (description)', () => {
    const result = filterEntries(entries, { search: 'photo' });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by date range', () => {
    const start = new Date('2025-06-15T00:00:00Z');
    const end = new Date('2025-06-16T00:00:00Z');
    const result = filterEntries(entries, { startDate: start, endDate: end });
    expect(result).toHaveLength(3);
  });

  it('combines multiple filters', () => {
    const result = filterEntries(entries, {
      actions: ['upload', 'share'],
      userIds: ['u1'],
    });
    expect(result).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  countDistinct                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('countDistinct', () => {
  const entries = [
    makeEntry({ userId: 'u1', action: 'upload', ip: '10.0.0.1' }),
    makeEntry({ userId: 'u2', action: 'upload', ip: '10.0.0.2' }),
    makeEntry({ userId: 'u1', action: 'delete', ip: '10.0.0.1' }),
  ];

  it('counts distinct users', () => {
    expect(countDistinct(entries, 'userId')).toBe(2);
  });

  it('counts distinct actions', () => {
    expect(countDistinct(entries, 'action')).toBe(2);
  });

  it('counts distinct IPs', () => {
    expect(countDistinct(entries, 'ip')).toBe(2);
  });
});
