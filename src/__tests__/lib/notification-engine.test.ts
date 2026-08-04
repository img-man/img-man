// SPDX-License-Identifier: Apache-2.0
/**
 * Notification Engine — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  NOTIFICATION_TYPE_CONFIG,
  NOTIFICATION_CATEGORIES,
  getNotificationCategory,
  getTypesInCategory,
  resolveTemplate,
  createNotification,
  markAsRead,
  markAsArchived,
  markAllAsRead,
  isNotificationExpired,
  filterExpired,
  getUnreadCount,
  getUnreadCountByCategory,
  buildNotificationBadge,
  groupNotifications,
  routeToChannels,
  filterNotifications,
  sortNotifications,
  buildNotificationCenterSummary,
  type Notification,
  type NotificationType,
  type CreateNotificationInput,
} from '@/lib/notification-engine';

/* ─── Helpers ────────────────────────────────────────────────── */

const NOW = new Date('2026-03-06T12:00:00Z');

function makeInput(overrides: Partial<CreateNotificationInput> = {}): CreateNotificationInput {
  return {
    orgId: 'org_1',
    recipientId: 'user_1',
    type: 'asset.uploaded',
    actorId: 'user_2',
    actorName: 'Alice',
    targetId: 'asset_1',
    targetType: 'asset',
    targetName: 'photo.png',
    ...overrides,
  };
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return createNotification(makeInput(), NOW) as Notification & typeof overrides;
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants & Configuration                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine constants', () => {
  it('has config for all 26 notification types', () => {
    const types = Object.keys(NOTIFICATION_TYPE_CONFIG);
    expect(types.length).toBe(26);
  });

  it('has all 7 categories', () => {
    expect(Object.keys(NOTIFICATION_CATEGORIES)).toHaveLength(7);
    expect(NOTIFICATION_CATEGORIES.assets).toBeDefined();
    expect(NOTIFICATION_CATEGORIES.billing).toBeDefined();
    expect(NOTIFICATION_CATEGORIES.system).toBeDefined();
  });

  it('getNotificationCategory returns correct category', () => {
    expect(getNotificationCategory('asset.uploaded')).toBe('assets');
    expect(getNotificationCategory('billing.payment_failed')).toBe('billing');
    expect(getNotificationCategory('system.maintenance')).toBe('system');
    expect(getNotificationCategory('ai.job_completed')).toBe('ai');
  });

  it('getTypesInCategory returns correct types', () => {
    const teamTypes = getTypesInCategory('team');
    expect(teamTypes).toContain('team.member_invited');
    expect(teamTypes).toContain('team.member_joined');
    expect(teamTypes).toContain('team.member_removed');
    expect(teamTypes).toContain('team.role_changed');
  });

  it('every config has required fields', () => {
    for (const [type, config] of Object.entries(NOTIFICATION_TYPE_CONFIG)) {
      expect(config.type).toBe(type);
      expect(config.category).toBeTruthy();
      expect(config.defaultPriority).toBeTruthy();
      expect(config.defaultChannels.length).toBeGreaterThan(0);
      expect(config.icon).toBeTruthy();
      expect(config.titleTemplate).toBeTruthy();
      expect(config.bodyTemplate).toBeTruthy();
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Template Resolution                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine template resolution', () => {
  it('resolves simple variables', () => {
    expect(resolveTemplate('Hello {{name}}!', { name: 'Bob' })).toBe('Hello Bob!');
  });

  it('resolves nested variables', () => {
    expect(resolveTemplate('Used {{metadata.percentage}}%', { metadata: { percentage: 80 } })).toBe('Used 80%');
  });

  it('returns empty for missing variables', () => {
    expect(resolveTemplate('Hi {{unknown}}', {})).toBe('Hi ');
  });

  it('handles multiple variables', () => {
    expect(resolveTemplate('{{a}} and {{b}}', { a: 'X', b: 'Y' })).toBe('X and Y');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Notification Creation                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine creation', () => {
  it('creates a notification with correct fields', () => {
    const n = createNotification(makeInput(), NOW);
    expect(n.orgId).toBe('org_1');
    expect(n.recipientId).toBe('user_1');
    expect(n.type).toBe('asset.uploaded');
    expect(n.category).toBe('assets');
    expect(n.status).toBe('pending');
    expect(n.actorName).toBe('Alice');
    expect(n.targetName).toBe('photo.png');
    expect(n.body).toContain('Alice');
    expect(n.body).toContain('photo.png');
    expect(n.readAt).toBeNull();
  });

  it('resolves action URL', () => {
    const n = createNotification(makeInput(), NOW);
    expect(n.actionUrl).toContain('asset_1');
  });

  it('sets expiry from config', () => {
    const n = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    expect(n.expiresAt).not.toBeNull();
  });

  it('no expiry for persistent types', () => {
    const n = createNotification(makeInput({ type: 'asset.shared' }), NOW);
    expect(n.expiresAt).toBeNull();
  });

  it('overrides title and body', () => {
    const n = createNotification(
      makeInput({ overrideTitle: 'Custom title', overrideBody: 'Custom body' }),
      NOW,
    );
    expect(n.title).toBe('Custom title');
    expect(n.body).toBe('Custom body');
  });

  it('generates groupKey for groupable types', () => {
    const n = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    expect(n.groupKey).toBeTruthy();
    expect(n.groupKey).toContain('asset.uploaded');
  });

  it('no groupKey for non-groupable types', () => {
    const n = createNotification(makeInput({ type: 'team.member_invited' }), NOW);
    expect(n.groupKey).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  State Management                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine state management', () => {
  it('marks as read', () => {
    const n = makeNotification();
    const read = markAsRead(n, NOW);
    expect(read.status).toBe('read');
    expect(read.readAt).toEqual(NOW);
  });

  it('does not mark archived as read', () => {
    const n = markAsArchived(makeNotification(), NOW);
    const result = markAsRead(n, NOW);
    expect(result.status).toBe('archived');
  });

  it('marks as archived', () => {
    const n = makeNotification();
    const archived = markAsArchived(n, NOW);
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toEqual(NOW);
  });

  it('markAllAsRead skips already read/archived', () => {
    const n1 = makeNotification();
    const n2 = markAsRead(makeNotification(), NOW);
    const n3 = markAsArchived(makeNotification(), NOW);
    const result = markAllAsRead([n1, n2, n3], NOW);
    expect(result[0].status).toBe('read');
    expect(result[1].status).toBe('read'); // unchanged
    expect(result[2].status).toBe('archived'); // unchanged
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Expiry                                                                */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine expiry', () => {
  it('detects expired notification', () => {
    const n = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    // asset.uploaded expires in 168 hours
    const future = new Date(NOW.getTime() + 169 * 3600_000);
    expect(isNotificationExpired(n, future)).toBe(true);
  });

  it('non-expired notification', () => {
    const n = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    expect(isNotificationExpired(n, NOW)).toBe(false);
  });

  it('filterExpired removes expired items', () => {
    const n1 = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    const n2 = createNotification(makeInput({ type: 'asset.shared' }), NOW); // no expiry
    const future = new Date(NOW.getTime() + 200 * 3600_000);
    const result = filterExpired([n1, n2], future);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('asset.shared');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Badge & Counts                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine badge', () => {
  it('counts unread notifications', () => {
    const n1 = makeNotification();
    const n2 = markAsRead(makeNotification(), NOW);
    const n3 = makeNotification();
    expect(getUnreadCount([n1, n2, n3], NOW)).toBe(2);
  });

  it('counts by category', () => {
    const n1 = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    const n2 = createNotification(makeInput({ type: 'billing.payment_failed' }), NOW);
    const counts = getUnreadCountByCategory([n1, n2], NOW);
    expect(counts.assets).toBe(1);
    expect(counts.billing).toBe(1);
    expect(counts.team).toBe(0);
  });

  it('buildNotificationBadge detects urgent', () => {
    const n1 = makeNotification();
    const n2 = createNotification(makeInput({ type: 'billing.payment_failed' }), NOW);
    const badge = buildNotificationBadge([n1, n2], NOW);
    expect(badge.totalUnread).toBe(2);
    expect(badge.hasUrgent).toBe(true);
    expect(badge.urgentCount).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Grouping                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine grouping', () => {
  it('groups notifications with same groupKey', () => {
    const n1 = createNotification(makeInput({ type: 'asset.uploaded', targetId: 'a1' }), NOW);
    const n2 = createNotification(makeInput({ type: 'asset.uploaded', targetId: 'a2' }), NOW);
    const groups = groupNotifications([n1, n2]);
    // Both should be in same group (same orgId, type, targetType)
    const assetGroups = groups.filter((g) => g.type === 'asset.uploaded');
    expect(assetGroups.length).toBeGreaterThanOrEqual(1);
    expect(assetGroups[0].count).toBe(2);
  });

  it('non-groupable items are separate', () => {
    const n1 = createNotification(makeInput({ type: 'team.member_invited', targetId: 'u1' }), NOW);
    const n2 = createNotification(makeInput({ type: 'team.member_invited', targetId: 'u2' }), NOW);
    const groups = groupNotifications([n1, n2]);
    expect(groups).toHaveLength(2);
  });

  it('groups have actor list', () => {
    const n1 = createNotification(makeInput({ actorName: 'Alice' }), NOW);
    const n2 = createNotification(makeInput({ actorName: 'Bob' }), NOW);
    const groups = groupNotifications([n1, n2]);
    const g = groups.find((g) => g.count === 2);
    expect(g?.actors).toContain('Alice');
    expect(g?.actors).toContain('Bob');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Channel Routing                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine channel routing', () => {
  it('returns default channels', () => {
    const n = makeNotification();
    const channels = routeToChannels(n);
    expect(channels).toContain('in_app');
  });

  it('adds email for urgent', () => {
    const n = createNotification(makeInput({ type: 'billing.payment_failed' }), NOW);
    const channels = routeToChannels(n);
    expect(channels).toContain('email');
    expect(channels).toContain('in_app');
  });

  it('respects disabled channels', () => {
    const n = createNotification(makeInput({ type: 'asset.shared' }), NOW);
    const channels = routeToChannels(n, { disabledChannels: ['email'] });
    expect(channels).not.toContain('email');
    expect(channels).toContain('in_app');
  });

  it('respects disabled types', () => {
    const n = makeNotification();
    const channels = routeToChannels(n, { disabledTypes: ['asset.uploaded'] });
    expect(channels).toHaveLength(0);
  });

  it('urgent in_app bypasses disabled channels', () => {
    const n = createNotification(makeInput({ type: 'billing.payment_failed' }), NOW);
    const channels = routeToChannels(n, { disabledChannels: ['in_app'] });
    expect(channels).toContain('in_app'); // urgent bypass
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Filtering & Sorting                                                   */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine filtering', () => {
  it('filters by category', () => {
    const n1 = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    const n2 = createNotification(makeInput({ type: 'billing.payment_received' }), NOW);
    const result = filterNotifications([n1, n2], { categories: ['assets'] }, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('assets');
  });

  it('filters by unreadOnly', () => {
    const n1 = makeNotification();
    const n2 = markAsRead(makeNotification(), NOW);
    const result = filterNotifications([n1, n2], { unreadOnly: true }, NOW);
    expect(result).toHaveLength(1);
  });

  it('filters by date range', () => {
    const old = createNotification(makeInput(), new Date('2026-01-01'));
    const recent = createNotification(makeInput(), new Date('2026-03-01'));
    const result = filterNotifications([old, recent], {
      fromDate: new Date('2026-02-01'),
    }, NOW);
    expect(result).toHaveLength(1);
  });
});

describe('notification-engine sorting', () => {
  it('sorts newest first', () => {
    const n1 = createNotification(makeInput(), new Date('2026-03-01'));
    const n2 = createNotification(makeInput(), new Date('2026-03-05'));
    const sorted = sortNotifications([n1, n2], 'newest');
    expect(sorted[0].createdAt.getTime()).toBeGreaterThan(sorted[1].createdAt.getTime());
  });

  it('sorts oldest first', () => {
    const n1 = createNotification(makeInput(), new Date('2026-03-01'));
    const n2 = createNotification(makeInput(), new Date('2026-03-05'));
    const sorted = sortNotifications([n1, n2], 'oldest');
    expect(sorted[0].createdAt.getTime()).toBeLessThan(sorted[1].createdAt.getTime());
  });

  it('sorts by priority', () => {
    const low = createNotification(makeInput({ type: 'asset.uploaded' }), NOW); // low
    const urgent = createNotification(makeInput({ type: 'billing.payment_failed' }), NOW); // urgent
    const sorted = sortNotifications([low, urgent], 'priority');
    expect(sorted[0].priority).toBe('urgent');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Notification Center Summary                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-engine center summary', () => {
  it('builds summary for empty list', () => {
    const s = buildNotificationCenterSummary([], NOW);
    expect(s.totalCount).toBe(0);
    expect(s.unreadCount).toBe(0);
    expect(s.urgentCount).toBe(0);
  });

  it('builds summary with mixed notifications', () => {
    const n1 = createNotification(makeInput({ type: 'asset.uploaded' }), NOW);
    const n2 = createNotification(makeInput({ type: 'billing.payment_failed' }), NOW);
    const n3 = markAsRead(createNotification(makeInput({ type: 'team.member_joined' }), NOW), NOW);
    const s = buildNotificationCenterSummary([n1, n2, n3], NOW);
    expect(s.totalCount).toBe(3);
    expect(s.unreadCount).toBe(2);
    expect(s.urgentCount).toBe(1);
    expect(s.categorySummary.find((c) => c.category === 'assets')?.unread).toBe(1);
  });
});
