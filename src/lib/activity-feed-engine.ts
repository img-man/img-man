// SPDX-License-Identifier: Apache-2.0
/**
 * Activity Feed Engine — Sprint 16.4
 *
 * Pure-function helpers for building, filtering, aggregating, and
 * displaying activity feeds for organisations and users.
 *
 * Responsibilities:
 * - Transform raw activity-log entries into feed items
 * - Aggregate similar activities (batch uploads, bulk edits)
 * - Filter and paginate feeds by type, actor, date, target
 * - Generate human-readable feed descriptions
 * - Track read/unread state per user
 * - Build timeline views with date grouping
 *
 * No database calls — accepts plain data and returns feed results.
 */

import type {
  ActivityAction,
  ActivityTargetType,
} from '@/models/activity-log';

/* ─── Feed Item Types ────────────────────────────────────────── */

/** A processed activity feed item (display-ready) */
export interface FeedItem {
  id: string;
  orgId: string;
  userId: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  /** Human-readable description */
  description: string;
  /** Detailed description with actor and target names */
  richDescription: string;
  /** Actor display info */
  actor: FeedActor;
  /** Target display info */
  target: FeedTarget;
  /** Icon for visual display */
  icon: string;
  /** Related action colour theme */
  color: FeedColor;
  /** Extra metadata from the raw activity log */
  metadata: Record<string, unknown>;
  /** Whether this item is read by the viewing user */
  isRead: boolean;
  /** Client IP */
  ip: string;
  /** Timestamp */
  createdAt: Date;
}

/** Actor information */
export interface FeedActor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/** Target information */
export interface FeedTarget {
  id: string;
  type: ActivityTargetType;
  name: string;
  url: string | null;
}

/** Feed item color theme */
export type FeedColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray' | 'orange';

/* ─── Action Configuration ───────────────────────────────────── */

/** Display configuration for each action */
interface ActionDisplayConfig {
  icon: string;
  color: FeedColor;
  pastTense: string;
  descriptionTemplate: string;
}

export const ACTION_DISPLAY: Record<ActivityAction, ActionDisplayConfig> = {
  upload: {
    icon: '📤',
    color: 'blue',
    pastTense: 'uploaded',
    descriptionTemplate: '{{actor}} uploaded {{target}}',
  },
  delete: {
    icon: '🗑️',
    color: 'red',
    pastTense: 'deleted',
    descriptionTemplate: '{{actor}} deleted {{target}}',
  },
  edit: {
    icon: '✏️',
    color: 'blue',
    pastTense: 'edited',
    descriptionTemplate: '{{actor}} edited {{target}}',
  },
  share: {
    icon: '🔗',
    color: 'green',
    pastTense: 'shared',
    descriptionTemplate: '{{actor}} shared {{target}}',
  },
  unshare: {
    icon: '🔒',
    color: 'yellow',
    pastTense: 'unshared',
    descriptionTemplate: '{{actor}} removed sharing for {{target}}',
  },
  export: {
    icon: '📦',
    color: 'purple',
    pastTense: 'exported',
    descriptionTemplate: '{{actor}} exported {{target}}',
  },
  download: {
    icon: '⬇️',
    color: 'gray',
    pastTense: 'downloaded',
    descriptionTemplate: '{{actor}} downloaded {{target}}',
  },
  ai_process: {
    icon: '🤖',
    color: 'purple',
    pastTense: 'processed with AI',
    descriptionTemplate: '{{actor}} ran AI processing on {{target}}',
  },
  ai_generate: {
    icon: '✨',
    color: 'purple',
    pastTense: 'generated',
    descriptionTemplate: '{{actor}} generated {{target}} with AI',
  },
  move: {
    icon: '📁',
    color: 'blue',
    pastTense: 'moved',
    descriptionTemplate: '{{actor}} moved {{target}}',
  },
  rename: {
    icon: '✍️',
    color: 'blue',
    pastTense: 'renamed',
    descriptionTemplate: '{{actor}} renamed {{target}}',
  },
  star: {
    icon: '⭐',
    color: 'yellow',
    pastTense: 'starred',
    descriptionTemplate: '{{actor}} starred {{target}}',
  },
  unstar: {
    icon: '☆',
    color: 'gray',
    pastTense: 'unstarred',
    descriptionTemplate: '{{actor}} unstarred {{target}}',
  },
  tag: {
    icon: '🏷️',
    color: 'green',
    pastTense: 'tagged',
    descriptionTemplate: '{{actor}} tagged {{target}}',
  },
  create_folder: {
    icon: '📂',
    color: 'blue',
    pastTense: 'created folder',
    descriptionTemplate: '{{actor}} created folder {{target}}',
  },
  create_design: {
    icon: '🎨',
    color: 'purple',
    pastTense: 'created design',
    descriptionTemplate: '{{actor}} created design {{target}}',
  },
  update_settings: {
    icon: '⚙️',
    color: 'gray',
    pastTense: 'updated settings',
    descriptionTemplate: '{{actor}} updated {{target}}',
  },
  invite_member: {
    icon: '✉️',
    color: 'green',
    pastTense: 'invited',
    descriptionTemplate: '{{actor}} invited {{target}} to the team',
  },
  remove_member: {
    icon: '👤',
    color: 'red',
    pastTense: 'removed',
    descriptionTemplate: '{{actor}} removed {{target}} from the team',
  },
  change_role: {
    icon: '🔑',
    color: 'orange',
    pastTense: 'changed role of',
    descriptionTemplate: '{{actor}} changed the role of {{target}}',
  },
};

/* ─── Feed Item Creation ─────────────────────────────────────── */

/** Raw activity log entry (as it comes from MongoDB) */
export interface RawActivityEntry {
  _id: string;
  orgId: string;
  userId: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  description: string;
  metadata: Record<string, unknown>;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

/** Lookup maps for enriching feed items */
export interface FeedEnrichment {
  userNames: Record<string, string>;
  userAvatars: Record<string, string | null>;
  targetNames: Record<string, string>;
  targetUrls: Record<string, string | null>;
  readItemIds: Set<string>;
}

/** Transform a raw activity into a display-ready feed item */
export function createFeedItem(
  raw: RawActivityEntry,
  enrichment: FeedEnrichment,
): FeedItem {
  const config = ACTION_DISPLAY[raw.action];
  const actorName = enrichment.userNames[raw.userId] ?? 'Unknown user';
  const actorAvatar = enrichment.userAvatars[raw.userId] ?? null;
  const targetName = enrichment.targetNames[raw.targetId] ?? raw.description;
  const targetUrl = enrichment.targetUrls[raw.targetId] ?? null;

  const richDescription = config.descriptionTemplate
    .replace('{{actor}}', actorName)
    .replace('{{target}}', `"${targetName}"`);

  return {
    id: raw._id,
    orgId: raw.orgId,
    userId: raw.userId,
    action: raw.action,
    targetType: raw.targetType,
    targetId: raw.targetId,
    description: raw.description,
    richDescription,
    actor: { id: raw.userId, name: actorName, avatarUrl: actorAvatar },
    target: { id: raw.targetId, type: raw.targetType, name: targetName, url: targetUrl },
    icon: config.icon,
    color: config.color,
    metadata: raw.metadata,
    isRead: enrichment.readItemIds.has(raw._id),
    ip: raw.ip,
    createdAt: raw.createdAt,
  };
}

/** Transform a batch of raw activities */
export function createFeedItems(
  entries: RawActivityEntry[],
  enrichment: FeedEnrichment,
): FeedItem[] {
  return entries.map((e) => createFeedItem(e, enrichment));
}

/* ─── Feed Aggregation ───────────────────────────────────────── */

/** An aggregated group of similar feed items */
export interface AggregatedFeedItem {
  groupKey: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  actor: FeedActor;
  icon: string;
  color: FeedColor;
  /** e.g. "Alice uploaded 5 files" */
  summary: string;
  items: FeedItem[];
  count: number;
  latestAt: Date;
  isRead: boolean;
}

/** Time window for aggregation (in milliseconds) */
export const AGGREGATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Actions that can be aggregated into groups */
export const AGGREGATABLE_ACTIONS: Set<ActivityAction> = new Set([
  'upload',
  'delete',
  'edit',
  'move',
  'tag',
  'download',
  'star',
  'unstar',
]);

/**
 * Aggregate similar feed items by actor + action + time window.
 *
 * Items are grouped if they share the same actor, action, and target type,
 * and occur within the aggregation window of each other.
 */
export function aggregateFeedItems(
  items: FeedItem[],
  windowMs: number = AGGREGATION_WINDOW_MS,
): AggregatedFeedItem[] {
  const sorted = [...items].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const result: AggregatedFeedItem[] = [];
  const consumed = new Set<string>();

  for (const item of sorted) {
    if (consumed.has(item.id)) continue;

    if (!AGGREGATABLE_ACTIONS.has(item.action)) {
      // Non-aggregatable: emit as single item
      result.push({
        groupKey: item.id,
        action: item.action,
        targetType: item.targetType,
        actor: item.actor,
        icon: item.icon,
        color: item.color,
        summary: item.richDescription,
        items: [item],
        count: 1,
        latestAt: item.createdAt,
        isRead: item.isRead,
      });
      consumed.add(item.id);
      continue;
    }

    // Find siblings within the time window
    const siblings = sorted.filter(
      (s) =>
        !consumed.has(s.id) &&
        s.userId === item.userId &&
        s.action === item.action &&
        s.targetType === item.targetType &&
        Math.abs(s.createdAt.getTime() - item.createdAt.getTime()) <= windowMs,
    );

    for (const s of siblings) consumed.add(s.id);

    const config = ACTION_DISPLAY[item.action];
    const targetTypePlural = pluralizeTargetType(item.targetType);
    const summary =
      siblings.length === 1
        ? item.richDescription
        : `${item.actor.name} ${config.pastTense} ${siblings.length} ${targetTypePlural}`;

    result.push({
      groupKey: `${item.userId}_${item.action}_${item.targetType}_${item.createdAt.getTime()}`,
      action: item.action,
      targetType: item.targetType,
      actor: item.actor,
      icon: item.icon,
      color: item.color,
      summary,
      items: siblings,
      count: siblings.length,
      latestAt: siblings[0].createdAt,
      isRead: siblings.every((s) => s.isRead),
    });
  }

  return result;
}

/** Pluralize common target types */
function pluralizeTargetType(type: ActivityTargetType): string {
  const map: Record<ActivityTargetType, string> = {
    asset: 'assets',
    design: 'designs',
    folder: 'folders',
    team: 'team members',
    settings: 'settings',
    share_link: 'share links',
    api_key: 'API keys',
  };
  return map[type] ?? type;
}

/* ─── Feed Filtering ─────────────────────────────────────────── */

/** Filter criteria for the activity feed */
export interface FeedFilterCriteria {
  actions?: ActivityAction[];
  targetTypes?: ActivityTargetType[];
  actorIds?: string[];
  fromDate?: Date;
  toDate?: Date;
  unreadOnly?: boolean;
  searchText?: string;
}

/** Filter feed items by criteria */
export function filterFeedItems(
  items: FeedItem[],
  criteria: FeedFilterCriteria,
): FeedItem[] {
  return items.filter((item) => {
    if (criteria.actions && !criteria.actions.includes(item.action)) return false;
    if (criteria.targetTypes && !criteria.targetTypes.includes(item.targetType)) return false;
    if (criteria.actorIds && !criteria.actorIds.includes(item.userId)) return false;
    if (criteria.fromDate && item.createdAt < criteria.fromDate) return false;
    if (criteria.toDate && item.createdAt > criteria.toDate) return false;
    if (criteria.unreadOnly && item.isRead) return false;
    if (criteria.searchText) {
      const term = criteria.searchText.toLowerCase();
      const searchable = `${item.description} ${item.richDescription} ${item.actor.name} ${item.target.name}`.toLowerCase();
      if (!searchable.includes(term)) return false;
    }
    return true;
  });
}

/* ─── Pagination ─────────────────────────────────────────────── */

/** Paginated feed result */
export interface PaginatedFeed<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Paginate an array of items */
export function paginateFeed<T>(
  items: T[],
  page: number,
  pageSize: number,
): PaginatedFeed<T> {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const safePage = Math.max(1, Math.min(page, totalPages || 1));
  const start = (safePage - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return {
    items: paged,
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1,
  };
}

/* ─── Timeline View ──────────────────────────────────────────── */

/** A day group in the timeline */
export interface TimelineDay {
  date: string;  // YYYY-MM-DD
  label: string; // "Today", "Yesterday", "Mar 4, 2026"
  items: FeedItem[];
}

/** Group feed items by calendar day */
export function buildTimeline(
  items: FeedItem[],
  now: Date = new Date(),
): TimelineDay[] {
  const sorted = [...items].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const dayMap = new Map<string, FeedItem[]>();
  for (const item of sorted) {
    const dateKey = item.createdAt.toISOString().slice(0, 10);
    const existing = dayMap.get(dateKey) ?? [];
    existing.push(item);
    dayMap.set(dateKey, existing);
  }

  const todayKey = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const timeline: TimelineDay[] = [];
  for (const [dateKey, dayItems] of dayMap.entries()) {
    let label: string;
    if (dateKey === todayKey) {
      label = 'Today';
    } else if (dateKey === yesterdayKey) {
      label = 'Yesterday';
    } else {
      const d = new Date(dateKey + 'T00:00:00Z');
      label = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
    timeline.push({ date: dateKey, label, items: dayItems });
  }

  return timeline;
}

/* ─── Read State ─────────────────────────────────────────────── */

/** Mark items as read, returning updated items and new read IDs */
export function markFeedItemsRead(
  items: FeedItem[],
  itemIds: string[],
): { updatedItems: FeedItem[]; newReadIds: string[] } {
  const idsToMark = new Set(itemIds);
  const newReadIds: string[] = [];

  const updatedItems = items.map((item) => {
    if (idsToMark.has(item.id) && !item.isRead) {
      newReadIds.push(item.id);
      return { ...item, isRead: true };
    }
    return item;
  });

  return { updatedItems, newReadIds };
}

/** Mark all items as read */
export function markAllFeedItemsRead(
  items: FeedItem[],
): { updatedItems: FeedItem[]; newReadIds: string[] } {
  const newReadIds: string[] = [];
  const updatedItems = items.map((item) => {
    if (!item.isRead) {
      newReadIds.push(item.id);
      return { ...item, isRead: true };
    }
    return item;
  });
  return { updatedItems, newReadIds };
}

/* ─── Feed Statistics ────────────────────────────────────────── */

/** Activity distribution statistics */
export interface FeedStats {
  totalActivities: number;
  unreadCount: number;
  actionBreakdown: Record<string, number>;
  targetTypeBreakdown: Record<string, number>;
  topActors: Array<{ id: string; name: string; count: number }>;
  activeDays: number;
  averagePerDay: number;
  peakDay: { date: string; count: number } | null;
}

/** Compute statistics over a feed */
export function computeFeedStats(items: FeedItem[]): FeedStats {
  const actionBreakdown: Record<string, number> = {};
  const targetTypeBreakdown: Record<string, number> = {};
  const actorCounts: Record<string, { name: string; count: number }> = {};
  const dayCounts: Record<string, number> = {};
  let unreadCount = 0;

  for (const item of items) {
    actionBreakdown[item.action] = (actionBreakdown[item.action] ?? 0) + 1;
    targetTypeBreakdown[item.targetType] = (targetTypeBreakdown[item.targetType] ?? 0) + 1;

    if (!actorCounts[item.userId]) {
      actorCounts[item.userId] = { name: item.actor.name, count: 0 };
    }
    actorCounts[item.userId].count++;

    const dayKey = item.createdAt.toISOString().slice(0, 10);
    dayCounts[dayKey] = (dayCounts[dayKey] ?? 0) + 1;

    if (!item.isRead) unreadCount++;
  }

  const topActors = Object.entries(actorCounts)
    .map(([id, { name, count }]) => ({ id, name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const activeDays = Object.keys(dayCounts).length;
  const averagePerDay = activeDays > 0 ? Math.round(items.length / activeDays) : 0;

  let peakDay: { date: string; count: number } | null = null;
  for (const [date, count] of Object.entries(dayCounts)) {
    if (!peakDay || count > peakDay.count) {
      peakDay = { date, count };
    }
  }

  return {
    totalActivities: items.length,
    unreadCount,
    actionBreakdown,
    targetTypeBreakdown,
    topActors,
    activeDays,
    averagePerDay,
    peakDay,
  };
}

/* ─── Feed Summary ───────────────────────────────────────────── */

/** Quick summary for the dashboard activity widget */
export interface FeedSummary {
  recentCount: number;
  unreadCount: number;
  topAction: string | null;
  topActor: string | null;
  lastActivityAt: Date | null;
}

export function buildFeedSummary(items: FeedItem[]): FeedSummary {
  if (items.length === 0) {
    return {
      recentCount: 0,
      unreadCount: 0,
      topAction: null,
      topActor: null,
      lastActivityAt: null,
    };
  }

  const stats = computeFeedStats(items);
  const sorted = [...items].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const topAction = Object.entries(stats.actionBreakdown).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? null;

  return {
    recentCount: items.length,
    unreadCount: stats.unreadCount,
    topAction,
    topActor: stats.topActors[0]?.name ?? null,
    lastActivityAt: sorted[0].createdAt,
  };
}

/* ─── Relative Time ──────────────────────────────────────────── */

/** Format a date as relative time ("2 hours ago", "just now") */
export function formatRelativeTime(
  date: Date,
  now: Date = new Date(),
): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}
