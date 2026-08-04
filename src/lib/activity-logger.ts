// SPDX-License-Identifier: Apache-2.0
/**
 * Activity Logger Engine — Sprint 13.1
 *
 * Provides platform-wide activity logging utilities:
 * - Log builder: create type-safe activity entries
 * - Query builder: filter/paginate/sort activity logs
 * - Description generator: human-readable summaries
 * - Export formatter: CSV and JSON export for compliance
 * - Aggregation helpers: group by user, action, date
 *
 * Note: This module provides pure functions for building
 * activity log entries and queries. Actual MongoDB persistence
 * is handled by server actions that call these helpers.
 *
 * @see src/models/activity-log.ts — The Mongoose model
 */

import type { ActivityAction, ActivityTargetType } from '@/models/activity-log';

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export interface ActivityEntryInput {
  orgId: string;
  userId: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface ActivityQueryFilters {
  orgId: string;
  userId?: string;
  actions?: ActivityAction[];
  targetTypes?: ActivityTargetType[];
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityQueryResult {
  filter: Record<string, unknown>;
  sort: Record<string, 1 | -1>;
  skip: number;
  limit: number;
}

export interface ActivityAggregation {
  key: string;
  count: number;
  percentage: number;
}

export interface ActivityExportRow {
  timestamp: string;
  user: string;
  action: string;
  targetType: string;
  targetId: string;
  description: string;
  ip: string;
  userAgent: string;
}

export interface ActivitySummary {
  totalActions: number;
  uniqueUsers: number;
  byAction: ActivityAggregation[];
  byTargetType: ActivityAggregation[];
  byUser: ActivityAggregation[];
  dateRange: { start: Date; end: Date } | null;
}

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
export const EXPORT_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/** Human-readable labels for each action type */
export const ACTION_LABELS: Record<ActivityAction, string> = {
  upload: 'Uploaded',
  delete: 'Deleted',
  edit: 'Edited',
  share: 'Shared',
  unshare: 'Unshared',
  export: 'Exported',
  download: 'Downloaded',
  ai_process: 'AI Processed',
  ai_generate: 'AI Generated',
  move: 'Moved',
  rename: 'Renamed',
  star: 'Starred',
  unstar: 'Unstarred',
  tag: 'Tagged',
  create_folder: 'Created folder',
  create_design: 'Created design',
  update_settings: 'Updated settings',
  invite_member: 'Invited member',
  remove_member: 'Removed member',
  change_role: 'Changed role',
};

/** Human-readable labels for target types */
export const TARGET_TYPE_LABELS: Record<ActivityTargetType, string> = {
  asset: 'Asset',
  design: 'Design',
  folder: 'Folder',
  team: 'Team',
  settings: 'Settings',
  share_link: 'Share Link',
  api_key: 'API Key',
};

/** Actions grouped by category for UI filtering */
export const ACTION_CATEGORIES: Record<string, ActivityAction[]> = {
  'Content Management': ['upload', 'delete', 'edit', 'move', 'rename'],
  Organization: ['star', 'unstar', 'tag', 'create_folder', 'create_design'],
  'Sharing & Export': ['share', 'unshare', 'export', 'download'],
  'AI Features': ['ai_process', 'ai_generate'],
  'Team & Settings': [
    'invite_member',
    'remove_member',
    'change_role',
    'update_settings',
  ],
};

/* ══════════════════════════════════════════════════════════════════════════
   Activity Entry Builder
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a validated activity log entry ready for database insertion.
 * Auto-generates a human-readable description if none is provided.
 */
export function buildActivityEntry(input: ActivityEntryInput): {
  entry: ActivityEntryInput;
  valid: boolean;
  error?: string;
} {
  if (!input.orgId) {
    return { entry: input, valid: false, error: 'orgId is required' };
  }
  if (!input.userId) {
    return { entry: input, valid: false, error: 'userId is required' };
  }
  if (!input.action) {
    return { entry: input, valid: false, error: 'action is required' };
  }
  if (!input.targetType) {
    return { entry: input, valid: false, error: 'targetType is required' };
  }
  if (!input.targetId) {
    return { entry: input, valid: false, error: 'targetId is required' };
  }

  // Validate action is known
  if (!(input.action in ACTION_LABELS)) {
    return {
      entry: input,
      valid: false,
      error: `Unknown action: ${input.action}`,
    };
  }

  // Validate target type is known
  if (!(input.targetType in TARGET_TYPE_LABELS)) {
    return {
      entry: input,
      valid: false,
      error: `Unknown target type: ${input.targetType}`,
    };
  }

  const description =
    input.description ||
    generateDescription(input.action, input.targetType, input.metadata);

  return {
    entry: {
      ...input,
      description,
      metadata: input.metadata ?? {},
      ip: input.ip ?? '',
      userAgent: input.userAgent ?? '',
    },
    valid: true,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Description Generator
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Generate a human-readable description for an activity action.
 */
export function generateDescription(
  action: ActivityAction,
  targetType: ActivityTargetType,
  metadata?: Record<string, unknown>,
): string {
  const actionLabel = ACTION_LABELS[action] ?? action;
  const targetLabel = TARGET_TYPE_LABELS[targetType] ?? targetType;
  const name = metadata?.name ?? metadata?.fileName ?? metadata?.title ?? '';

  if (name) {
    return `${actionLabel} ${targetLabel.toLowerCase()} "${name}"`;
  }

  return `${actionLabel} ${targetLabel.toLowerCase()}`;
}

/**
 * Generate a rich description with before/after context for edit-type actions.
 */
export function generateEditDescription(
  action: ActivityAction,
  targetType: ActivityTargetType,
  changes: { field: string; oldValue?: unknown; newValue?: unknown }[],
): string {
  const base = generateDescription(action, targetType);
  if (changes.length === 0) return base;

  const changesList = changes
    .map((c) => {
      if (c.oldValue !== undefined && c.newValue !== undefined) {
        return `${c.field}: "${String(c.oldValue)}" → "${String(c.newValue)}"`;
      }
      if (c.newValue !== undefined) {
        return `${c.field}: set to "${String(c.newValue)}"`;
      }
      return `${c.field}: cleared`;
    })
    .join(', ');

  return `${base} (${changesList})`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Query Builder
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a MongoDB-compatible query object from filter parameters.
 * Returns filter, sort, skip, and limit ready for Mongoose.
 */
export function buildActivityQuery(
  filters: ActivityQueryFilters,
  pagination: PaginationOptions = { page: 1, limit: DEFAULT_PAGE_SIZE },
): ActivityQueryResult {
  const filter: Record<string, unknown> = {};

  // Required: orgId
  filter.orgId = filters.orgId;

  // Optional: userId
  if (filters.userId) {
    filter.userId = filters.userId;
  }

  // Optional: actions filter (OR)
  if (filters.actions && filters.actions.length > 0) {
    filter.action = { $in: filters.actions };
  }

  // Optional: target types filter (OR)
  if (filters.targetTypes && filters.targetTypes.length > 0) {
    filter.targetType = { $in: filters.targetTypes };
  }

  // Optional: specific target
  if (filters.targetId) {
    filter.targetId = filters.targetId;
  }

  // Optional: date range
  if (filters.startDate || filters.endDate) {
    const dateFilter: Record<string, Date> = {};
    if (filters.startDate) dateFilter.$gte = filters.startDate;
    if (filters.endDate) dateFilter.$lte = filters.endDate;
    filter.createdAt = dateFilter;
  }

  // Optional: text search in description
  if (filters.search) {
    filter.description = { $regex: escapeRegex(filters.search), $options: 'i' };
  }

  // Clamp pagination
  const limit = Math.min(Math.max(1, pagination.limit), MAX_PAGE_SIZE);
  const page = Math.max(1, pagination.page);
  const skip = (page - 1) * limit;

  const sortDirection = pagination.sortOrder === 'asc' ? 1 : -1;

  return {
    filter,
    sort: { createdAt: sortDirection as 1 | -1 },
    skip,
    limit,
  };
}

/**
 * Escape special RegExp characters for safe use in $regex queries.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ══════════════════════════════════════════════════════════════════════════
   Aggregation Helpers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Group an array of activity log entries by a key and return counts.
 */
export function aggregateByField<T>(
  entries: T[],
  keyFn: (entry: T) => string,
): ActivityAggregation[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = keyFn(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const total = entries.length;
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      count,
      percentage: total > 0 ? Math.round((count / total) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Build a summary of activity entries.
 */
export function buildActivitySummary(
  entries: {
    action: string;
    targetType: string;
    userId: string;
    createdAt: Date;
  }[],
): ActivitySummary {
  if (entries.length === 0) {
    return {
      totalActions: 0,
      uniqueUsers: 0,
      byAction: [],
      byTargetType: [],
      byUser: [],
      dateRange: null,
    };
  }

  const uniqueUsers = new Set(entries.map((e) => e.userId)).size;

  const dates = entries.map((e) => e.createdAt.getTime());
  const dateRange = {
    start: new Date(Math.min(...dates)),
    end: new Date(Math.max(...dates)),
  };

  return {
    totalActions: entries.length,
    uniqueUsers,
    byAction: aggregateByField(entries, (e) => e.action),
    byTargetType: aggregateByField(entries, (e) => e.targetType),
    byUser: aggregateByField(entries, (e) => e.userId),
    dateRange,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Export Formatter
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Format activity log entries as CSV string.
 */
export function exportToCsv(
  entries: {
    createdAt: Date;
    userId: string;
    action: string;
    targetType: string;
    targetId: string;
    description: string;
    ip: string;
    userAgent: string;
  }[],
  userMap?: Map<string, string>,
): string {
  const header =
    'Timestamp,User,Action,Target Type,Target ID,Description,IP,User Agent';

  const rows = entries.map((e) => {
    const userName = userMap?.get(e.userId) ?? e.userId;
    return [
      formatDate(e.createdAt),
      csvEscape(userName),
      csvEscape(e.action),
      csvEscape(e.targetType),
      csvEscape(e.targetId),
      csvEscape(e.description),
      csvEscape(e.ip),
      csvEscape(e.userAgent),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Format activity log entries as structured JSON export.
 */
export function exportToJson(
  entries: {
    createdAt: Date;
    userId: string;
    action: string;
    targetType: string;
    targetId: string;
    description: string;
    ip: string;
    userAgent: string;
    metadata?: Record<string, unknown>;
  }[],
  userMap?: Map<string, string>,
): ActivityExportRow[] {
  return entries.map((e) => ({
    timestamp: formatDate(e.createdAt),
    user: userMap?.get(e.userId) ?? e.userId,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    description: e.description,
    ip: e.ip,
    userAgent: e.userAgent,
  }));
}

/* ══════════════════════════════════════════════════════════════════════════
   Date / String Helpers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Format a date as ISO-like string for export: YYYY-MM-DD HH:mm:ss
 */
export function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

/**
 * Escape a value for CSV (wrap in quotes if it contains commas, quotes, or newlines).
 */
export function csvEscape(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a relative time description (e.g., "2 hours ago").
 */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

/**
 * Group activity entries by date (YYYY-MM-DD) for timeline display.
 */
export function groupByDate<T extends { createdAt: Date }>(
  entries: T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const entry of entries) {
    const dateKey =
      entry.createdAt.getUTCFullYear() +
      '-' +
      String(entry.createdAt.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(entry.createdAt.getUTCDate()).padStart(2, '0');
    const existing = grouped.get(dateKey) ?? [];
    existing.push(entry);
    grouped.set(dateKey, existing);
  }
  return grouped;
}
