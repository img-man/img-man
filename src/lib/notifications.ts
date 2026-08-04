// SPDX-License-Identifier: Apache-2.0
/**
 * In-App Notification Engine — Sprint 13.3
 *
 * Provides platform-wide notification management:
 * - Notification creation (type-safe, with deduplication)
 * - Preference management (per-user notification settings)
 * - Digest builder (group notifications for email digests)
 * - Read/unread state management
 * - Badge count calculation
 * - Query building for notification feeds
 * - Notification formatting for display
 *
 * Note: Pure functions for notification state transforms.
 * Actual persistence and email delivery via server actions.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export type NotificationType =
  | 'comment_mention'
  | 'comment_reply'
  | 'comment_resolved'
  | 'share_received'
  | 'share_accessed'
  | 'invite_received'
  | 'invite_accepted'
  | 'role_changed'
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_changes_requested'
  | 'asset_uploaded'
  | 'asset_deleted'
  | 'ai_complete'
  | 'system_announcement';

export type NotificationChannel = 'in_app' | 'email' | 'push';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationData {
  id: string;
  orgId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** The user who triggered this notification */
  actorId?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  /** Related entity */
  targetType?: string;
  targetId?: string;
  priority: NotificationPriority;
  read: boolean;
  readAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  /** Group key for deduplication / batching (e.g., "comment:asset123") */
  groupKey?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationPreferences {
  userId: string;
  /** Per-type channel settings */
  channels: Partial<Record<NotificationType, NotificationChannel[]>>;
  /** Global mute */
  muted: boolean;
  /** Email digest frequency */
  digestFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'never';
  /** Do not disturb schedule */
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
}

export interface NotificationCreateInput {
  orgId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  actorId?: string;
  actorName?: string;
  actorAvatarUrl?: string;
  targetType?: string;
  targetId?: string;
  priority?: NotificationPriority;
  groupKey?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDigest {
  recipientId: string;
  period: { start: Date; end: Date };
  notifications: NotificationData[];
  groupedByType: Map<NotificationType, NotificationData[]>;
  totalCount: number;
  summary: string;
}

export interface NotificationBadge {
  total: number;
  byType: Partial<Record<NotificationType, number>>;
  highPriority: number;
}

export interface NotificationQueryFilters {
  orgId: string;
  recipientId: string;
  types?: NotificationType[];
  read?: boolean;
  archived?: boolean;
  priority?: NotificationPriority[];
  startDate?: Date;
  endDate?: Date;
}

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

export const MAX_NOTIFICATION_TITLE_LENGTH = 200;
export const MAX_NOTIFICATION_BODY_LENGTH = 1000;
export const DEFAULT_DIGEST_FREQUENCY = 'daily';
export const MAX_NOTIFICATIONS_PER_PAGE = 50;

/** Default channels per notification type */
export const DEFAULT_CHANNELS: Record<NotificationType, NotificationChannel[]> =
  {
    comment_mention: ['in_app', 'email'],
    comment_reply: ['in_app'],
    comment_resolved: ['in_app'],
    share_received: ['in_app', 'email'],
    share_accessed: ['in_app'],
    invite_received: ['in_app', 'email'],
    invite_accepted: ['in_app'],
    role_changed: ['in_app', 'email'],
    approval_requested: ['in_app', 'email'],
    approval_approved: ['in_app', 'email'],
    approval_rejected: ['in_app', 'email'],
    approval_changes_requested: ['in_app', 'email'],
    asset_uploaded: ['in_app'],
    asset_deleted: ['in_app'],
    ai_complete: ['in_app'],
    system_announcement: ['in_app', 'email'],
  };

/** Priority for each notification type */
export const TYPE_PRIORITY: Record<NotificationType, NotificationPriority> = {
  comment_mention: 'normal',
  comment_reply: 'low',
  comment_resolved: 'low',
  share_received: 'normal',
  share_accessed: 'low',
  invite_received: 'high',
  invite_accepted: 'normal',
  role_changed: 'high',
  approval_requested: 'high',
  approval_approved: 'normal',
  approval_rejected: 'high',
  approval_changes_requested: 'high',
  asset_uploaded: 'low',
  asset_deleted: 'normal',
  ai_complete: 'low',
  system_announcement: 'urgent',
};

/** Human-readable labels for notification types */
export const TYPE_LABELS: Record<NotificationType, string> = {
  comment_mention: 'Mentioned in comment',
  comment_reply: 'Reply to comment',
  comment_resolved: 'Comment resolved',
  share_received: 'Shared with you',
  share_accessed: 'Share link accessed',
  invite_received: 'Team invitation',
  invite_accepted: 'Invitation accepted',
  role_changed: 'Role changed',
  approval_requested: 'Approval requested',
  approval_approved: 'Asset approved',
  approval_rejected: 'Asset rejected',
  approval_changes_requested: 'Changes requested',
  asset_uploaded: 'Asset uploaded',
  asset_deleted: 'Asset deleted',
  ai_complete: 'AI processing complete',
  system_announcement: 'System announcement',
};

/** Notification type icon mapping (Lucide icon names) */
export const TYPE_ICONS: Record<NotificationType, string> = {
  comment_mention: 'at-sign',
  comment_reply: 'message-circle',
  comment_resolved: 'check-circle',
  share_received: 'share-2',
  share_accessed: 'eye',
  invite_received: 'user-plus',
  invite_accepted: 'user-check',
  role_changed: 'shield',
  approval_requested: 'clock',
  approval_approved: 'check',
  approval_rejected: 'x',
  approval_changes_requested: 'edit',
  asset_uploaded: 'upload',
  asset_deleted: 'trash',
  ai_complete: 'sparkles',
  system_announcement: 'bell',
};

/* ══════════════════════════════════════════════════════════════════════════
   ID counter (resettable for testing)
   ══════════════════════════════════════════════════════════════════════════ */

let nextNotificationId = 1;

export function resetNotificationIdCounter(): void {
  nextNotificationId = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   Notification CRUD
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a new notification with validation.
 */
export function createNotification(input: NotificationCreateInput): {
  notification: NotificationData | null;
  error?: string;
} {
  if (!input.orgId) {
    return { notification: null, error: 'orgId is required' };
  }
  if (!input.recipientId) {
    return { notification: null, error: 'recipientId is required' };
  }
  if (!input.type) {
    return { notification: null, error: 'type is required' };
  }

  const title = input.title.trim();
  if (!title) {
    return { notification: null, error: 'title is required' };
  }
  if (title.length > MAX_NOTIFICATION_TITLE_LENGTH) {
    return {
      notification: null,
      error: `Title exceeds maximum length of ${MAX_NOTIFICATION_TITLE_LENGTH} characters`,
    };
  }

  const body = input.body.trim();
  if (body.length > MAX_NOTIFICATION_BODY_LENGTH) {
    return {
      notification: null,
      error: `Body exceeds maximum length of ${MAX_NOTIFICATION_BODY_LENGTH} characters`,
    };
  }

  // Don't send notifications to yourself
  if (input.actorId && input.actorId === input.recipientId) {
    return {
      notification: null,
      error: 'Cannot send notification to yourself',
    };
  }

  const priority = input.priority ?? TYPE_PRIORITY[input.type] ?? 'normal';

  const notification: NotificationData = {
    id: `ntf-${nextNotificationId++}`,
    orgId: input.orgId,
    recipientId: input.recipientId,
    type: input.type,
    title,
    body,
    link: input.link,
    actorId: input.actorId,
    actorName: input.actorName,
    actorAvatarUrl: input.actorAvatarUrl,
    targetType: input.targetType,
    targetId: input.targetId,
    priority,
    read: false,
    readAt: null,
    archivedAt: null,
    createdAt: new Date(),
    groupKey: input.groupKey,
    metadata: input.metadata ?? {},
  };

  return { notification };
}

/**
 * Create notifications for multiple recipients (batch).
 */
export function createBulkNotifications(
  input: Omit<NotificationCreateInput, 'recipientId'>,
  recipientIds: string[],
): { notifications: NotificationData[]; errors: string[] } {
  const notifications: NotificationData[] = [];
  const errors: string[] = [];

  for (const recipientId of recipientIds) {
    const result = createNotification({ ...input, recipientId });
    if (result.notification) {
      notifications.push(result.notification);
    } else if (result.error) {
      errors.push(`${recipientId}: ${result.error}`);
    }
  }

  return { notifications, errors };
}

/* ══════════════════════════════════════════════════════════════════════════
   Read / Archive State
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Mark a notification as read.
 */
export function markAsRead(notification: NotificationData): NotificationData {
  if (notification.read) return notification;
  return {
    ...notification,
    read: true,
    readAt: new Date(),
  };
}

/**
 * Mark a notification as unread.
 */
export function markAsUnread(notification: NotificationData): NotificationData {
  if (!notification.read) return notification;
  return {
    ...notification,
    read: false,
    readAt: null,
  };
}

/**
 * Mark all notifications as read (batch).
 */
export function markAllAsRead(
  notifications: NotificationData[],
): NotificationData[] {
  return notifications.map(markAsRead);
}

/**
 * Archive a notification.
 */
export function archiveNotification(
  notification: NotificationData,
): NotificationData {
  if (notification.archivedAt) return notification;
  return {
    ...notification,
    archivedAt: new Date(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Badge Counts
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Calculate notification badge counts (unread notifications).
 */
export function calculateBadge(
  notifications: NotificationData[],
): NotificationBadge {
  const unread = notifications.filter((n) => !n.read && !n.archivedAt);

  const byType: Partial<Record<NotificationType, number>> = {};
  let highPriority = 0;

  for (const n of unread) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
    if (n.priority === 'high' || n.priority === 'urgent') {
      highPriority++;
    }
  }

  return {
    total: unread.length,
    byType,
    highPriority,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Preference Management
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create default notification preferences for a user.
 */
export function createDefaultPreferences(
  userId: string,
): NotificationPreferences {
  return {
    userId,
    channels: { ...DEFAULT_CHANNELS },
    muted: false,
    digestFrequency: 'daily',
  };
}

/**
 * Check if a notification should be delivered on a specific channel
 * based on user preferences.
 */
export function shouldDeliver(
  prefs: NotificationPreferences,
  type: NotificationType,
  channel: NotificationChannel,
): boolean {
  // Global mute
  if (prefs.muted) return false;

  // Check quiet hours
  if (channel !== 'in_app' && isInQuietHours(prefs)) {
    return false;
  }

  // Check type-specific channel preferences
  const channels = prefs.channels[type] ?? DEFAULT_CHANNELS[type] ?? ['in_app'];
  return channels.includes(channel);
}

/**
 * Check if current time is within quiet hours.
 */
export function isInQuietHours(
  prefs: NotificationPreferences,
  now: Date = new Date(),
): boolean {
  if (!prefs.quietHoursStart || !prefs.quietHoursEnd) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
  const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day: e.g., 22:00 - 23:00
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Crosses midnight: e.g., 22:00 - 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

/**
 * Update notification preferences (partial update).
 */
export function updatePreferences(
  current: NotificationPreferences,
  updates: Partial<Omit<NotificationPreferences, 'userId'>>,
): NotificationPreferences {
  return {
    ...current,
    ...updates,
    channels: updates.channels
      ? { ...current.channels, ...updates.channels }
      : current.channels,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Digest Builder
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a notification digest from a list of notifications within a period.
 */
export function buildDigest(
  recipientId: string,
  notifications: NotificationData[],
  period: { start: Date; end: Date },
): NotificationDigest {
  const filtered = notifications.filter(
    (n) =>
      n.recipientId === recipientId &&
      n.createdAt >= period.start &&
      n.createdAt <= period.end,
  );

  const groupedByType = new Map<NotificationType, NotificationData[]>();
  for (const n of filtered) {
    const existing = groupedByType.get(n.type) ?? [];
    existing.push(n);
    groupedByType.set(n.type, existing);
  }

  const summary = buildDigestSummary(filtered, groupedByType);

  return {
    recipientId,
    period,
    notifications: filtered,
    groupedByType,
    totalCount: filtered.length,
    summary,
  };
}

/**
 * Generate a human-readable summary for a notification digest.
 */
export function buildDigestSummary(
  notifications: NotificationData[],
  groupedByType: Map<NotificationType, NotificationData[]>,
): string {
  if (notifications.length === 0) {
    return 'No new notifications.';
  }

  const parts: string[] = [];
  for (const [type, items] of groupedByType) {
    const label = TYPE_LABELS[type] ?? type;
    parts.push(`${items.length} ${label.toLowerCase()}`);
  }

  return `You have ${notifications.length} new notification${notifications.length === 1 ? '' : 's'}: ${parts.join(', ')}.`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Query Builder
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a MongoDB-compatible query from notification filters.
 */
export function buildNotificationQuery(
  filters: NotificationQueryFilters,
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    orgId: filters.orgId,
    recipientId: filters.recipientId,
  };

  if (filters.types && filters.types.length > 0) {
    query.type = { $in: filters.types };
  }

  if (filters.read !== undefined) {
    query.read = filters.read;
  }

  if (filters.archived !== undefined) {
    query.archivedAt = filters.archived ? { $ne: null } : null;
  }

  if (filters.priority && filters.priority.length > 0) {
    query.priority = { $in: filters.priority };
  }

  if (filters.startDate || filters.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter.$gte = filters.startDate;
    if (filters.endDate) dateFilter.$lte = filters.endDate;
    query.createdAt = dateFilter;
  }

  return query;
}

/* ══════════════════════════════════════════════════════════════════════════
   Deduplication
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Deduplicate notifications by groupKey within a time window.
 * Returns only the latest notification per groupKey.
 */
export function deduplicateNotifications(
  notifications: NotificationData[],
  windowMs: number = 5 * 60 * 1000, // 5 minutes
): NotificationData[] {
  const groups = new Map<string, NotificationData>();

  // Sort newest first
  const sorted = [...notifications].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  for (const n of sorted) {
    if (!n.groupKey) {
      // No group key — always include
      groups.set(n.id, n);
      continue;
    }

    const existing = groups.get(n.groupKey);
    if (!existing) {
      groups.set(n.groupKey, n);
    } else {
      // Within dedup window? Skip (already have the newest)
      const diff = existing.createdAt.getTime() - n.createdAt.getTime();
      if (diff > windowMs) {
        // Outside window — keep both (use ID as key)
        groups.set(n.id, n);
      }
      // Else: within window, skip
    }
  }

  return Array.from(groups.values()).sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/**
 * Format a notification for display in the UI.
 */
export function formatNotificationDisplay(notification: NotificationData): {
  icon: string;
  label: string;
  timeAgo: string;
  priorityColor: string;
} {
  const icon = TYPE_ICONS[notification.type] ?? 'bell';
  const label = TYPE_LABELS[notification.type] ?? notification.type;

  const now = new Date();
  const diffMs = now.getTime() - notification.createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  let timeAgo: string;
  if (diffMinutes < 1) timeAgo = 'just now';
  else if (diffMinutes < 60) timeAgo = `${diffMinutes}m ago`;
  else if (diffMinutes < 1440) timeAgo = `${Math.floor(diffMinutes / 60)}h ago`;
  else timeAgo = `${Math.floor(diffMinutes / 1440)}d ago`;

  const priorityColors: Record<NotificationPriority, string> = {
    low: 'text-muted-foreground',
    normal: 'text-foreground',
    high: 'text-orange-500',
    urgent: 'text-red-500',
  };

  return {
    icon,
    label,
    timeAgo,
    priorityColor: priorityColors[notification.priority],
  };
}
