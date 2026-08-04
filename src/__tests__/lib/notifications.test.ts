// SPDX-License-Identifier: Apache-2.0
/**
 * In-App Notification Engine — Tests
 * Sprint 13.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNotification,
  createBulkNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
  archiveNotification,
  calculateBadge,
  createDefaultPreferences,
  shouldDeliver,
  isInQuietHours,
  updatePreferences,
  buildDigest,
  buildDigestSummary,
  buildNotificationQuery,
  deduplicateNotifications,
  formatNotificationDisplay,
  resetNotificationIdCounter,
  DEFAULT_CHANNELS,
  TYPE_LABELS,
  TYPE_ICONS,
  TYPE_PRIORITY,
  MAX_NOTIFICATION_TITLE_LENGTH,
  MAX_NOTIFICATION_BODY_LENGTH,
  type NotificationData,
  type NotificationPreferences,
} from '@/lib/notifications';

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Helpers                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

function makeNotification(
  overrides: Partial<NotificationData> = {},
): NotificationData {
  return {
    id: 'ntf-1',
    orgId: 'org-1',
    recipientId: 'user-1',
    type: 'comment_mention',
    title: 'New mention',
    body: 'Alice mentioned you in a comment',
    priority: 'normal',
    read: false,
    readAt: null,
    archivedAt: null,
    createdAt: new Date('2024-06-15T10:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  resetNotificationIdCounter();
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification constants', () => {
  it('DEFAULT_CHANNELS covers all 16 notification types', () => {
    expect(Object.keys(DEFAULT_CHANNELS)).toHaveLength(16);
  });

  it('TYPE_LABELS covers all types', () => {
    expect(Object.keys(TYPE_LABELS)).toHaveLength(16);
  });

  it('TYPE_ICONS covers all types', () => {
    expect(Object.keys(TYPE_ICONS)).toHaveLength(16);
  });

  it('TYPE_PRIORITY covers all types', () => {
    expect(Object.keys(TYPE_PRIORITY)).toHaveLength(16);
  });

  it('critical types use email channel by default', () => {
    expect(DEFAULT_CHANNELS.approval_requested).toContain('email');
    expect(DEFAULT_CHANNELS.invite_received).toContain('email');
    expect(DEFAULT_CHANNELS.share_received).toContain('email');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  createNotification                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('createNotification', () => {
  it('creates a valid notification', () => {
    const { notification, error } = createNotification({
      orgId: 'org-1',
      recipientId: 'user-1',
      type: 'comment_mention',
      title: 'New mention',
      body: 'Alice mentioned you',
      actorId: 'user-2',
      actorName: 'Alice',
    });
    expect(error).toBeUndefined();
    expect(notification!.id).toBe('ntf-1');
    expect(notification!.read).toBe(false);
    expect(notification!.priority).toBe('normal'); // from TYPE_PRIORITY
  });

  it('allows custom priority override', () => {
    const { notification } = createNotification({
      orgId: 'org-1',
      recipientId: 'user-1',
      type: 'comment_reply',
      title: 'Reply',
      body: 'Bob replied',
      priority: 'urgent',
    });
    expect(notification!.priority).toBe('urgent');
  });

  it('rejects missing orgId', () => {
    const { error } = createNotification({
      orgId: '',
      recipientId: 'u1',
      type: 'comment_mention',
      title: 'T',
      body: 'B',
    });
    expect(error).toContain('orgId');
  });

  it('rejects missing recipientId', () => {
    const { error } = createNotification({
      orgId: 'o1',
      recipientId: '',
      type: 'comment_mention',
      title: 'T',
      body: 'B',
    });
    expect(error).toContain('recipientId');
  });

  it('rejects empty title', () => {
    const { error } = createNotification({
      orgId: 'o1',
      recipientId: 'u1',
      type: 'comment_mention',
      title: '   ',
      body: 'B',
    });
    expect(error).toContain('title');
  });

  it('rejects overly long title', () => {
    const { error } = createNotification({
      orgId: 'o1',
      recipientId: 'u1',
      type: 'comment_mention',
      title: 'x'.repeat(MAX_NOTIFICATION_TITLE_LENGTH + 1),
      body: 'B',
    });
    expect(error).toContain('Title exceeds');
  });

  it('rejects overly long body', () => {
    const { error } = createNotification({
      orgId: 'o1',
      recipientId: 'u1',
      type: 'comment_mention',
      title: 'T',
      body: 'x'.repeat(MAX_NOTIFICATION_BODY_LENGTH + 1),
    });
    expect(error).toContain('Body exceeds');
  });

  it('rejects self-notification', () => {
    const { error } = createNotification({
      orgId: 'o1',
      recipientId: 'user-1',
      type: 'comment_mention',
      title: 'T',
      body: 'B',
      actorId: 'user-1',
    });
    expect(error).toContain('yourself');
  });

  it('increments IDs', () => {
    const { notification: n1 } = createNotification({
      orgId: 'o',
      recipientId: 'u1',
      type: 'comment_mention',
      title: 'T',
      body: 'B',
      actorId: 'u2',
    });
    const { notification: n2 } = createNotification({
      orgId: 'o',
      recipientId: 'u1',
      type: 'comment_reply',
      title: 'T',
      body: 'B',
    });
    expect(n1!.id).toBe('ntf-1');
    expect(n2!.id).toBe('ntf-2');
  });
});

describe('createBulkNotifications', () => {
  it('creates notifications for multiple recipients', () => {
    const { notifications, errors } = createBulkNotifications(
      {
        orgId: 'o1',
        type: 'system_announcement',
        title: 'Announcement',
        body: 'System update',
      },
      ['user-1', 'user-2', 'user-3'],
    );
    expect(notifications).toHaveLength(3);
    expect(errors).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Read / Archive                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('markAsRead / markAsUnread', () => {
  it('marks as read', () => {
    const result = markAsRead(makeNotification());
    expect(result.read).toBe(true);
    expect(result.readAt).not.toBeNull();
  });

  it('is idempotent for read', () => {
    const n = makeNotification({ read: true, readAt: new Date() });
    const result = markAsRead(n);
    expect(result).toBe(n); // same reference
  });

  it('marks as unread', () => {
    const n = makeNotification({ read: true, readAt: new Date() });
    const result = markAsUnread(n);
    expect(result.read).toBe(false);
    expect(result.readAt).toBeNull();
  });
});

describe('markAllAsRead', () => {
  it('marks all as read', () => {
    const notifs = [makeNotification(), makeNotification({ id: 'ntf-2' })];
    const result = markAllAsRead(notifs);
    expect(result.every((n) => n.read)).toBe(true);
  });
});

describe('archiveNotification', () => {
  it('archives a notification', () => {
    const result = archiveNotification(makeNotification());
    expect(result.archivedAt).not.toBeNull();
  });

  it('is idempotent', () => {
    const n = makeNotification({ archivedAt: new Date() });
    const result = archiveNotification(n);
    expect(result).toBe(n);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Badge Counts                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('calculateBadge', () => {
  it('counts unread unarchived notifications', () => {
    const notifs = [
      makeNotification(),
      makeNotification({ id: 'n2', read: true }),
      makeNotification({ id: 'n3', archivedAt: new Date() }),
      makeNotification({ id: 'n4', priority: 'high' }),
    ];
    const badge = calculateBadge(notifs);
    expect(badge.total).toBe(2); // n1 and n4
    expect(badge.highPriority).toBe(1);
  });

  it('groups by type', () => {
    const notifs = [
      makeNotification({ type: 'comment_mention' }),
      makeNotification({ id: 'n2', type: 'comment_mention' }),
      makeNotification({ id: 'n3', type: 'share_received' }),
    ];
    const badge = calculateBadge(notifs);
    expect(badge.byType.comment_mention).toBe(2);
    expect(badge.byType.share_received).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Preferences                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('createDefaultPreferences', () => {
  it('creates default preferences', () => {
    const prefs = createDefaultPreferences('user-1');
    expect(prefs.userId).toBe('user-1');
    expect(prefs.muted).toBe(false);
    expect(prefs.digestFrequency).toBe('daily');
  });
});

describe('shouldDeliver', () => {
  it('delivers in_app by default for comment_mention', () => {
    const prefs = createDefaultPreferences('u1');
    expect(shouldDeliver(prefs, 'comment_mention', 'in_app')).toBe(true);
  });

  it('blocks when globally muted', () => {
    const prefs = { ...createDefaultPreferences('u1'), muted: true };
    expect(shouldDeliver(prefs, 'comment_mention', 'in_app')).toBe(false);
  });

  it('respects custom channel settings', () => {
    const prefs = createDefaultPreferences('u1');
    prefs.channels.comment_mention = ['email']; // removed in_app
    expect(shouldDeliver(prefs, 'comment_mention', 'in_app')).toBe(false);
    expect(shouldDeliver(prefs, 'comment_mention', 'email')).toBe(true);
  });
});

describe('isInQuietHours', () => {
  it('returns false with no quiet hours set', () => {
    const prefs = createDefaultPreferences('u1');
    expect(isInQuietHours(prefs)).toBe(false);
  });

  it('detects within same-day quiet hours', () => {
    const prefs: NotificationPreferences = {
      ...createDefaultPreferences('u1'),
      quietHoursStart: '22:00',
      quietHoursEnd: '23:00',
    };
    const within = new Date('2024-06-15T22:30:00');
    const outside = new Date('2024-06-15T21:00:00');
    expect(isInQuietHours(prefs, within)).toBe(true);
    expect(isInQuietHours(prefs, outside)).toBe(false);
  });

  it('handles overnight quiet hours', () => {
    const prefs: NotificationPreferences = {
      ...createDefaultPreferences('u1'),
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };
    const night = new Date('2024-06-15T23:30:00');
    const morning = new Date('2024-06-16T06:00:00');
    const afternoon = new Date('2024-06-16T14:00:00');
    expect(isInQuietHours(prefs, night)).toBe(true);
    expect(isInQuietHours(prefs, morning)).toBe(true);
    expect(isInQuietHours(prefs, afternoon)).toBe(false);
  });
});

describe('updatePreferences', () => {
  it('merges channel updates', () => {
    const prefs = createDefaultPreferences('u1');
    const updated = updatePreferences(prefs, {
      channels: { comment_mention: ['email'] },
    });
    expect(updated.channels.comment_mention).toEqual(['email']);
    // Other channels preserved
    expect(updated.channels.share_received).toEqual(
      DEFAULT_CHANNELS.share_received,
    );
  });

  it('updates digestFrequency', () => {
    const prefs = createDefaultPreferences('u1');
    const updated = updatePreferences(prefs, { digestFrequency: 'weekly' });
    expect(updated.digestFrequency).toBe('weekly');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Digest                                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildDigest', () => {
  it('builds digest within period', () => {
    const notifications = [
      makeNotification({
        recipientId: 'u1',
        createdAt: new Date('2024-06-15T10:00:00Z'),
      }),
      makeNotification({
        id: 'n2',
        recipientId: 'u1',
        type: 'share_received',
        createdAt: new Date('2024-06-15T12:00:00Z'),
      }),
      makeNotification({
        id: 'n3',
        recipientId: 'u2',
        createdAt: new Date('2024-06-15T11:00:00Z'),
      }), // different user
    ];
    const digest = buildDigest('u1', notifications, {
      start: new Date('2024-06-15T00:00:00Z'),
      end: new Date('2024-06-15T23:59:59Z'),
    });
    expect(digest.totalCount).toBe(2);
    expect(digest.groupedByType.get('comment_mention')).toHaveLength(1);
    expect(digest.groupedByType.get('share_received')).toHaveLength(1);
  });

  it('excludes notifications outside period', () => {
    const notifications = [
      makeNotification({
        recipientId: 'u1',
        createdAt: new Date('2024-06-14T10:00:00Z'),
      }),
    ];
    const digest = buildDigest('u1', notifications, {
      start: new Date('2024-06-15T00:00:00Z'),
      end: new Date('2024-06-15T23:59:59Z'),
    });
    expect(digest.totalCount).toBe(0);
  });
});

describe('buildDigestSummary', () => {
  it('generates summary text', () => {
    const notifications = [
      makeNotification({ type: 'comment_mention' }),
      makeNotification({ id: 'n2', type: 'comment_mention' }),
      makeNotification({ id: 'n3', type: 'share_received' }),
    ];
    const grouped = new Map<string, typeof notifications>([
      ['comment_mention', notifications.slice(0, 2)],
      ['share_received', notifications.slice(2)],
    ]);
    const summary = buildDigestSummary(notifications, grouped);
    expect(summary).toContain('3 new notifications');
    expect(summary).toContain('mentioned in comment');
  });

  it('returns empty message for no notifications', () => {
    expect(buildDigestSummary([], new Map())).toBe('No new notifications.');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Query Builder                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildNotificationQuery', () => {
  it('builds basic query', () => {
    const query = buildNotificationQuery({
      orgId: 'o1',
      recipientId: 'u1',
    });
    expect(query.orgId).toBe('o1');
    expect(query.recipientId).toBe('u1');
  });

  it('adds type filter', () => {
    const query = buildNotificationQuery({
      orgId: 'o1',
      recipientId: 'u1',
      types: ['comment_mention', 'share_received'],
    });
    expect(query.type).toEqual({ $in: ['comment_mention', 'share_received'] });
  });

  it('adds read filter', () => {
    const query = buildNotificationQuery({
      orgId: 'o1',
      recipientId: 'u1',
      read: false,
    });
    expect(query.read).toBe(false);
  });

  it('adds archived filter', () => {
    const query = buildNotificationQuery({
      orgId: 'o1',
      recipientId: 'u1',
      archived: false,
    });
    expect(query.archivedAt).toBeNull();
  });

  it('adds priority filter', () => {
    const query = buildNotificationQuery({
      orgId: 'o1',
      recipientId: 'u1',
      priority: ['high', 'urgent'],
    });
    expect(query.priority).toEqual({ $in: ['high', 'urgent'] });
  });

  it('adds date range filter', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    const query = buildNotificationQuery({
      orgId: 'o1',
      recipientId: 'u1',
      startDate: start,
      endDate: end,
    });
    expect(query.createdAt).toEqual({ $gte: start, $lte: end });
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Deduplication                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('deduplicateNotifications', () => {
  it('deduplicates by groupKey within window', () => {
    const base = new Date('2024-06-15T10:00:00Z');
    const n1 = makeNotification({
      id: 'n1',
      groupKey: 'comment:a1',
      createdAt: new Date(base.getTime() + 1000),
    });
    const n2 = makeNotification({
      id: 'n2',
      groupKey: 'comment:a1',
      createdAt: base,
    });
    const result = deduplicateNotifications([n1, n2]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1'); // newest
  });

  it('keeps both if outside window', () => {
    const base = new Date('2024-06-15T10:00:00Z');
    const n1 = makeNotification({
      id: 'n1',
      groupKey: 'comment:a1',
      createdAt: new Date(base.getTime() + 10 * 60 * 1000), // +10 min
    });
    const n2 = makeNotification({
      id: 'n2',
      groupKey: 'comment:a1',
      createdAt: base,
    });
    const result = deduplicateNotifications([n1, n2], 5 * 60 * 1000); // 5 min window
    expect(result).toHaveLength(2);
  });

  it('always includes notifications without groupKey', () => {
    const n1 = makeNotification({ id: 'n1' });
    const n2 = makeNotification({ id: 'n2' });
    const result = deduplicateNotifications([n1, n2]);
    expect(result).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Display Formatting                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('formatNotificationDisplay', () => {
  it('formats notification for display', () => {
    const n = makeNotification({ type: 'comment_mention', priority: 'high' });
    const display = formatNotificationDisplay(n);
    expect(display.icon).toBe('at-sign');
    expect(display.label).toBe('Mentioned in comment');
    expect(display.priorityColor).toBe('text-orange-500');
    expect(display.timeAgo).toBeTruthy();
  });
});
