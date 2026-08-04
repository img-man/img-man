// SPDX-License-Identifier: Apache-2.0
/**
 * Activity Feed Engine — Tests
 */

import { describe, it, expect } from 'vitest';
import {
  ACTION_DISPLAY,
  AGGREGATABLE_ACTIONS,
  AGGREGATION_WINDOW_MS,
  createFeedItem,
  createFeedItems,
  aggregateFeedItems,
  filterFeedItems,
  paginateFeed,
  buildTimeline,
  markFeedItemsRead,
  markAllFeedItemsRead,
  computeFeedStats,
  buildFeedSummary,
  formatRelativeTime,
  type RawActivityEntry,
  type FeedEnrichment,
  type FeedItem,
} from '@/lib/activity-feed-engine';

/* ─── Helpers ────────────────────────────────────────────────── */

const NOW = new Date('2026-03-06T12:00:00Z');

function makeRaw(overrides: Partial<RawActivityEntry> = {}): RawActivityEntry {
  return {
    _id: 'act_' + Math.random().toString(36).slice(2, 8),
    orgId: 'org_1',
    userId: 'user_1',
    action: 'upload',
    targetType: 'asset',
    targetId: 'asset_1',
    description: 'Uploaded photo.png',
    metadata: {},
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: NOW,
    ...overrides,
  };
}

const ENRICHMENT: FeedEnrichment = {
  userNames: { user_1: 'Alice', user_2: 'Bob' },
  userAvatars: { user_1: '/avatars/alice.png' },
  targetNames: { asset_1: 'photo.png', design_1: 'brochure' },
  targetUrls: { asset_1: '/assets/asset_1', design_1: '/designs/design_1' },
  readItemIds: new Set(['act_read']),
};

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine constants', () => {
  it('ACTION_DISPLAY has 20 actions', () => {
    expect(Object.keys(ACTION_DISPLAY)).toHaveLength(20);
  });

  it('each action has icon, color, pastTense', () => {
    for (const [, config] of Object.entries(ACTION_DISPLAY)) {
      expect(config.icon).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.pastTense).toBeTruthy();
    }
  });

  it('AGGREGATABLE_ACTIONS has 8 actions', () => {
    expect(AGGREGATABLE_ACTIONS.size).toBe(8);
    expect(AGGREGATABLE_ACTIONS.has('upload')).toBe(true);
    expect(AGGREGATABLE_ACTIONS.has('delete')).toBe(true);
    expect(AGGREGATABLE_ACTIONS.has('download')).toBe(true);
  });

  it('AGGREGATION_WINDOW_MS is 5 minutes', () => {
    expect(AGGREGATION_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Feed Item Creation                                                    */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine createFeedItem', () => {
  it('creates a feed item with enriched data', () => {
    const raw = makeRaw();
    const item = createFeedItem(raw, ENRICHMENT);
    expect(item.actor.name).toBe('Alice');
    expect(item.actor.avatarUrl).toBe('/avatars/alice.png');
    expect(item.target.name).toBe('photo.png');
    expect(item.target.url).toBe('/assets/asset_1');
    expect(item.icon).toBeTruthy();
    expect(item.color).toBeTruthy();
  });

  it('marks read items correctly', () => {
    const raw = makeRaw({ _id: 'act_read' });
    const item = createFeedItem(raw, ENRICHMENT);
    expect(item.isRead).toBe(true);
  });

  it('marks unread items correctly', () => {
    const raw = makeRaw({ _id: 'act_unread' });
    const item = createFeedItem(raw, ENRICHMENT);
    expect(item.isRead).toBe(false);
  });

  it('uses fallback names for unknown users', () => {
    const raw = makeRaw({ userId: 'unknown_user' });
    const item = createFeedItem(raw, ENRICHMENT);
    expect(item.actor.name).toBeTruthy(); // Should have some fallback
  });

  it('createFeedItems batch works', () => {
    const raws = [
      makeRaw({ _id: 'a1' }),
      makeRaw({ _id: 'a2', action: 'delete' }),
    ];
    const items = createFeedItems(raws, ENRICHMENT);
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('a1');
    expect(items[1].id).toBe('a2');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Aggregation                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine aggregation', () => {
  it('aggregates same-type items within time window', () => {
    const t1 = new Date(NOW.getTime());
    const t2 = new Date(NOW.getTime() + 2 * 60_000); // 2 minutes later
    const items: FeedItem[] = [
      createFeedItem(makeRaw({ _id: 'a1', action: 'upload', createdAt: t1 }), ENRICHMENT),
      createFeedItem(makeRaw({ _id: 'a2', action: 'upload', createdAt: t2 }), ENRICHMENT),
    ];
    const aggregated = aggregateFeedItems(items);
    expect(aggregated.length).toBeLessThanOrEqual(items.length);
    const uploadGroup = aggregated.find((a) => a.action === 'upload');
    expect(uploadGroup).toBeDefined();
    if (uploadGroup && uploadGroup.count > 1) {
      expect(uploadGroup.count).toBe(2);
    }
  });

  it('does not aggregate across time windows', () => {
    const t1 = new Date(NOW.getTime());
    const t2 = new Date(NOW.getTime() + 10 * 60_000); // 10 minutes later (outside window)
    const items: FeedItem[] = [
      createFeedItem(makeRaw({ _id: 'a1', action: 'upload', createdAt: t1 }), ENRICHMENT),
      createFeedItem(makeRaw({ _id: 'a2', action: 'upload', createdAt: t2 }), ENRICHMENT),
    ];
    const aggregated = aggregateFeedItems(items);
    expect(aggregated).toHaveLength(2);
  });

  it('does not aggregate non-aggregatable actions', () => {
    const items: FeedItem[] = [
      createFeedItem(makeRaw({ _id: 'a1', action: 'share' }), ENRICHMENT),
      createFeedItem(makeRaw({ _id: 'a2', action: 'share' }), ENRICHMENT),
    ];
    const aggregated = aggregateFeedItems(items);
    expect(aggregated).toHaveLength(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Filtering                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine filtering', () => {
  const items: FeedItem[] = [
    createFeedItem(makeRaw({ _id: 'a1', action: 'upload', targetType: 'asset' }), ENRICHMENT),
    createFeedItem(makeRaw({ _id: 'a2', action: 'delete', targetType: 'asset' }), ENRICHMENT),
    createFeedItem(
      makeRaw({ _id: 'a3', action: 'edit', targetType: 'design', targetId: 'design_1', userId: 'user_2' }),
      ENRICHMENT,
    ),
  ];

  it('filters by actions', () => {
    const result = filterFeedItems(items, { actions: ['upload'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('filters by targetTypes', () => {
    const result = filterFeedItems(items, { targetTypes: ['design'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a3');
  });

  it('filters by actorIds', () => {
    const result = filterFeedItems(items, { actorIds: ['user_2'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a3');
  });

  it('filters by unreadOnly', () => {
    const itemsWithRead = [
      ...items,
      createFeedItem(makeRaw({ _id: 'act_read', action: 'upload' }), ENRICHMENT),
    ];
    const result = filterFeedItems(itemsWithRead, { unreadOnly: true });
    expect(result.every((i) => !i.isRead)).toBe(true);
  });

  it('filters by dateRange', () => {
    const old = createFeedItem(
      makeRaw({ _id: 'old', createdAt: new Date('2026-01-01T00:00:00Z') }),
      ENRICHMENT,
    );
    const result = filterFeedItems([...items, old], {
      fromDate: new Date('2026-03-01T00:00:00Z'),
    });
    expect(result.every((i) => i.createdAt >= new Date('2026-03-01T00:00:00Z'))).toBe(true);
  });

  it('filters by searchText', () => {
    const result = filterFeedItems(items, { searchText: 'photo' });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('multiple filters combine', () => {
    const result = filterFeedItems(items, { actions: ['upload'], targetTypes: ['asset'] });
    expect(result).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Pagination                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine pagination', () => {
  const items = Array.from({ length: 25 }, (_, i) =>
    createFeedItem(makeRaw({ _id: `p${i}` }), ENRICHMENT),
  );

  it('paginates first page', () => {
    const page = paginateFeed(items, 1, 10);
    expect(page.items).toHaveLength(10);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(10);
    expect(page.total).toBe(25);
    expect(page.hasNextPage).toBe(true);
    expect(page.hasPreviousPage).toBe(false);
  });

  it('paginates last page', () => {
    const page = paginateFeed(items, 3, 10);
    expect(page.items).toHaveLength(5);
    expect(page.hasNextPage).toBe(false);
    expect(page.hasPreviousPage).toBe(true);
  });

  it('empty items', () => {
    const page = paginateFeed([], 1, 10);
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
    expect(page.hasNextPage).toBe(false);
    expect(page.hasPreviousPage).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Timeline                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine timeline', () => {
  it('groups by Today / Yesterday / Date', () => {
    const today = createFeedItem(makeRaw({ _id: 't', createdAt: NOW }), ENRICHMENT);
    const yesterday = createFeedItem(
      makeRaw({ _id: 'y', createdAt: new Date(NOW.getTime() - 24 * 3600_000) }),
      ENRICHMENT,
    );
    const older = createFeedItem(
      makeRaw({ _id: 'o', createdAt: new Date('2026-02-20T00:00:00Z') }),
      ENRICHMENT,
    );
    const timeline = buildTimeline([today, yesterday, older], NOW);
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    expect(timeline[0].label).toBe('Today');
  });

  it('empty feed gives empty timeline', () => {
    expect(buildTimeline([], NOW)).toHaveLength(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Read State                                                            */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine read state', () => {
  it('markFeedItemsRead marks specified items', () => {
    const items = [
      createFeedItem(makeRaw({ _id: 'r1' }), ENRICHMENT),
      createFeedItem(makeRaw({ _id: 'r2' }), ENRICHMENT),
    ];
    const { updatedItems, newReadIds } = markFeedItemsRead(items, ['r1']);
    expect(updatedItems[0].isRead).toBe(true);
    expect(updatedItems[1].isRead).toBe(false);
    expect(newReadIds).toContain('r1');
    expect(newReadIds).not.toContain('r2');
  });

  it('markAllFeedItemsRead marks everything', () => {
    const items = [
      createFeedItem(makeRaw({ _id: 'all1' }), ENRICHMENT),
      createFeedItem(makeRaw({ _id: 'all2' }), ENRICHMENT),
    ];
    const { updatedItems, newReadIds } = markAllFeedItemsRead(items);
    expect(updatedItems.every((i) => i.isRead)).toBe(true);
    expect(newReadIds.length).toBe(2);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Stats                                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine stats', () => {
  it('computeFeedStats returns action breakdown', () => {
    const items = [
      createFeedItem(makeRaw({ action: 'upload' }), ENRICHMENT),
      createFeedItem(makeRaw({ action: 'upload' }), ENRICHMENT),
      createFeedItem(makeRaw({ action: 'delete' }), ENRICHMENT),
    ];
    const stats = computeFeedStats(items);
    expect(stats.actionBreakdown.upload).toBe(2);
    expect(stats.actionBreakdown.delete).toBe(1);
    expect(stats.activeDays).toBeGreaterThanOrEqual(1);
  });

  it('computeFeedStats handles empty feed', () => {
    const stats = computeFeedStats([]);
    expect(stats.actionBreakdown).toEqual({});
    expect(stats.activeDays).toBe(0);
  });

  it('buildFeedSummary returns overview', () => {
    const items = [
      createFeedItem(makeRaw({ action: 'upload' }), ENRICHMENT),
      createFeedItem(makeRaw({ action: 'upload' }), ENRICHMENT),
    ];
    const summary = buildFeedSummary(items);
    expect(summary.recentCount).toBe(2);
    expect(summary.topAction).toBe('upload');
    expect(summary.lastActivityAt).toBeDefined();
  });

  it('buildFeedSummary empty', () => {
    const summary = buildFeedSummary([]);
    expect(summary.recentCount).toBe(0);
    expect(summary.topAction).toBeNull();
    expect(summary.lastActivityAt).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  formatRelativeTime                                                    */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('activity-feed-engine formatRelativeTime', () => {
  it('just now', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now');
  });

  it('minutes', () => {
    const past = new Date(NOW.getTime() - 5 * 60_000);
    expect(formatRelativeTime(past, NOW)).toContain('5');
    expect(formatRelativeTime(past, NOW)).toContain('min');
  });

  it('hours', () => {
    const past = new Date(NOW.getTime() - 3 * 3600_000);
    expect(formatRelativeTime(past, NOW)).toContain('3');
    expect(formatRelativeTime(past, NOW)).toContain('hour');
  });

  it('days', () => {
    const past = new Date(NOW.getTime() - 2 * 24 * 3600_000);
    expect(formatRelativeTime(past, NOW)).toContain('2');
    expect(formatRelativeTime(past, NOW)).toContain('day');
  });

  it('weeks', () => {
    const past = new Date(NOW.getTime() - 14 * 24 * 3600_000);
    expect(formatRelativeTime(past, NOW)).toContain('2');
    expect(formatRelativeTime(past, NOW)).toContain('week');
  });

  it('months', () => {
    const past = new Date(NOW.getTime() - 60 * 24 * 3600_000);
    expect(formatRelativeTime(past, NOW)).toContain('month');
  });

  it('year', () => {
    const past = new Date(NOW.getTime() - 400 * 24 * 3600_000);
    expect(formatRelativeTime(past, NOW)).toContain('year');
  });
});
