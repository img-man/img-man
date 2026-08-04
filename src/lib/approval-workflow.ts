// SPDX-License-Identifier: Apache-2.0
/**
 * Asset Approval Workflow Engine — Sprint 13.4
 *
 * Provides a platform-wide approval/review state machine for assets:
 * - Asset lifecycle status (draft → in-review → approved → published)
 * - Review request management (assign reviewers, track decisions)
 * - Deadline enforcement
 * - Approval history tracking
 * - Bulk approval operations
 * - Conditional auto-approval rules
 *
 * Note: Pure state-transform functions. Generalizes the PDF editor's
 * review workflow to any asset/design in the platform.
 *
 * @see src/app/dashboard/tools/pdf-editor/engine/comment-engine.ts — PDF-specific review
 */

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export type ApprovalStatus =
  | 'draft'
  | 'pending_review'
  | 'in_review'
  | 'changes_requested'
  | 'approved'
  | 'rejected'
  | 'published';

export type ReviewDecision = 'approve' | 'reject' | 'request_changes';

export type ApprovalTargetType = 'asset' | 'design' | 'folder';

export interface Reviewer {
  userId: string;
  displayName: string;
  decision: ReviewDecision | null;
  comment: string;
  decidedAt: Date | null;
  assignedAt: Date;
}

export interface ApprovalHistoryEntry {
  id: string;
  action: string;
  userId: string;
  userName: string;
  details: string;
  timestamp: Date;
}

export interface ApprovalRequest {
  id: string;
  orgId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  targetName: string;
  status: ApprovalStatus;
  requesterId: string;
  requesterName: string;
  reviewers: Reviewer[];
  /** Minimum approvals required to approve */
  requiredApprovals: number;
  deadline: Date | null;
  message: string;
  history: ApprovalHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface ApprovalCreateInput {
  orgId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  targetName: string;
  requesterId: string;
  requesterName: string;
  reviewerUsers: { userId: string; displayName: string }[];
  requiredApprovals?: number;
  deadline?: Date | null;
  message?: string;
}

export interface ApprovalStats {
  total: number;
  byStatus: Partial<Record<ApprovalStatus, number>>;
  averageReviewTimeMs: number;
  overdue: number;
  pendingMyReview: number;
}

export interface AutoApprovalRule {
  id: string;
  orgId: string;
  name: string;
  enabled: boolean;
  conditions: AutoApprovalCondition[];
  /** If all conditions match, auto-approve with this status */
  resultStatus: 'approved' | 'published';
}

export interface AutoApprovalCondition {
  field: 'file_type' | 'file_size' | 'uploader_role' | 'folder' | 'tag';
  operator: 'equals' | 'contains' | 'less_than' | 'greater_than' | 'in';
  value: string | number | string[];
}

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

export const MIN_REVIEWERS = 1;
export const MAX_REVIEWERS = 10;
export const DEFAULT_REQUIRED_APPROVALS = 1;
export const MAX_DEADLINE_DAYS = 90;

/** Valid status transitions */
export const STATUS_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  draft: ['pending_review'],
  pending_review: ['in_review', 'draft'],
  in_review: ['approved', 'rejected', 'changes_requested'],
  changes_requested: ['pending_review', 'draft'],
  approved: ['published', 'draft'],
  rejected: ['pending_review', 'draft'],
  published: ['draft'],
};

/** Human-readable labels */
export const STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  in_review: 'In Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  published: 'Published',
};

/** Status badge colors (Tailwind classes) */
export const STATUS_COLORS: Record<ApprovalStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_review: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  changes_requested: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  published: 'bg-purple-100 text-purple-700',
};

/* ══════════════════════════════════════════════════════════════════════════
   ID counter (resettable for testing)
   ══════════════════════════════════════════════════════════════════════════ */

let nextApprovalId = 1;
let nextHistoryId = 1;

export function resetApprovalIdCounters(): void {
  nextApprovalId = 1;
  nextHistoryId = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   Approval Request CRUD
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a new approval request with assigned reviewers.
 */
export function createApprovalRequest(input: ApprovalCreateInput): {
  request: ApprovalRequest | null;
  error?: string;
} {
  if (!input.orgId) {
    return { request: null, error: 'orgId is required' };
  }
  if (!input.targetId) {
    return { request: null, error: 'targetId is required' };
  }
  if (!input.requesterId) {
    return { request: null, error: 'requesterId is required' };
  }

  if (!input.reviewerUsers || input.reviewerUsers.length < MIN_REVIEWERS) {
    return {
      request: null,
      error: `At least ${MIN_REVIEWERS} reviewer is required`,
    };
  }

  if (input.reviewerUsers.length > MAX_REVIEWERS) {
    return {
      request: null,
      error: `Maximum of ${MAX_REVIEWERS} reviewers allowed`,
    };
  }

  // Requester cannot be a reviewer
  if (input.reviewerUsers.some((r) => r.userId === input.requesterId)) {
    return {
      request: null,
      error: 'Requester cannot be assigned as a reviewer',
    };
  }

  // Check for duplicate reviewers
  const uniqueIds = new Set(input.reviewerUsers.map((r) => r.userId));
  if (uniqueIds.size !== input.reviewerUsers.length) {
    return { request: null, error: 'Duplicate reviewers are not allowed' };
  }

  // Validate deadline
  if (input.deadline) {
    const now = new Date();
    if (input.deadline <= now) {
      return { request: null, error: 'Deadline must be in the future' };
    }
    const maxDate = new Date(
      now.getTime() + MAX_DEADLINE_DAYS * 24 * 60 * 60 * 1000,
    );
    if (input.deadline > maxDate) {
      return {
        request: null,
        error: `Deadline cannot be more than ${MAX_DEADLINE_DAYS} days in the future`,
      };
    }
  }

  const requiredApprovals = Math.min(
    input.requiredApprovals ?? DEFAULT_REQUIRED_APPROVALS,
    input.reviewerUsers.length,
  );

  const now = new Date();
  const reviewers: Reviewer[] = input.reviewerUsers.map((r) => ({
    userId: r.userId,
    displayName: r.displayName,
    decision: null,
    comment: '',
    decidedAt: null,
    assignedAt: now,
  }));

  const historyEntry = createHistoryEntry(
    input.requesterId,
    input.requesterName,
    'created',
    `Requested review from ${reviewers.map((r) => r.displayName).join(', ')}`,
  );

  const request: ApprovalRequest = {
    id: `apr-${nextApprovalId++}`,
    orgId: input.orgId,
    targetType: input.targetType,
    targetId: input.targetId,
    targetName: input.targetName ?? '',
    status: 'pending_review',
    requesterId: input.requesterId,
    requesterName: input.requesterName,
    reviewers,
    requiredApprovals,
    deadline: input.deadline ?? null,
    message: input.message ?? '',
    history: [historyEntry],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  return { request };
}

/* ══════════════════════════════════════════════════════════════════════════
   Status Transitions
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(
  from: ApprovalStatus,
  to: ApprovalStatus,
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get available next statuses from the current status.
 */
export function getAvailableTransitions(
  status: ApprovalStatus,
): ApprovalStatus[] {
  return STATUS_TRANSITIONS[status] ?? [];
}

/**
 * Transition an approval request to a new status.
 */
export function transitionStatus(
  request: ApprovalRequest,
  newStatus: ApprovalStatus,
  userId: string,
  userName: string,
  details: string = '',
): { request: ApprovalRequest | null; error?: string } {
  if (!isValidTransition(request.status, newStatus)) {
    return {
      request: null,
      error: `Cannot transition from "${request.status}" to "${newStatus}"`,
    };
  }

  const historyEntry = createHistoryEntry(
    userId,
    userName,
    `status_change:${newStatus}`,
    details ||
      `Status changed from ${STATUS_LABELS[request.status]} to ${STATUS_LABELS[newStatus]}`,
  );

  return {
    request: {
      ...request,
      status: newStatus,
      history: [...request.history, historyEntry],
      updatedAt: new Date(),
      completedAt:
        newStatus === 'approved' ||
        newStatus === 'rejected' ||
        newStatus === 'published'
          ? new Date()
          : request.completedAt,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Review Decisions
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Submit a reviewer's decision. Automatically transitions
 * the approval status based on the decision and required approvals.
 */
export function submitReviewDecision(
  request: ApprovalRequest,
  reviewerUserId: string,
  decision: ReviewDecision,
  comment: string = '',
): { request: ApprovalRequest | null; error?: string } {
  // Must be in reviewable state
  if (request.status !== 'pending_review' && request.status !== 'in_review') {
    return {
      request: null,
      error: `Cannot review in "${request.status}" status`,
    };
  }

  // Find reviewer
  const reviewerIdx = request.reviewers.findIndex(
    (r) => r.userId === reviewerUserId,
  );
  if (reviewerIdx < 0) {
    return { request: null, error: 'User is not an assigned reviewer' };
  }

  const reviewer = request.reviewers[reviewerIdx];
  if (reviewer.decision !== null) {
    return {
      request: null,
      error: 'Reviewer has already submitted a decision',
    };
  }

  // Update reviewer
  const updatedReviewers = [...request.reviewers];
  updatedReviewers[reviewerIdx] = {
    ...reviewer,
    decision,
    comment,
    decidedAt: new Date(),
  };

  const historyEntry = createHistoryEntry(
    reviewerUserId,
    reviewer.displayName,
    `review:${decision}`,
    comment || `${reviewer.displayName} ${decisionLabel(decision)}`,
  );

  // Determine new status based on decisions
  const newStatus = determineStatus(
    updatedReviewers,
    request.requiredApprovals,
  );

  const now = new Date();
  const isComplete = newStatus === 'approved' || newStatus === 'rejected';

  return {
    request: {
      ...request,
      status: newStatus,
      reviewers: updatedReviewers,
      history: [...request.history, historyEntry],
      updatedAt: now,
      completedAt: isComplete ? now : request.completedAt,
    },
  };
}

/**
 * Determine the approval status based on reviewer decisions.
 */
export function determineStatus(
  reviewers: Reviewer[],
  requiredApprovals: number,
): ApprovalStatus {
  const decisions = reviewers.filter((r) => r.decision !== null);
  const approvals = decisions.filter((r) => r.decision === 'approve').length;
  const rejections = decisions.filter((r) => r.decision === 'reject').length;
  const changesRequested = decisions.filter(
    (r) => r.decision === 'request_changes',
  ).length;

  // Any rejection → rejected
  if (rejections > 0) return 'rejected';

  // Any changes requested → changes_requested
  if (changesRequested > 0) return 'changes_requested';

  // Enough approvals → approved
  if (approvals >= requiredApprovals) return 'approved';

  // Some decisions made but not enough → in_review
  if (decisions.length > 0) return 'in_review';

  // No decisions yet → pending_review
  return 'pending_review';
}

/**
 * Get human-readable label for a review decision.
 */
export function decisionLabel(decision: ReviewDecision): string {
  switch (decision) {
    case 'approve':
      return 'approved';
    case 'reject':
      return 'rejected';
    case 'request_changes':
      return 'requested changes';
    default:
      return decision;
  }
}

/**
 * Count pending reviewers (those who haven't decided yet).
 */
export function countPendingReviewers(request: ApprovalRequest): number {
  return request.reviewers.filter((r) => r.decision === null).length;
}

/**
 * Check if a specific user has an outstanding review for this request.
 */
export function hasPendingReview(
  request: ApprovalRequest,
  userId: string,
): boolean {
  const reviewer = request.reviewers.find((r) => r.userId === userId);
  return (
    reviewer !== null && reviewer !== undefined && reviewer.decision === null
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Deadline Management
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Check if an approval request is overdue.
 */
export function isOverdue(
  request: ApprovalRequest,
  now: Date = new Date(),
): boolean {
  if (!request.deadline) return false;
  if (request.completedAt) return false;
  return now > request.deadline;
}

/**
 * Get time remaining until deadline.
 */
export function timeUntilDeadline(
  request: ApprovalRequest,
  now: Date = new Date(),
): { overdue: boolean; remainingMs: number; label: string } {
  if (!request.deadline) {
    return { overdue: false, remainingMs: Infinity, label: 'No deadline' };
  }

  const remaining = request.deadline.getTime() - now.getTime();

  if (remaining <= 0) {
    const overdueMs = Math.abs(remaining);
    const overdueHours = Math.floor(overdueMs / (60 * 60 * 1000));
    const overdueDays = Math.floor(overdueHours / 24);
    const label =
      overdueDays > 0
        ? `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`
        : `${overdueHours} hour${overdueHours === 1 ? '' : 's'} overdue`;
    return { overdue: true, remainingMs: 0, label };
  }

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  const label =
    days > 0
      ? `${days} day${days === 1 ? '' : 's'} remaining`
      : `${hours} hour${hours === 1 ? '' : 's'} remaining`;

  return { overdue: false, remainingMs: remaining, label };
}

/* ══════════════════════════════════════════════════════════════════════════
   Bulk Operations
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Bulk approve multiple approval requests.
 */
export function bulkApprove(
  requests: ApprovalRequest[],
  approverUserId: string,
  approverName: string,
  comment: string = '',
): { approved: ApprovalRequest[]; errors: { id: string; error: string }[] } {
  const approved: ApprovalRequest[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const req of requests) {
    const result = submitReviewDecision(
      req,
      approverUserId,
      'approve',
      comment,
    );
    if (result.request) {
      approved.push(result.request);
    } else {
      errors.push({ id: req.id, error: result.error ?? 'Unknown error' });
    }
  }

  return { approved, errors };
}

/* ══════════════════════════════════════════════════════════════════════════
   Auto-Approval Rules
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Evaluate an asset against auto-approval rules.
 * Returns the first matching rule, or null if none match.
 */
export function evaluateAutoApprovalRules(
  rules: AutoApprovalRule[],
  assetData: Record<string, unknown>,
): AutoApprovalRule | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (allConditionsMatch(rule.conditions, assetData)) {
      return rule;
    }
  }
  return null;
}

/**
 * Check if all conditions of an auto-approval rule match.
 */
export function allConditionsMatch(
  conditions: AutoApprovalCondition[],
  data: Record<string, unknown>,
): boolean {
  return conditions.every((condition) => evaluateCondition(condition, data));
}

/**
 * Evaluate a single auto-approval condition against asset data.
 */
export function evaluateCondition(
  condition: AutoApprovalCondition,
  data: Record<string, unknown>,
): boolean {
  const value = data[condition.field];

  switch (condition.operator) {
    case 'equals':
      return value === condition.value;

    case 'contains':
      if (typeof value === 'string' && typeof condition.value === 'string') {
        return value.toLowerCase().includes(condition.value.toLowerCase());
      }
      if (Array.isArray(value) && typeof condition.value === 'string') {
        return value.includes(condition.value);
      }
      return false;

    case 'less_than':
      return typeof value === 'number' && typeof condition.value === 'number'
        ? value < condition.value
        : false;

    case 'greater_than':
      return typeof value === 'number' && typeof condition.value === 'number'
        ? value > condition.value
        : false;

    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.includes(value as string);
      }
      return false;

    default:
      return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   Statistics
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute approval statistics for a set of requests.
 */
export function computeApprovalStats(
  requests: ApprovalRequest[],
  currentUserId?: string,
  now: Date = new Date(),
): ApprovalStats {
  const byStatus: Partial<Record<ApprovalStatus, number>> = {};
  let totalReviewTimeMs = 0;
  let completedCount = 0;
  let overdueCount = 0;
  let pendingMyReview = 0;

  for (const req of requests) {
    byStatus[req.status] = (byStatus[req.status] ?? 0) + 1;

    if (req.completedAt && req.createdAt) {
      totalReviewTimeMs += req.completedAt.getTime() - req.createdAt.getTime();
      completedCount++;
    }

    if (isOverdue(req, now)) {
      overdueCount++;
    }

    if (
      currentUserId &&
      hasPendingReview(req, currentUserId) &&
      (req.status === 'pending_review' || req.status === 'in_review')
    ) {
      pendingMyReview++;
    }
  }

  return {
    total: requests.length,
    byStatus,
    averageReviewTimeMs:
      completedCount > 0 ? Math.round(totalReviewTimeMs / completedCount) : 0,
    overdue: overdueCount,
    pendingMyReview,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   History Helpers
   ══════════════════════════════════════════════════════════════════════════ */

function createHistoryEntry(
  userId: string,
  userName: string,
  action: string,
  details: string,
): ApprovalHistoryEntry {
  return {
    id: `hist-${nextHistoryId++}`,
    action,
    userId,
    userName,
    details,
    timestamp: new Date(),
  };
}

/**
 * Get a formatted timeline of approval history.
 */
export function formatApprovalTimeline(
  request: ApprovalRequest,
): { time: Date; actor: string; description: string }[] {
  return request.history.map((entry) => ({
    time: entry.timestamp,
    actor: entry.userName,
    description: entry.details,
  }));
}
