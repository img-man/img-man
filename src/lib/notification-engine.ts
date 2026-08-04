// SPDX-License-Identifier: Apache-2.0
/**
 * Notification Engine — Sprint 16.1
 *
 * Pure-function helpers for creating, routing, formatting, and
 * managing notifications across the SaaS platform.
 *
 * Responsibilities:
 * - Define notification types and channels
 * - Create and format notification payloads
 * - Route notifications to appropriate channels
 * - Prioritise and batch notifications
 * - Mark notifications as read/unread/archived
 * - Generate notification badges and counts
 * - Group related notifications intelligently
 *
 * No database calls — accepts plain data and returns notification results.
 */

/* ─── Notification Types ─────────────────────────────────────── */

/** All supported notification types */
export type NotificationType =
  // Asset events
  | 'asset.uploaded'
  | 'asset.processed'
  | 'asset.shared'
  | 'asset.deleted'
  | 'asset.comment'
  // Design events
  | 'design.shared'
  | 'design.published'
  | 'design.comment'
  // Team events
  | 'team.member_invited'
  | 'team.member_joined'
  | 'team.member_removed'
  | 'team.role_changed'
  // Billing events
  | 'billing.payment_received'
  | 'billing.payment_failed'
  | 'billing.subscription_renewed'
  | 'billing.subscription_cancelled'
  | 'billing.trial_ending'
  | 'billing.invoice_created'
  // Usage events
  | 'usage.threshold_warning'
  | 'usage.threshold_critical'
  | 'usage.limit_exceeded'
  // System events
  | 'system.maintenance'
  | 'system.feature_update'
  | 'system.security_alert'
  // AI events
  | 'ai.job_completed'
  | 'ai.credits_low';

/** Notification delivery channel */
export type NotificationChannel = 'in_app' | 'email' | 'webhook' | 'push';

/** Notification priority */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Notification status */
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'archived' | 'failed';

/** Category for grouping */
export type NotificationCategory =
  | 'assets'
  | 'designs'
  | 'team'
  | 'billing'
  | 'usage'
  | 'system'
  | 'ai';

/* ─── Notification Model ─────────────────────────────────────── */

/** A single notification */
export interface Notification {
  id: string;
  orgId: string;
  recipientId: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  status: NotificationStatus;
  title: string;
  body: string;
  icon: string;
  actionUrl: string | null;
  actionLabel: string | null;
  actorId: string | null;
  actorName: string | null;
  targetId: string | null;
  targetType: string | null;
  targetName: string | null;
  groupKey: string | null;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  archivedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

/** Notification creation input */
export interface CreateNotificationInput {
  orgId: string;
  recipientId: string;
  type: NotificationType;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  overrideTitle?: string;
  overrideBody?: string;
  overrideUrl?: string;
}

/* ─── Type Configuration ─────────────────────────────────────── */

/** Configuration for each notification type */
export interface NotificationTypeConfig {
  type: NotificationType;
  category: NotificationCategory;
  defaultPriority: NotificationPriority;
  defaultChannels: NotificationChannel[];
  icon: string;
  titleTemplate: string;
  bodyTemplate: string;
  actionUrlTemplate: string | null;
  actionLabel: string | null;
  groupable: boolean;
  expiresInHours: number | null;
}

/** Complete type configuration map */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  // ── Asset events ──
  'asset.uploaded': {
    type: 'asset.uploaded',
    category: 'assets',
    defaultPriority: 'low',
    defaultChannels: ['in_app'],
    icon: '📤',
    titleTemplate: 'Asset uploaded',
    bodyTemplate: '{{actorName}} uploaded "{{targetName}}"',
    actionUrlTemplate: '/dashboard?asset={{targetId}}',
    actionLabel: 'View asset',
    groupable: true,
    expiresInHours: 168,
  },
  'asset.processed': {
    type: 'asset.processed',
    category: 'assets',
    defaultPriority: 'low',
    defaultChannels: ['in_app'],
    icon: '✅',
    titleTemplate: 'Processing complete',
    bodyTemplate: '"{{targetName}}" has been processed and is ready',
    actionUrlTemplate: '/dashboard?asset={{targetId}}',
    actionLabel: 'View asset',
    groupable: true,
    expiresInHours: 168,
  },
  'asset.shared': {
    type: 'asset.shared',
    category: 'assets',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '🔗',
    titleTemplate: 'Asset shared with you',
    bodyTemplate: '{{actorName}} shared "{{targetName}}" with you',
    actionUrlTemplate: '/dashboard?asset={{targetId}}',
    actionLabel: 'View asset',
    groupable: false,
    expiresInHours: null,
  },
  'asset.deleted': {
    type: 'asset.deleted',
    category: 'assets',
    defaultPriority: 'low',
    defaultChannels: ['in_app'],
    icon: '🗑️',
    titleTemplate: 'Asset deleted',
    bodyTemplate: '{{actorName}} deleted "{{targetName}}"',
    actionUrlTemplate: '/dashboard/vault',
    actionLabel: 'View trash',
    groupable: true,
    expiresInHours: 72,
  },
  'asset.comment': {
    type: 'asset.comment',
    category: 'assets',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '💬',
    titleTemplate: 'New comment',
    bodyTemplate: '{{actorName}} commented on "{{targetName}}"',
    actionUrlTemplate: '/dashboard?asset={{targetId}}',
    actionLabel: 'View comment',
    groupable: true,
    expiresInHours: null,
  },

  // ── Design events ──
  'design.shared': {
    type: 'design.shared',
    category: 'designs',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '🎨',
    titleTemplate: 'Design shared with you',
    bodyTemplate: '{{actorName}} shared design "{{targetName}}" with you',
    actionUrlTemplate: '/dashboard/design-studio?id={{targetId}}',
    actionLabel: 'Open design',
    groupable: false,
    expiresInHours: null,
  },
  'design.published': {
    type: 'design.published',
    category: 'designs',
    defaultPriority: 'normal',
    defaultChannels: ['in_app'],
    icon: '🚀',
    titleTemplate: 'Design published',
    bodyTemplate: '{{actorName}} published "{{targetName}}"',
    actionUrlTemplate: '/dashboard/design-studio?id={{targetId}}',
    actionLabel: 'View design',
    groupable: false,
    expiresInHours: null,
  },
  'design.comment': {
    type: 'design.comment',
    category: 'designs',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '💬',
    titleTemplate: 'New comment on design',
    bodyTemplate: '{{actorName}} commented on "{{targetName}}"',
    actionUrlTemplate: '/dashboard/design-studio?id={{targetId}}',
    actionLabel: 'View comment',
    groupable: true,
    expiresInHours: null,
  },

  // ── Team events ──
  'team.member_invited': {
    type: 'team.member_invited',
    category: 'team',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '✉️',
    titleTemplate: 'Team invitation',
    bodyTemplate: '{{actorName}} invited {{targetName}} to the team',
    actionUrlTemplate: '/dashboard/settings/team',
    actionLabel: 'View team',
    groupable: false,
    expiresInHours: null,
  },
  'team.member_joined': {
    type: 'team.member_joined',
    category: 'team',
    defaultPriority: 'normal',
    defaultChannels: ['in_app'],
    icon: '👋',
    titleTemplate: 'New team member',
    bodyTemplate: '{{targetName}} joined the team',
    actionUrlTemplate: '/dashboard/settings/team',
    actionLabel: 'View team',
    groupable: false,
    expiresInHours: 168,
  },
  'team.member_removed': {
    type: 'team.member_removed',
    category: 'team',
    defaultPriority: 'high',
    defaultChannels: ['in_app', 'email'],
    icon: '👤',
    titleTemplate: 'Team member removed',
    bodyTemplate: '{{actorName}} removed {{targetName}} from the team',
    actionUrlTemplate: '/dashboard/settings/team',
    actionLabel: 'View team',
    groupable: false,
    expiresInHours: null,
  },
  'team.role_changed': {
    type: 'team.role_changed',
    category: 'team',
    defaultPriority: 'high',
    defaultChannels: ['in_app', 'email'],
    icon: '🔑',
    titleTemplate: 'Role updated',
    bodyTemplate: 'Your role has been changed to {{metadata.newRole}}',
    actionUrlTemplate: '/dashboard/settings/team',
    actionLabel: 'View team',
    groupable: false,
    expiresInHours: null,
  },

  // ── Billing events ──
  'billing.payment_received': {
    type: 'billing.payment_received',
    category: 'billing',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '💳',
    titleTemplate: 'Payment received',
    bodyTemplate: 'Payment of {{metadata.amount}} has been processed',
    actionUrlTemplate: '/dashboard/settings/billing',
    actionLabel: 'View billing',
    groupable: false,
    expiresInHours: null,
  },
  'billing.payment_failed': {
    type: 'billing.payment_failed',
    category: 'billing',
    defaultPriority: 'urgent',
    defaultChannels: ['in_app', 'email'],
    icon: '⚠️',
    titleTemplate: 'Payment failed',
    bodyTemplate: 'Your payment of {{metadata.amount}} has failed. Please update your payment method.',
    actionUrlTemplate: '/dashboard/settings/billing',
    actionLabel: 'Update payment',
    groupable: false,
    expiresInHours: null,
  },
  'billing.subscription_renewed': {
    type: 'billing.subscription_renewed',
    category: 'billing',
    defaultPriority: 'low',
    defaultChannels: ['in_app', 'email'],
    icon: '🔄',
    titleTemplate: 'Subscription renewed',
    bodyTemplate: 'Your {{metadata.planName}} subscription has been renewed',
    actionUrlTemplate: '/dashboard/settings/billing',
    actionLabel: 'View subscription',
    groupable: false,
    expiresInHours: null,
  },
  'billing.subscription_cancelled': {
    type: 'billing.subscription_cancelled',
    category: 'billing',
    defaultPriority: 'high',
    defaultChannels: ['in_app', 'email'],
    icon: '❌',
    titleTemplate: 'Subscription cancelled',
    bodyTemplate: 'Your subscription has been cancelled and will end on {{metadata.endDate}}',
    actionUrlTemplate: '/dashboard/settings/billing',
    actionLabel: 'View details',
    groupable: false,
    expiresInHours: null,
  },
  'billing.trial_ending': {
    type: 'billing.trial_ending',
    category: 'billing',
    defaultPriority: 'high',
    defaultChannels: ['in_app', 'email'],
    icon: '⏰',
    titleTemplate: 'Trial ending soon',
    bodyTemplate: 'Your free trial ends in {{metadata.daysRemaining}} days. Upgrade to keep access.',
    actionUrlTemplate: '/dashboard/settings/billing',
    actionLabel: 'Upgrade now',
    groupable: false,
    expiresInHours: null,
  },
  'billing.invoice_created': {
    type: 'billing.invoice_created',
    category: 'billing',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '📄',
    titleTemplate: 'New invoice',
    bodyTemplate: 'Invoice {{metadata.invoiceNumber}} for {{metadata.amount}} is ready',
    actionUrlTemplate: '/dashboard/invoices/{{targetId}}',
    actionLabel: 'View invoice',
    groupable: false,
    expiresInHours: null,
  },

  // ── Usage events ──
  'usage.threshold_warning': {
    type: 'usage.threshold_warning',
    category: 'usage',
    defaultPriority: 'normal',
    defaultChannels: ['in_app', 'email'],
    icon: '📊',
    titleTemplate: 'Usage warning',
    bodyTemplate: '{{metadata.metricLabel}} has reached {{metadata.percentage}}% of your plan limit',
    actionUrlTemplate: '/dashboard/analytics',
    actionLabel: 'View usage',
    groupable: false,
    expiresInHours: 48,
  },
  'usage.threshold_critical': {
    type: 'usage.threshold_critical',
    category: 'usage',
    defaultPriority: 'high',
    defaultChannels: ['in_app', 'email'],
    icon: '🔴',
    titleTemplate: 'Usage critical',
    bodyTemplate: '{{metadata.metricLabel}} has reached {{metadata.percentage}}% — upgrade to avoid service disruption',
    actionUrlTemplate: '/dashboard/analytics',
    actionLabel: 'Upgrade plan',
    groupable: false,
    expiresInHours: 24,
  },
  'usage.limit_exceeded': {
    type: 'usage.limit_exceeded',
    category: 'usage',
    defaultPriority: 'urgent',
    defaultChannels: ['in_app', 'email'],
    icon: '🚫',
    titleTemplate: 'Limit exceeded',
    bodyTemplate: '{{metadata.metricLabel}} has exceeded your plan limit. Some features may be restricted.',
    actionUrlTemplate: '/dashboard/settings/billing',
    actionLabel: 'Upgrade plan',
    groupable: false,
    expiresInHours: null,
  },

  // ── System events ──
  'system.maintenance': {
    type: 'system.maintenance',
    category: 'system',
    defaultPriority: 'high',
    defaultChannels: ['in_app', 'email'],
    icon: '🔧',
    titleTemplate: 'Scheduled maintenance',
    bodyTemplate: 'Maintenance scheduled for {{metadata.startTime}}. Expected duration: {{metadata.duration}}.',
    actionUrlTemplate: null,
    actionLabel: null,
    groupable: false,
    expiresInHours: null,
  },
  'system.feature_update': {
    type: 'system.feature_update',
    category: 'system',
    defaultPriority: 'low',
    defaultChannels: ['in_app'],
    icon: '✨',
    titleTemplate: 'New feature',
    bodyTemplate: '{{metadata.featureName}} is now available! {{metadata.description}}',
    actionUrlTemplate: '{{metadata.learnMoreUrl}}',
    actionLabel: 'Learn more',
    groupable: false,
    expiresInHours: 336,
  },
  'system.security_alert': {
    type: 'system.security_alert',
    category: 'system',
    defaultPriority: 'urgent',
    defaultChannels: ['in_app', 'email'],
    icon: '🛡️',
    titleTemplate: 'Security alert',
    bodyTemplate: '{{metadata.alertMessage}}',
    actionUrlTemplate: '/dashboard/settings',
    actionLabel: 'Review settings',
    groupable: false,
    expiresInHours: null,
  },

  // ── AI events ──
  'ai.job_completed': {
    type: 'ai.job_completed',
    category: 'ai',
    defaultPriority: 'low',
    defaultChannels: ['in_app'],
    icon: '🤖',
    titleTemplate: 'AI processing complete',
    bodyTemplate: '{{metadata.jobType}} completed for "{{targetName}}"',
    actionUrlTemplate: '/dashboard?asset={{targetId}}',
    actionLabel: 'View result',
    groupable: true,
    expiresInHours: 168,
  },
  'ai.credits_low': {
    type: 'ai.credits_low',
    category: 'ai',
    defaultPriority: 'high',
    defaultChannels: ['in_app', 'email'],
    icon: '⚡',
    titleTemplate: 'AI credits running low',
    bodyTemplate: 'You have {{metadata.remaining}} AI credits remaining ({{metadata.percentage}}% used)',
    actionUrlTemplate: '/dashboard/settings/billing',
    actionLabel: 'Get more credits',
    groupable: false,
    expiresInHours: 48,
  },
};

/* ─── Category Map ───────────────────────────────────────────── */

/** Map notification types to their categories */
export function getNotificationCategory(type: NotificationType): NotificationCategory {
  return NOTIFICATION_TYPE_CONFIG[type].category;
}

/** Get all notification types in a category */
export function getTypesInCategory(category: NotificationCategory): NotificationType[] {
  return (Object.keys(NOTIFICATION_TYPE_CONFIG) as NotificationType[]).filter(
    (t) => NOTIFICATION_TYPE_CONFIG[t].category === category,
  );
}

/** All notification categories with metadata */
export const NOTIFICATION_CATEGORIES: Record<
  NotificationCategory,
  { label: string; icon: string; description: string }
> = {
  assets: { label: 'Assets', icon: '🖼️', description: 'Upload, share, and processing events' },
  designs: { label: 'Designs', icon: '🎨', description: 'Design sharing and publishing' },
  team: { label: 'Team', icon: '👥', description: 'Invitations, joins, role changes' },
  billing: { label: 'Billing', icon: '💰', description: 'Payments, subscriptions, invoices' },
  usage: { label: 'Usage', icon: '📊', description: 'Quotas, limits, and overage alerts' },
  system: { label: 'System', icon: '⚙️', description: 'Maintenance, updates, security' },
  ai: { label: 'AI', icon: '🤖', description: 'AI processing and credit alerts' },
};

/* ─── Notification Creation ──────────────────────────────────── */

/** Resolve template variables `{{key}}` in a string */
export function resolveTemplate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, path: string) => {
    const parts = path.split('.');
    let value: unknown = vars;
    for (const p of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[p];
      } else {
        return '';
      }
    }
    return value != null ? String(value) : '';
  });
}

/** Build template variables from a notification input */
function buildTemplateVars(input: CreateNotificationInput): Record<string, unknown> {
  return {
    actorName: input.actorName ?? 'Someone',
    targetName: input.targetName ?? 'an item',
    targetId: input.targetId ?? '',
    targetType: input.targetType ?? '',
    metadata: input.metadata ?? {},
  };
}

/** Create a notification from typed input */
export function createNotification(
  input: CreateNotificationInput,
  now: Date = new Date(),
): Notification {
  const config = NOTIFICATION_TYPE_CONFIG[input.type];
  const vars = buildTemplateVars(input);

  const expiresAt = config.expiresInHours
    ? new Date(now.getTime() + config.expiresInHours * 3600_000)
    : null;

  return {
    id: `notif_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    orgId: input.orgId,
    recipientId: input.recipientId,
    type: input.type,
    category: config.category,
    priority: config.defaultPriority,
    channels: [...config.defaultChannels],
    status: 'pending',
    title: input.overrideTitle ?? resolveTemplate(config.titleTemplate, vars),
    body: input.overrideBody ?? resolveTemplate(config.bodyTemplate, vars),
    icon: config.icon,
    actionUrl: input.overrideUrl ?? (config.actionUrlTemplate
      ? resolveTemplate(config.actionUrlTemplate, vars)
      : null),
    actionLabel: config.actionLabel,
    actorId: input.actorId ?? null,
    actorName: input.actorName ?? null,
    targetId: input.targetId ?? null,
    targetType: input.targetType ?? null,
    targetName: input.targetName ?? null,
    groupKey: config.groupable
      ? `${input.type}_${input.orgId}_${input.targetType ?? 'unknown'}`
      : null,
    metadata: input.metadata ?? {},
    readAt: null,
    archivedAt: null,
    expiresAt,
    createdAt: now,
  };
}

/* ─── Notification State Management ──────────────────────────── */

/** Mark a notification as read */
export function markAsRead(
  notification: Notification,
  now: Date = new Date(),
): Notification {
  if (notification.status === 'archived') return notification;
  return { ...notification, status: 'read', readAt: now };
}

/** Mark a notification as archived */
export function markAsArchived(
  notification: Notification,
  now: Date = new Date(),
): Notification {
  return { ...notification, status: 'archived', archivedAt: now };
}

/** Mark all notifications as read */
export function markAllAsRead(
  notifications: Notification[],
  now: Date = new Date(),
): Notification[] {
  return notifications.map((n) =>
    n.status === 'archived' || n.status === 'read' ? n : markAsRead(n, now),
  );
}

/** Check if a notification has expired */
export function isNotificationExpired(
  notification: Notification,
  now: Date = new Date(),
): boolean {
  return notification.expiresAt !== null && now >= notification.expiresAt;
}

/** Remove expired notifications */
export function filterExpired(
  notifications: Notification[],
  now: Date = new Date(),
): Notification[] {
  return notifications.filter((n) => !isNotificationExpired(n, now));
}

/* ─── Badge Counts ───────────────────────────────────────────── */

/** Count unread notifications (not read, not archived, not expired) */
export function getUnreadCount(
  notifications: Notification[],
  now: Date = new Date(),
): number {
  return notifications.filter(
    (n) =>
      n.status !== 'read' &&
      n.status !== 'archived' &&
      !isNotificationExpired(n, now),
  ).length;
}

/** Get unread count per category */
export function getUnreadCountByCategory(
  notifications: Notification[],
  now: Date = new Date(),
): Record<NotificationCategory, number> {
  const counts: Record<NotificationCategory, number> = {
    assets: 0, designs: 0, team: 0, billing: 0, usage: 0, system: 0, ai: 0,
  };
  for (const n of notifications) {
    if (n.status !== 'read' && n.status !== 'archived' && !isNotificationExpired(n, now)) {
      counts[n.category]++;
    }
  }
  return counts;
}

/** Build a badge summary for the notification bell */
export interface NotificationBadge {
  totalUnread: number;
  hasUrgent: boolean;
  urgentCount: number;
  categoryCounts: Record<NotificationCategory, number>;
}

export function buildNotificationBadge(
  notifications: Notification[],
  now: Date = new Date(),
): NotificationBadge {
  const active = filterExpired(notifications, now).filter(
    (n) => n.status !== 'read' && n.status !== 'archived',
  );

  return {
    totalUnread: active.length,
    hasUrgent: active.some((n) => n.priority === 'urgent'),
    urgentCount: active.filter((n) => n.priority === 'urgent').length,
    categoryCounts: getUnreadCountByCategory(notifications, now),
  };
}

/* ─── Notification Grouping ──────────────────────────────────── */

/** A group of related notifications */
export interface NotificationGroup {
  groupKey: string;
  type: NotificationType;
  category: NotificationCategory;
  latestNotification: Notification;
  count: number;
  actors: string[];
  latestAt: Date;
}

/** Group notifications by their groupKey */
export function groupNotifications(
  notifications: Notification[],
): NotificationGroup[] {
  const groupMap = new Map<string, Notification[]>();
  const ungrouped: Notification[] = [];

  for (const n of notifications) {
    if (n.groupKey) {
      const existing = groupMap.get(n.groupKey) ?? [];
      existing.push(n);
      groupMap.set(n.groupKey, existing);
    } else {
      ungrouped.push(n);
    }
  }

  const groups: NotificationGroup[] = [];

  for (const [key, items] of groupMap.entries()) {
    const sorted = items.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const latest = sorted[0];
    const actors = [
      ...new Set(sorted.map((n) => n.actorName).filter(Boolean) as string[]),
    ];

    groups.push({
      groupKey: key,
      type: latest.type,
      category: latest.category,
      latestNotification: latest,
      count: sorted.length,
      actors,
      latestAt: latest.createdAt,
    });
  }

  // Add ungrouped as single-item groups
  for (const n of ungrouped) {
    groups.push({
      groupKey: n.id,
      type: n.type,
      category: n.category,
      latestNotification: n,
      count: 1,
      actors: n.actorName ? [n.actorName] : [],
      latestAt: n.createdAt,
    });
  }

  return groups.sort((a, b) => b.latestAt.getTime() - a.latestAt.getTime());
}

/* ─── Channel Routing ────────────────────────────────────────── */

/** Determine which channels to deliver a notification to */
export function routeToChannels(
  notification: Notification,
  userPreferences?: { disabledChannels?: NotificationChannel[]; disabledTypes?: NotificationType[] },
): NotificationChannel[] {
  // If user has disabled this notification type entirely, no channels
  if (userPreferences?.disabledTypes?.includes(notification.type)) {
    return [];
  }

  let channels = [...notification.channels];

  // Urgent notifications always include in_app + email
  if (notification.priority === 'urgent') {
    if (!channels.includes('in_app')) channels.push('in_app');
    if (!channels.includes('email')) channels.push('email');
  }

  // Remove user-disabled channels (except urgent in_app)
  if (userPreferences?.disabledChannels) {
    channels = channels.filter((ch) => {
      if (notification.priority === 'urgent' && ch === 'in_app') return true;
      return !userPreferences.disabledChannels!.includes(ch);
    });
  }

  return [...new Set(channels)];
}

/* ─── Filtering & Sorting ────────────────────────────────────── */

/** Filter criteria for notification queries */
export interface NotificationFilterCriteria {
  categories?: NotificationCategory[];
  types?: NotificationType[];
  priorities?: NotificationPriority[];
  statuses?: NotificationStatus[];
  unreadOnly?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

/** Filter notifications by criteria */
export function filterNotifications(
  notifications: Notification[],
  criteria: NotificationFilterCriteria,
  now: Date = new Date(),
): Notification[] {
  return notifications.filter((n) => {
    if (isNotificationExpired(n, now)) return false;
    if (criteria.categories && !criteria.categories.includes(n.category)) return false;
    if (criteria.types && !criteria.types.includes(n.type)) return false;
    if (criteria.priorities && !criteria.priorities.includes(n.priority)) return false;
    if (criteria.statuses && !criteria.statuses.includes(n.status)) return false;
    if (criteria.unreadOnly && (n.status === 'read' || n.status === 'archived')) return false;
    if (criteria.fromDate && n.createdAt < criteria.fromDate) return false;
    if (criteria.toDate && n.createdAt > criteria.toDate) return false;
    return true;
  });
}

/** Sort order */
export type NotificationSortOrder = 'newest' | 'oldest' | 'priority';

/** Priority numeric value for sorting */
const PRIORITY_ORDER: Record<NotificationPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** Sort notifications */
export function sortNotifications(
  notifications: Notification[],
  order: NotificationSortOrder = 'newest',
): Notification[] {
  const sorted = [...notifications];
  switch (order) {
    case 'newest':
      return sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    case 'oldest':
      return sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case 'priority':
      return sorted.sort((a, b) => {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (pd !== 0) return pd;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }
}

/* ─── Notification Summary ───────────────────────────────────── */

/** Summary for the notification center header */
export interface NotificationCenterSummary {
  totalCount: number;
  unreadCount: number;
  urgentCount: number;
  oldestUnread: Date | null;
  newestNotification: Date | null;
  categorySummary: Array<{
    category: NotificationCategory;
    label: string;
    icon: string;
    total: number;
    unread: number;
  }>;
}

/** Build a summary object for the notification center UI */
export function buildNotificationCenterSummary(
  notifications: Notification[],
  now: Date = new Date(),
): NotificationCenterSummary {
  const active = filterExpired(notifications, now);
  const unread = active.filter(
    (n) => n.status !== 'read' && n.status !== 'archived',
  );
  const urgent = unread.filter((n) => n.priority === 'urgent');

  const unreadSorted = unread.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const allSorted = active.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const categorySummary = (
    Object.keys(NOTIFICATION_CATEGORIES) as NotificationCategory[]
  ).map((cat) => {
    const catNotifs = active.filter((n) => n.category === cat);
    const catUnread = catNotifs.filter(
      (n) => n.status !== 'read' && n.status !== 'archived',
    );
    return {
      category: cat,
      label: NOTIFICATION_CATEGORIES[cat].label,
      icon: NOTIFICATION_CATEGORIES[cat].icon,
      total: catNotifs.length,
      unread: catUnread.length,
    };
  });

  return {
    totalCount: active.length,
    unreadCount: unread.length,
    urgentCount: urgent.length,
    oldestUnread: unreadSorted.length > 0 ? unreadSorted[0].createdAt : null,
    newestNotification: allSorted.length > 0 ? allSorted[0].createdAt : null,
    categorySummary,
  };
}
