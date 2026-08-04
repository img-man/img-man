// SPDX-License-Identifier: Apache-2.0
/**
 * Notification Preferences — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultPreferences,
  getEffectiveChannels,
  isChannelEnabled,
  isTypeMuted,
  isInQuietHours,
  shouldSuppressForQuietHours,
  shouldDigest,
  getNextDigestTime,
  buildDigestBatch,
  checkDeliveryEligibility,
  setTypeOverride,
  removeTypeOverride,
  toggleCategoryMute,
  updateQuietHours,
  updateDigestSettings,
  validateQuietHours,
  validateDigestSettings,
  buildPreferencesSummary,
  DEFAULT_QUIET_HOURS,
  DEFAULT_DIGEST,
  type NotificationPreferences,
  type QuietHours,
  type DigestPreferences,
} from '@/lib/notification-preferences';
import type { Notification } from '@/lib/notification-engine';
import { createNotification, type CreateNotificationInput } from '@/lib/notification-engine';

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

function makeNotification(overrides: Partial<CreateNotificationInput> = {}): Notification {
  return createNotification(makeInput(overrides), NOW);
}

function defPrefs(): NotificationPreferences {
  return createDefaultPreferences('user_1', 'org_1', NOW);
}

/** Preferences with quiet hours enabled (overnight 22:00-08:00) */
function prefsWithQuietHours(): NotificationPreferences {
  return updateQuietHours(defPrefs(), { enabled: true });
}

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Defaults                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-preferences defaults', () => {
  it('createDefaultPreferences returns sane defaults', () => {
    const prefs = defPrefs();
    expect(prefs.globalMute).toBe(false);
    expect(prefs.defaultChannels).toContain('in_app');
    expect(prefs.defaultChannels).toContain('email');
    expect(prefs.mutedCategories).toHaveLength(0);
    expect(prefs.typeOverrides).toHaveLength(0);
    expect(prefs.digest.frequency).toBe('realtime');
    expect(prefs.soundEnabled).toBe(true);
    expect(prefs.desktopNotificationsEnabled).toBe(true);
  });

  it('DEFAULT_QUIET_HOURS is overnight', () => {
    expect(DEFAULT_QUIET_HOURS.startHour).toBe(22);
    expect(DEFAULT_QUIET_HOURS.endHour).toBe(8);
    expect(DEFAULT_QUIET_HOURS.bypassPriorities).toContain('urgent');
  });

  it('DEFAULT_DIGEST is realtime', () => {
    expect(DEFAULT_DIGEST.frequency).toBe('realtime');
    expect(DEFAULT_DIGEST.maxItemsPerDigest).toBe(50);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Channel Settings                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-preferences channels', () => {
  it('getEffectiveChannels returns defaults for normal type', () => {
    const prefs = defPrefs();
    const channels = getEffectiveChannels(prefs, 'asset.uploaded', 'assets');
    expect(channels.length).toBeGreaterThan(0);
    expect(channels).toContain('in_app');
  });

  it('getEffectiveChannels respects type override', () => {
    const prefs = setTypeOverride(defPrefs(), 'asset.uploaded', ['push'], false);
    const channels = getEffectiveChannels(prefs, 'asset.uploaded', 'assets');
    expect(channels).toEqual(['push']);
  });

  it('getEffectiveChannels returns empty for muted type', () => {
    const prefs = setTypeOverride(defPrefs(), 'asset.uploaded', [], true);
    const channels = getEffectiveChannels(prefs, 'asset.uploaded', 'assets');
    expect(channels).toHaveLength(0);
  });

  it('isChannelEnabled returns correct results', () => {
    const prefs = defPrefs();
    expect(isChannelEnabled(prefs, 'asset.uploaded', 'assets', 'in_app')).toBe(true);
  });

  it('isTypeMuted returns false by default', () => {
    const prefs = defPrefs();
    expect(isTypeMuted(prefs, 'asset.uploaded', 'assets')).toBe(false);
  });

  it('isTypeMuted returns true for muted category', () => {
    const prefs = toggleCategoryMute(defPrefs(), 'assets', true);
    expect(isTypeMuted(prefs, 'asset.uploaded', 'assets')).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Quiet Hours                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-preferences quiet hours', () => {
  const enabledQH: QuietHours = { ...DEFAULT_QUIET_HOURS, enabled: true };

  it('isInQuietHours during overnight window', () => {
    const late = new Date('2026-03-06T23:00:00Z');
    expect(isInQuietHours(enabledQH, late)).toBe(true);
  });

  it('isInQuietHours during early morning', () => {
    const early = new Date('2026-03-06T05:00:00Z');
    expect(isInQuietHours(enabledQH, early)).toBe(true);
  });

  it('not in quiet hours during daytime', () => {
    const day = new Date('2026-03-06T14:00:00Z');
    expect(isInQuietHours(enabledQH, day)).toBe(false);
  });

  it('isInQuietHours disabled', () => {
    expect(isInQuietHours(DEFAULT_QUIET_HOURS, new Date('2026-03-06T23:00:00Z'))).toBe(false);
  });

  it('shouldSuppressForQuietHours suppresses normal', () => {
    const prefs = prefsWithQuietHours();
    const late = new Date('2026-03-06T23:00:00Z');
    expect(shouldSuppressForQuietHours(prefs, 'normal', late)).toBe(true);
  });

  it('shouldSuppressForQuietHours bypasses urgent', () => {
    const prefs = prefsWithQuietHours();
    const late = new Date('2026-03-06T23:00:00Z');
    expect(shouldSuppressForQuietHours(prefs, 'urgent', late)).toBe(false);
  });

  it('validateQuietHours validates valid hours', () => {
    const result = validateQuietHours(enabledQH);
    expect(result.valid).toBe(true);
  });

  it('validateQuietHours rejects invalid hours', () => {
    const bad: QuietHours = { ...enabledQH, startHour: 25 };
    const result = validateQuietHours(bad);
    expect(result.valid).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Digest                                                                */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-preferences digest', () => {
  it('shouldDigest returns false for realtime', () => {
    const prefs = defPrefs();
    expect(shouldDigest(prefs, 'email')).toBe(false);
  });

  it('shouldDigest returns true for daily with enabled digest', () => {
    const prefs = updateDigestSettings(defPrefs(), { enabled: true, frequency: 'daily' });
    expect(shouldDigest(prefs, 'email')).toBe(true);
  });

  it('getNextDigestTime returns null for realtime', () => {
    const prefs = defPrefs();
    expect(getNextDigestTime(prefs, NOW)).toBeNull();
  });

  it('getNextDigestTime for hourly', () => {
    const prefs = updateDigestSettings(defPrefs(), { enabled: true, frequency: 'hourly' });
    const next = getNextDigestTime(prefs, NOW);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(NOW.getTime());
    expect(next!.getTime() - NOW.getTime()).toBeLessThanOrEqual(3600_000);
  });

  it('getNextDigestTime for daily', () => {
    const prefs = updateDigestSettings(defPrefs(), {
      enabled: true,
      frequency: 'daily',
      sendHour: 9,
    });
    const next = getNextDigestTime(prefs, NOW);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('getNextDigestTime for weekly', () => {
    const prefs = updateDigestSettings(defPrefs(), {
      enabled: true,
      frequency: 'weekly',
      weeklyDay: 1,
      sendHour: 9,
    });
    const next = getNextDigestTime(prefs, NOW);
    expect(next).not.toBeNull();
    expect(next!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('buildDigestBatch respects maxItems', () => {
    const items: Notification[] = [];
    for (let i = 0; i < 60; i++) {
      // Use different types to avoid groupSimilar dedup
      items.push(makeNotification({
        targetId: `asset_${i}`,
        type: i % 2 === 0 ? 'asset.uploaded' : 'asset.shared',
        targetType: `type_${i}`,
      }));
    }
    const prefs = updateDigestSettings(defPrefs(), {
      enabled: true,
      frequency: 'daily',
      maxItemsPerDigest: 10,
      groupSimilar: false,
    });
    const batch = buildDigestBatch(prefs, items, NOW);
    expect(batch.notifications.length).toBeLessThanOrEqual(10);
    expect(batch.truncated).toBe(true);
  });

  it('buildDigestBatch groups similar when enabled', () => {
    const items = [
      makeNotification({ targetId: 'a1' }),
      makeNotification({ targetId: 'a2' }),
    ];
    const prefs = updateDigestSettings(defPrefs(), {
      enabled: true,
      frequency: 'daily',
      groupSimilar: true,
    });
    const batch = buildDigestBatch(prefs, items, NOW);
    expect(batch.notifications.length).toBeLessThanOrEqual(items.length);
  });

  it('validateDigestSettings validates', () => {
    const good: DigestPreferences = { ...DEFAULT_DIGEST, frequency: 'daily', sendHour: 9 };
    expect(validateDigestSettings(good).valid).toBe(true);

    const bad: DigestPreferences = { ...DEFAULT_DIGEST, frequency: 'weekly', sendHour: 25 };
    expect(validateDigestSettings(bad).valid).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Delivery Eligibility                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-preferences delivery eligibility', () => {
  it('eligible for default prefs', () => {
    const prefs = defPrefs();
    const n = makeNotification();
    const result = checkDeliveryEligibility(prefs, n, NOW);
    expect(result.eligible).toBe(true);
    expect(result.channels.length).toBeGreaterThan(0);
  });

  it('globalMute suppresses all', () => {
    const prefs: NotificationPreferences = { ...defPrefs(), globalMute: true };
    const result = checkDeliveryEligibility(prefs, makeNotification(), NOW);
    expect(result.eligible).toBe(false);
    expect(result.suppressedReason).toBeTruthy();
  });

  it('category mute suppresses', () => {
    const prefs = toggleCategoryMute(defPrefs(), 'assets', true);
    const result = checkDeliveryEligibility(prefs, makeNotification(), NOW);
    expect(result.eligible).toBe(false);
    expect(result.suppressedReason).toBeTruthy();
  });

  it('type mute suppresses', () => {
    const prefs = setTypeOverride(defPrefs(), 'asset.uploaded', [], true);
    const result = checkDeliveryEligibility(prefs, makeNotification(), NOW);
    expect(result.eligible).toBe(false);
  });

  it('quiet hours suppress non-urgent during quiet', () => {
    const prefs = prefsWithQuietHours();
    const late = new Date('2026-03-06T23:00:00Z');
    const result = checkDeliveryEligibility(prefs, makeNotification(), late);
    // Should only have in_app (quiet hours filter out push/email from delivery)
    expect(result.channels.every((c) => c === 'in_app')).toBe(true);
  });

  it('urgent bypasses quiet hours', () => {
    const prefs = prefsWithQuietHours();
    const late = new Date('2026-03-06T23:00:00Z');
    const n = makeNotification({ type: 'billing.payment_failed' });
    const result = checkDeliveryEligibility(prefs, n, late);
    expect(result.eligible).toBe(true);
    expect(result.suppressed).toBe(false);
  });

  it('digest queued for non-realtime', () => {
    const prefs = updateDigestSettings(defPrefs(), { enabled: true, frequency: 'daily' });
    const result = checkDeliveryEligibility(prefs, makeNotification(), NOW);
    expect(result.digestQueued).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Preference Updates                                                    */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-preferences updates', () => {
  it('setTypeOverride sets override', () => {
    const prefs = setTypeOverride(defPrefs(), 'asset.uploaded', ['push'], false);
    const override = prefs.typeOverrides.find((o) => o.type === 'asset.uploaded');
    expect(override).toBeDefined();
    expect(override!.channels).toEqual(['push']);
  });

  it('removeTypeOverride removes override', () => {
    let prefs = setTypeOverride(defPrefs(), 'asset.uploaded', ['push'], false);
    prefs = removeTypeOverride(prefs, 'asset.uploaded');
    const override = prefs.typeOverrides.find((o) => o.type === 'asset.uploaded');
    expect(override).toBeUndefined();
  });

  it('toggleCategoryMute adds and removes', () => {
    let prefs = toggleCategoryMute(defPrefs(), 'billing', true);
    expect(prefs.mutedCategories).toContain('billing');
    prefs = toggleCategoryMute(prefs, 'billing', false);
    expect(prefs.mutedCategories).not.toContain('billing');
  });

  it('updateQuietHours updates', () => {
    const prefs = updateQuietHours(defPrefs(), {
      startHour: 20,
      endHour: 6,
    });
    expect(prefs.quietHours.startHour).toBe(20);
    expect(prefs.quietHours.endHour).toBe(6);
  });

  it('updateDigestSettings updates', () => {
    const prefs = updateDigestSettings(defPrefs(), {
      frequency: 'weekly',
      weeklyDay: 5,
      sendHour: 10,
    });
    expect(prefs.digest.frequency).toBe('weekly');
    expect(prefs.digest.weeklyDay).toBe(5);
    expect(prefs.digest.sendHour).toBe(10);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Summary                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('notification-preferences summary', () => {
  it('buildPreferencesSummary returns overview', () => {
    const prefs = defPrefs();
    const summary = buildPreferencesSummary(prefs);
    expect(summary.globalStatus).toBe('enabled');
    expect(summary.channelSummary).toContain('in_app');
    expect(summary.mutedCategoriesCount).toBe(0);
    expect(summary.overridesCount).toBe(0);
  });

  it('summary reflects muted categories', () => {
    const prefs = toggleCategoryMute(
      toggleCategoryMute(defPrefs(), 'billing', true),
      'system',
      true,
    );
    const summary = buildPreferencesSummary(prefs);
    expect(summary.mutedCategoriesCount).toBe(2);
  });
});
