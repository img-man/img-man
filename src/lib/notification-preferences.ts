// SPDX-License-Identifier: Apache-2.0
/**
 * Notification Preferences Engine — Sprint 16.3
 *
 * Pure-function helpers for managing per-user notification
 * preferences including channel routing, quiet hours, digest
 * scheduling, and per-type opt-in/opt-out settings.
 *
 * Responsibilities:
 * - Define and validate per-user notification preferences
 * - Route notifications through preferred channels
 * - Apply quiet hours (suppress low-priority notifications)
 * - Build digest schedules for email batching
 * - Provide preference migration / default generation
 * - Check delivery eligibility per preference rules
 *
 * No database calls — accepts plain data and returns preference results.
 */

import type {
  NotificationType,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  Notification,
} from '@/lib/notification-engine';

/* ─── Preference Types ───────────────────────────────────────── */

/** Per-type channel override */
export interface TypeChannelOverride {
  type: NotificationType;
  channels: NotificationChannel[];
  muted: boolean;
}

/** Quiet hours window */
export interface QuietHours {
  enabled: boolean;
  startHour: number;   // 0-23 UTC
  startMinute: number;  // 0-59
  endHour: number;      // 0-23 UTC
  endMinute: number;    // 0-59
  timezone: string;     // e.g. 'America/New_York'
  /** Priorities that bypass quiet hours (e.g., urgent always sends) */
  bypassPriorities: NotificationPriority[];
}

/** Email digest preferences */
export interface DigestPreferences {
  enabled: boolean;
  frequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
  /** Day of week for weekly digests (0=Sun, 6=Sat) */
  weeklyDay: number;
  /** Hour of day to send digest (0-23 UTC) */
  sendHour: number;
  /** Combine notifications of same type into single digest entry */
  groupSimilar: boolean;
  /** Maximum notifications per digest before truncation */
  maxItemsPerDigest: number;
}

/** Complete user notification preferences */
export interface NotificationPreferences {
  userId: string;
  orgId: string;
  /** Global switch — disable all notifications */
  globalMute: boolean;
  /** Default channels when no per-type override exists */
  defaultChannels: NotificationChannel[];
  /** Per-category mute */
  mutedCategories: NotificationCategory[];
  /** Per-type overrides */
  typeOverrides: TypeChannelOverride[];
  /** Quiet hours settings */
  quietHours: QuietHours;
  /** Email digest settings */
  digest: DigestPreferences;
  /** Minimum priority for push notifications */
  pushMinimumPriority: NotificationPriority;
  /** Whether to show desktop/browser notifications */
  desktopNotificationsEnabled: boolean;
  /** Sound for in-app notifications */
  soundEnabled: boolean;
  updatedAt: Date;
}

/* ─── Defaults ───────────────────────────────────────────────── */

/** Default quiet hours config */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startHour: 22,
  startMinute: 0,
  endHour: 8,
  endMinute: 0,
  timezone: 'UTC',
  bypassPriorities: ['urgent'],
};

/** Default digest config */
export const DEFAULT_DIGEST: DigestPreferences = {
  enabled: false,
  frequency: 'realtime',
  weeklyDay: 1,
  sendHour: 9,
  groupSimilar: true,
  maxItemsPerDigest: 50,
};

/** Generate default preferences for a new user */
export function createDefaultPreferences(
  userId: string,
  orgId: string,
  now: Date = new Date(),
): NotificationPreferences {
  return {
    userId,
    orgId,
    globalMute: false,
    defaultChannels: ['in_app', 'email'],
    mutedCategories: [],
    typeOverrides: [],
    quietHours: { ...DEFAULT_QUIET_HOURS },
    digest: { ...DEFAULT_DIGEST },
    pushMinimumPriority: 'normal',
    desktopNotificationsEnabled: true,
    soundEnabled: true,
    updatedAt: now,
  };
}

/* ─── Preference Queries ─────────────────────────────────────── */

/** Get effective channels for a notification type */
export function getEffectiveChannels(
  prefs: NotificationPreferences,
  type: NotificationType,
  category: NotificationCategory,
): NotificationChannel[] {
  if (prefs.globalMute) return [];
  if (prefs.mutedCategories.includes(category)) return [];

  const override = prefs.typeOverrides.find((o) => o.type === type);
  if (override) {
    return override.muted ? [] : [...override.channels];
  }

  return [...prefs.defaultChannels];
}

/** Check if a specific channel is enabled for a type */
export function isChannelEnabled(
  prefs: NotificationPreferences,
  type: NotificationType,
  category: NotificationCategory,
  channel: NotificationChannel,
): boolean {
  return getEffectiveChannels(prefs, type, category).includes(channel);
}

/** Check if a notification type is fully muted */
export function isTypeMuted(
  prefs: NotificationPreferences,
  type: NotificationType,
  category: NotificationCategory,
): boolean {
  if (prefs.globalMute) return true;
  if (prefs.mutedCategories.includes(category)) return true;
  const override = prefs.typeOverrides.find((o) => o.type === type);
  return override?.muted === true;
}

/* ─── Quiet Hours ────────────────────────────────────────────── */

/** Convert hour:minute to minutes since midnight */
function toMinutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * Check if a given time falls within quiet hours.
 *
 * Handles overnight windows (e.g. 22:00 → 08:00).
 * Note: For simplicity, this compares against UTC. In production,
 * the `now` should be converted to the user's timezone first.
 */
export function isInQuietHours(
  quietHours: QuietHours,
  now: Date = new Date(),
): boolean {
  if (!quietHours.enabled) return false;

  const currentMinutes = toMinutesSinceMidnight(
    now.getUTCHours(),
    now.getUTCMinutes(),
  );
  const start = toMinutesSinceMidnight(quietHours.startHour, quietHours.startMinute);
  const end = toMinutesSinceMidnight(quietHours.endHour, quietHours.endMinute);

  if (start <= end) {
    // Same-day window: e.g. 09:00 → 17:00
    return currentMinutes >= start && currentMinutes < end;
  } else {
    // Overnight window: e.g. 22:00 → 08:00
    return currentMinutes >= start || currentMinutes < end;
  }
}

/** Check if a notification should be suppressed by quiet hours */
export function shouldSuppressForQuietHours(
  prefs: NotificationPreferences,
  priority: NotificationPriority,
  now: Date = new Date(),
): boolean {
  if (!prefs.quietHours.enabled) return false;
  if (prefs.quietHours.bypassPriorities.includes(priority)) return false;
  return isInQuietHours(prefs.quietHours, now);
}

/* ─── Digest Scheduling ──────────────────────────────────────── */

/** Check if a notification should be batched into a digest */
export function shouldDigest(
  prefs: NotificationPreferences,
  channel: NotificationChannel,
): boolean {
  if (!prefs.digest.enabled) return false;
  if (prefs.digest.frequency === 'realtime') return false;
  return channel === 'email';
}

/** Calculate the next digest send time */
export function getNextDigestTime(
  prefs: NotificationPreferences,
  now: Date = new Date(),
): Date | null {
  if (!prefs.digest.enabled || prefs.digest.frequency === 'realtime') {
    return null;
  }

  const sendHour = prefs.digest.sendHour;

  switch (prefs.digest.frequency) {
    case 'hourly': {
      const next = new Date(now);
      next.setUTCMinutes(0, 0, 0);
      next.setUTCHours(next.getUTCHours() + 1);
      return next;
    }
    case 'daily': {
      const next = new Date(now);
      next.setUTCHours(sendHour, 0, 0, 0);
      if (next <= now) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      return next;
    }
    case 'weekly': {
      const next = new Date(now);
      next.setUTCHours(sendHour, 0, 0, 0);
      const dayDiff = (prefs.digest.weeklyDay - next.getUTCDay() + 7) % 7;
      if (dayDiff === 0 && next <= now) {
        next.setUTCDate(next.getUTCDate() + 7);
      } else {
        next.setUTCDate(next.getUTCDate() + dayDiff);
      }
      return next;
    }
    default:
      return null;
  }
}

/** Build a digest batch from pending notifications */
export interface DigestBatch {
  userId: string;
  orgId: string;
  notifications: Notification[];
  groupedCount: number;
  truncated: boolean;
  scheduledFor: Date;
}

export function buildDigestBatch(
  prefs: NotificationPreferences,
  pendingNotifications: Notification[],
  scheduledFor: Date,
): DigestBatch {
  let items = [...pendingNotifications];

  if (prefs.digest.groupSimilar) {
    // Deduplicate by type + targetType, keep latest
    const seen = new Map<string, Notification>();
    for (const n of items) {
      const key = `${n.type}_${n.targetType ?? 'none'}`;
      const existing = seen.get(key);
      if (!existing || n.createdAt > existing.createdAt) {
        seen.set(key, n);
      }
    }
    items = [...seen.values()];
  }

  const truncated = items.length > prefs.digest.maxItemsPerDigest;
  const limited = items.slice(0, prefs.digest.maxItemsPerDigest);

  return {
    userId: prefs.userId,
    orgId: prefs.orgId,
    notifications: limited,
    groupedCount: pendingNotifications.length,
    truncated,
    scheduledFor,
  };
}

/* ─── Delivery Eligibility ───────────────────────────────────── */

/** Result of checking delivery eligibility */
export interface DeliveryEligibility {
  eligible: boolean;
  channels: NotificationChannel[];
  suppressed: boolean;
  suppressedReason: string | null;
  digestQueued: boolean;
}

/** Full eligibility check combining all preference rules */
export function checkDeliveryEligibility(
  prefs: NotificationPreferences,
  notification: Notification,
  now: Date = new Date(),
): DeliveryEligibility {
  // Global mute
  if (prefs.globalMute) {
    return {
      eligible: false,
      channels: [],
      suppressed: true,
      suppressedReason: 'Global notifications muted',
      digestQueued: false,
    };
  }

  // Category mute
  if (prefs.mutedCategories.includes(notification.category)) {
    return {
      eligible: false,
      channels: [],
      suppressed: true,
      suppressedReason: `Category "${notification.category}" is muted`,
      digestQueued: false,
    };
  }

  // Type mute
  if (isTypeMuted(prefs, notification.type, notification.category)) {
    return {
      eligible: false,
      channels: [],
      suppressed: true,
      suppressedReason: `Notification type "${notification.type}" is muted`,
      digestQueued: false,
    };
  }

  // Get effective channels
  let channels = getEffectiveChannels(prefs, notification.type, notification.category);

  // Quiet hours suppression
  const quietSuppressed = shouldSuppressForQuietHours(prefs, notification.priority, now);
  if (quietSuppressed) {
    // During quiet hours, only deliver in_app (silently) and queue email for digest
    channels = channels.filter((ch) => ch === 'in_app');
    if (channels.length === 0) {
      return {
        eligible: false,
        channels: [],
        suppressed: true,
        suppressedReason: 'Quiet hours active',
        digestQueued: true,
      };
    }
  }

  // Push minimum priority check
  if (channels.includes('push')) {
    const priorityOrder: NotificationPriority[] = ['low', 'normal', 'high', 'urgent'];
    const minIdx = priorityOrder.indexOf(prefs.pushMinimumPriority);
    const notifIdx = priorityOrder.indexOf(notification.priority);
    if (notifIdx < minIdx) {
      channels = channels.filter((ch) => ch !== 'push');
    }
  }

  // Check if email should be digested
  const digestQueued = channels.includes('email') && shouldDigest(prefs, 'email');

  return {
    eligible: channels.length > 0,
    channels,
    suppressed: false,
    suppressedReason: null,
    digestQueued,
  };
}

/* ─── Preference Updates ─────────────────────────────────────── */

/** Update a single type override */
export function setTypeOverride(
  prefs: NotificationPreferences,
  type: NotificationType,
  channels: NotificationChannel[],
  muted: boolean,
  now: Date = new Date(),
): NotificationPreferences {
  const existing = prefs.typeOverrides.filter((o) => o.type !== type);
  return {
    ...prefs,
    typeOverrides: [...existing, { type, channels, muted }],
    updatedAt: now,
  };
}

/** Remove a type override (revert to default) */
export function removeTypeOverride(
  prefs: NotificationPreferences,
  type: NotificationType,
  now: Date = new Date(),
): NotificationPreferences {
  return {
    ...prefs,
    typeOverrides: prefs.typeOverrides.filter((o) => o.type !== type),
    updatedAt: now,
  };
}

/** Toggle a category mute */
export function toggleCategoryMute(
  prefs: NotificationPreferences,
  category: NotificationCategory,
  muted: boolean,
  now: Date = new Date(),
): NotificationPreferences {
  const current = new Set(prefs.mutedCategories);
  if (muted) {
    current.add(category);
  } else {
    current.delete(category);
  }
  return { ...prefs, mutedCategories: [...current], updatedAt: now };
}

/** Update quiet hours */
export function updateQuietHours(
  prefs: NotificationPreferences,
  quietHours: Partial<QuietHours>,
  now: Date = new Date(),
): NotificationPreferences {
  return {
    ...prefs,
    quietHours: { ...prefs.quietHours, ...quietHours },
    updatedAt: now,
  };
}

/** Update digest settings */
export function updateDigestSettings(
  prefs: NotificationPreferences,
  digest: Partial<DigestPreferences>,
  now: Date = new Date(),
): NotificationPreferences {
  return {
    ...prefs,
    digest: { ...prefs.digest, ...digest },
    updatedAt: now,
  };
}

/* ─── Validation ─────────────────────────────────────────────── */

/** Validate quiet hours configuration */
export function validateQuietHours(qh: QuietHours): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (qh.startHour < 0 || qh.startHour > 23) errors.push('Start hour must be 0-23.');
  if (qh.endHour < 0 || qh.endHour > 23) errors.push('End hour must be 0-23.');
  if (qh.startMinute < 0 || qh.startMinute > 59) errors.push('Start minute must be 0-59.');
  if (qh.endMinute < 0 || qh.endMinute > 59) errors.push('End minute must be 0-59.');
  if (!qh.timezone) errors.push('Timezone is required.');

  return { valid: errors.length === 0, errors };
}

/** Validate digest configuration */
export function validateDigestSettings(d: DigestPreferences): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const validFreqs = ['realtime', 'hourly', 'daily', 'weekly'] as const;
  if (!validFreqs.includes(d.frequency as (typeof validFreqs)[number])) {
    errors.push('Invalid frequency.');
  }
  if (d.weeklyDay < 0 || d.weeklyDay > 6) errors.push('Weekly day must be 0-6.');
  if (d.sendHour < 0 || d.sendHour > 23) errors.push('Send hour must be 0-23.');
  if (d.maxItemsPerDigest < 1 || d.maxItemsPerDigest > 200) {
    errors.push('Max items per digest must be 1-200.');
  }

  return { valid: errors.length === 0, errors };
}

/* ─── Preferences Summary ────────────────────────────────────── */

/** Human-readable summary of preferences */
export interface PreferencesSummary {
  globalStatus: 'enabled' | 'muted';
  channelSummary: string;
  mutedCategoriesCount: number;
  overridesCount: number;
  quietHoursStatus: string;
  digestStatus: string;
  pushStatus: string;
}

export function buildPreferencesSummary(
  prefs: NotificationPreferences,
): PreferencesSummary {
  return {
    globalStatus: prefs.globalMute ? 'muted' : 'enabled',
    channelSummary: prefs.defaultChannels.join(', ') || 'none',
    mutedCategoriesCount: prefs.mutedCategories.length,
    overridesCount: prefs.typeOverrides.length,
    quietHoursStatus: prefs.quietHours.enabled
      ? `${String(prefs.quietHours.startHour).padStart(2, '0')}:${String(prefs.quietHours.startMinute).padStart(2, '0')} – ${String(prefs.quietHours.endHour).padStart(2, '0')}:${String(prefs.quietHours.endMinute).padStart(2, '0')}`
      : 'Disabled',
    digestStatus: prefs.digest.enabled
      ? `${prefs.digest.frequency} at ${String(prefs.digest.sendHour).padStart(2, '0')}:00`
      : 'Disabled',
    pushStatus: `Min priority: ${prefs.pushMinimumPriority}`,
  };
}
