// SPDX-License-Identifier: Apache-2.0
/**
 * Audit Trail Query Engine
 *
 * Server-ready helpers that wire the ActivityLog model + activity-logger
 * pure functions into a cohesive audit-trail service layer:
 *
 * - Structured query execution with pagination, filtering, sorting
 * - Timeline builder: groups entries into date-bucketed timeline
 * - User activity digest: per-user summary over a date range
 * - Target history: full audit trail for a specific entity
 * - Retention policy helpers: configure per-org TTL
 * - Risk scoring: flag unusual patterns (bulk deletes, off-hours, etc.)
 *
 * Pure functions only — no MongoDB calls. Consumers pass data in.
 *
 * @see src/models/activity-log.ts
 * @see src/lib/activity-logger.ts
 */

import type { ActivityAction, ActivityTargetType } from '@/models/activity-log';

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export interface AuditEntry {
  id: string;
  orgId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  targetName?: string;
  description: string;
  metadata: Record<string, unknown>;
  ip: string;
  userAgent: string;
  createdAt: Date;
}

export interface AuditTimelineGroup {
  date: string; // YYYY-MM-DD
  label: string; // "Today", "Yesterday", "Mar 5, 2026"
  entries: AuditEntry[];
  count: number;
}

export interface UserActivityDigest {
  userId: string;
  userName?: string;
  totalActions: number;
  actionBreakdown: Record<string, number>;
  targetBreakdown: Record<string, number>;
  firstActivity: Date;
  lastActivity: Date;
  averageActionsPerDay: number;
  riskScore: number;
}

export interface TargetHistory {
  targetType: ActivityTargetType;
  targetId: string;
  targetName?: string;
  entries: AuditEntry[];
  totalEntries: number;
  uniqueUsers: number;
  firstAction: Date;
  lastAction: Date;
}

export interface RetentionPolicy {
  orgId: string;
  retentionDays: number;
  archiveEnabled: boolean;
  complianceMode: boolean; // When true, prevents deletion even after TTL
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFlag {
  level: RiskLevel;
  reason: string;
  userId: string;
  timestamp: Date;
  actionCount: number;
}

export interface AuditSearchResult {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

/** Default retention in days (90) */
export const DEFAULT_RETENTION_DAYS = 90;

/** Max retention days (730 = 2 years) */
export const MAX_RETENTION_DAYS = 730;

/** Min retention days (7) */
export const MIN_RETENTION_DAYS = 7;

/** Default page size for audit queries */
export const DEFAULT_PAGE_SIZE = 50;

/** Max page size */
export const MAX_PAGE_SIZE = 200;

/** Risk thresholds */
export const RISK_THRESHOLDS = {
  /** Bulk delete: > N deletes in 1 hour */
  bulkDeleteCount: 20,
  /** Off-hours flag: actions between 1am-5am local */
  offHoursStart: 1,
  offHoursEnd: 5,
  /** Rapid actions: > N actions in 5 minutes */
  rapidActionCount: 50,
  /** Settings changes: > N settings changes in 1 hour */
  settingsChangeCount: 10,
  /** Share spike: > N shares in 30 minutes */
  shareSpikeCount: 15,
} as const;

/** Actions considered destructive (higher risk weight) */
export const DESTRUCTIVE_ACTIONS: ReadonlySet<ActivityAction> = new Set([
  'delete',
  'unshare',
  'remove_member',
  'change_role',
]);

/** Actions considered sensitive (moderate risk weight) */
export const SENSITIVE_ACTIONS: ReadonlySet<ActivityAction> = new Set([
  'update_settings',
  'share',
  'invite_member',
  'export',
]);

/** Human-readable risk level labels */
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical Risk',
};

/** Risk level colors for UI */
export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

/* ══════════════════════════════════════════════════════════════════════════
   Timeline Builder
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Group audit entries into a date-bucketed timeline.
 * Entries must be pre-sorted by createdAt (newest first).
 */
export function buildTimeline(
  entries: AuditEntry[],
  referenceDate: Date = new Date(),
): AuditTimelineGroup[] {
  const groups = new Map<string, AuditEntry[]>();

  for (const entry of entries) {
    const dateKey = formatDateKey(entry.createdAt);
    const list = groups.get(dateKey);
    if (list) {
      list.push(entry);
    } else {
      groups.set(dateKey, [entry]);
    }
  }

  const result: AuditTimelineGroup[] = [];
  for (const [date, groupEntries] of groups) {
    result.push({
      date,
      label: formatDateLabel(date, referenceDate),
      entries: groupEntries,
      count: groupEntries.length,
    });
  }

  return result;
}

/**
 * Format a Date into YYYY-MM-DD string.
 */
export function formatDateKey(date: Date): string {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert a YYYY-MM-DD key into a human-readable label.
 * "Today", "Yesterday", or "Mar 5, 2026" etc.
 */
export function formatDateLabel(dateKey: string, referenceDate: Date = new Date()): string {
  const todayKey = formatDateKey(referenceDate);
  if (dateKey === todayKey) return 'Today';

  const yesterday = new Date(referenceDate);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);
  if (dateKey === yesterdayKey) return 'Yesterday';

  // Parse dateKey
  const [year, month, day] = dateKey.split('-').map(Number);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   User Activity Digest
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute a per-user activity digest over a set of entries.
 */
export function buildUserDigest(
  userId: string,
  entries: AuditEntry[],
  userName?: string,
): UserActivityDigest {
  const userEntries = entries.filter((e) => e.userId === userId);

  const actionBreakdown: Record<string, number> = {};
  const targetBreakdown: Record<string, number> = {};

  for (const entry of userEntries) {
    actionBreakdown[entry.action] = (actionBreakdown[entry.action] ?? 0) + 1;
    targetBreakdown[entry.targetType] =
      (targetBreakdown[entry.targetType] ?? 0) + 1;
  }

  const dates = userEntries.map((e) => new Date(e.createdAt).getTime());
  const firstActivity = dates.length ? new Date(Math.min(...dates)) : new Date();
  const lastActivity = dates.length ? new Date(Math.max(...dates)) : new Date();

  const daySpan = Math.max(
    1,
    Math.ceil(
      (lastActivity.getTime() - firstActivity.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const riskScore = computeUserRiskScore(userEntries);

  return {
    userId,
    userName,
    totalActions: userEntries.length,
    actionBreakdown,
    targetBreakdown,
    firstActivity,
    lastActivity,
    averageActionsPerDay: userEntries.length / daySpan,
    riskScore,
  };
}

/**
 * Compute digests for ALL users appearing in the entries.
 */
export function buildAllUserDigests(entries: AuditEntry[]): UserActivityDigest[] {
  const userIds = new Set(entries.map((e) => e.userId));
  const digests: UserActivityDigest[] = [];

  for (const userId of userIds) {
    const userName = entries.find((e) => e.userId === userId)?.userName;
    digests.push(buildUserDigest(userId, entries, userName));
  }

  return digests.sort((a, b) => b.totalActions - a.totalActions);
}

/* ══════════════════════════════════════════════════════════════════════════
   Target History
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build the complete audit trail for a specific target entity.
 */
export function buildTargetHistory(
  targetType: ActivityTargetType,
  targetId: string,
  entries: AuditEntry[],
  targetName?: string,
): TargetHistory {
  const filtered = entries.filter(
    (e) => e.targetType === targetType && e.targetId === targetId,
  );

  const userIds = new Set(filtered.map((e) => e.userId));
  const dates = filtered.map((e) => new Date(e.createdAt).getTime());

  return {
    targetType,
    targetId,
    targetName,
    entries: filtered,
    totalEntries: filtered.length,
    uniqueUsers: userIds.size,
    firstAction: dates.length ? new Date(Math.min(...dates)) : new Date(),
    lastAction: dates.length ? new Date(Math.max(...dates)) : new Date(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Risk Scoring
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute a risk score (0–100) for a user based on their activity patterns.
 * Higher = more suspicious.
 */
export function computeUserRiskScore(entries: AuditEntry[]): number {
  if (entries.length === 0) return 0;

  let score = 0;

  // 1. Destructive action ratio
  const destructiveCount = entries.filter((e) =>
    DESTRUCTIVE_ACTIONS.has(e.action),
  ).length;
  const destructiveRatio = destructiveCount / entries.length;
  score += destructiveRatio * 30; // max 30 points

  // 2. Bulk deletes in a short window
  const deleteEntries = entries
    .filter((e) => e.action === 'delete')
    .map((e) => new Date(e.createdAt).getTime())
    .sort((a, b) => a - b);

  if (deleteEntries.length >= RISK_THRESHOLDS.bulkDeleteCount) {
    // Check if the bulk threshold is hit within any 1-hour window
    for (let i = 0; i <= deleteEntries.length - RISK_THRESHOLDS.bulkDeleteCount; i++) {
      const windowEnd = deleteEntries[i] + 3600_000; // 1 hour
      const countInWindow = deleteEntries.filter(
        (t) => t >= deleteEntries[i] && t <= windowEnd,
      ).length;
      if (countInWindow >= RISK_THRESHOLDS.bulkDeleteCount) {
        score += 25;
        break;
      }
    }
  }

  // 3. Off-hours activity
  const offHoursCount = entries.filter((e) => {
    const hour = new Date(e.createdAt).getUTCHours();
    return (
      hour >= RISK_THRESHOLDS.offHoursStart &&
      hour < RISK_THRESHOLDS.offHoursEnd
    );
  }).length;
  const offHoursRatio = offHoursCount / entries.length;
  if (offHoursRatio > 0.5) {
    score += 15;
  } else if (offHoursRatio > 0.25) {
    score += 8;
  }

  // 4. Rapid-fire actions (> N in 5 minutes)
  const timestamps = entries
    .map((e) => new Date(e.createdAt).getTime())
    .sort((a, b) => a - b);
  for (let i = 0; i <= timestamps.length - RISK_THRESHOLDS.rapidActionCount; i++) {
    const windowEnd = timestamps[i] + 5 * 60_000; // 5 minutes
    const countInWindow = timestamps.filter(
      (t) => t >= timestamps[i] && t <= windowEnd,
    ).length;
    if (countInWindow >= RISK_THRESHOLDS.rapidActionCount) {
      score += 20;
      break;
    }
  }

  // 5. Sensitive action concentration
  const sensitiveCount = entries.filter((e) =>
    SENSITIVE_ACTIONS.has(e.action),
  ).length;
  const sensitiveRatio = sensitiveCount / entries.length;
  if (sensitiveRatio > 0.5) {
    score += 10;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Classify a numeric risk score into a risk level.
 */
export function classifyRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 45) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/**
 * Detect risk flags across ALL users in an entry set.
 */
export function detectRiskFlags(entries: AuditEntry[]): RiskFlag[] {
  const flags: RiskFlag[] = [];
  const userIds = new Set(entries.map((e) => e.userId));

  for (const userId of userIds) {
    const userEntries = entries.filter((e) => e.userId === userId);
    const score = computeUserRiskScore(userEntries);
    const level = classifyRiskLevel(score);

    if (level !== 'low') {
      const lastEntry = userEntries[0]; // newest first assumption
      flags.push({
        level,
        reason: buildRiskReason(userEntries, level),
        userId,
        timestamp: lastEntry ? new Date(lastEntry.createdAt) : new Date(),
        actionCount: userEntries.length,
      });
    }
  }

  return flags.sort(
    (a, b) => riskLevelWeight(b.level) - riskLevelWeight(a.level),
  );
}

function riskLevelWeight(level: RiskLevel): number {
  const weights: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return weights[level];
}

function buildRiskReason(entries: AuditEntry[], level: RiskLevel): string {
  const destructiveCount = entries.filter((e) =>
    DESTRUCTIVE_ACTIONS.has(e.action),
  ).length;
  const deleteCount = entries.filter((e) => e.action === 'delete').length;

  if (level === 'critical') {
    if (deleteCount >= RISK_THRESHOLDS.bulkDeleteCount) {
      return `Bulk deletion detected: ${deleteCount} deletes in audit window`;
    }
    return `Critical risk pattern: ${destructiveCount} destructive actions out of ${entries.length} total`;
  }
  if (level === 'high') {
    return `High risk: ${destructiveCount} destructive and ${entries.length - destructiveCount} other actions`;
  }
  return `Medium risk: elevated activity with ${entries.length} actions`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Retention Policy
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a retention policy with defaults.
 */
export function createRetentionPolicy(
  orgId: string,
  overrides?: Partial<Omit<RetentionPolicy, 'orgId'>>,
): RetentionPolicy {
  return {
    orgId,
    retentionDays: overrides?.retentionDays ?? DEFAULT_RETENTION_DAYS,
    archiveEnabled: overrides?.archiveEnabled ?? false,
    complianceMode: overrides?.complianceMode ?? false,
  };
}

/**
 * Validate retention days within allowed range.
 */
export function validateRetentionDays(days: number): number {
  return Math.max(MIN_RETENTION_DAYS, Math.min(MAX_RETENTION_DAYS, Math.round(days)));
}

/**
 * Compute which entries should be purged based on policy.
 * Returns entries that are PAST the retention window.
 */
export function findExpiredEntries(
  entries: AuditEntry[],
  policy: RetentionPolicy,
  referenceDate: Date = new Date(),
): AuditEntry[] {
  if (policy.complianceMode) return []; // Never purge in compliance mode

  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - policy.retentionDays);

  return entries.filter((e) => new Date(e.createdAt) < cutoff);
}

/* ══════════════════════════════════════════════════════════════════════════
   Pagination Helpers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Paginate an in-memory array of audit entries.
 */
export function paginateEntries(
  entries: AuditEntry[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): AuditSearchResult {
  const safePageSize = Math.max(1, Math.min(pageSize, MAX_PAGE_SIZE));
  const safePage = Math.max(1, page);
  const totalPages = Math.max(1, Math.ceil(entries.length / safePageSize));
  const start = (safePage - 1) * safePageSize;
  const pageEntries = entries.slice(start, start + safePageSize);

  return {
    entries: pageEntries,
    total: entries.length,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasMore: safePage < totalPages,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Filter & Search
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Filter audit entries by multiple criteria.
 */
export function filterEntries(
  entries: AuditEntry[],
  filters: {
    actions?: ActivityAction[];
    targetTypes?: ActivityTargetType[];
    userIds?: string[];
    startDate?: Date;
    endDate?: Date;
    search?: string;
    ipAddress?: string;
  },
): AuditEntry[] {
  let result = entries;

  if (filters.actions?.length) {
    const actionSet = new Set(filters.actions);
    result = result.filter((e) => actionSet.has(e.action));
  }

  if (filters.targetTypes?.length) {
    const typeSet = new Set(filters.targetTypes);
    result = result.filter((e) => typeSet.has(e.targetType));
  }

  if (filters.userIds?.length) {
    const userSet = new Set(filters.userIds);
    result = result.filter((e) => userSet.has(e.userId));
  }

  if (filters.startDate) {
    const start = filters.startDate.getTime();
    result = result.filter((e) => new Date(e.createdAt).getTime() >= start);
  }

  if (filters.endDate) {
    const end = filters.endDate.getTime();
    result = result.filter((e) => new Date(e.createdAt).getTime() <= end);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        (e.targetName?.toLowerCase().includes(q) ?? false) ||
        (e.userName?.toLowerCase().includes(q) ?? false) ||
        e.action.toLowerCase().includes(q),
    );
  }

  if (filters.ipAddress) {
    result = result.filter((e) => e.ip === filters.ipAddress);
  }

  return result;
}

/**
 * Count distinct values for a specific field across entries.
 */
export function countDistinct(
  entries: AuditEntry[],
  field: 'userId' | 'action' | 'targetType' | 'ip',
): number {
  const values = new Set(entries.map((e) => e[field]));
  return values.size;
}
