// SPDX-License-Identifier: Apache-2.0
/**
 * Asset Approval Workflow Engine — Tests
 * Sprint 13.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createApprovalRequest,
  isValidTransition,
  getAvailableTransitions,
  transitionStatus,
  submitReviewDecision,
  determineStatus,
  decisionLabel,
  countPendingReviewers,
  hasPendingReview,
  isOverdue,
  timeUntilDeadline,
  bulkApprove,
  evaluateAutoApprovalRules,
  allConditionsMatch,
  evaluateCondition,
  computeApprovalStats,
  formatApprovalTimeline,
  resetApprovalIdCounters,
  STATUS_TRANSITIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  MIN_REVIEWERS,
  MAX_REVIEWERS,
  MAX_DEADLINE_DAYS,
  type ApprovalRequest,
  type Reviewer,
  type AutoApprovalRule,
  type AutoApprovalCondition,
} from '@/lib/approval-workflow';

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Helpers                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

const reviewerUsers = [
  { userId: 'rev-1', displayName: 'Reviewer A' },
  { userId: 'rev-2', displayName: 'Reviewer B' },
];

function makeRequest(
  overrides: Partial<ApprovalRequest> = {},
): ApprovalRequest {
  return {
    id: 'apr-1',
    orgId: 'org-1',
    targetType: 'asset',
    targetId: 'asset-1',
    targetName: 'photo.jpg',
    status: 'pending_review',
    requesterId: 'req-1',
    requesterName: 'Requester',
    reviewers: [
      {
        userId: 'rev-1',
        displayName: 'Reviewer A',
        decision: null,
        comment: '',
        decidedAt: null,
        assignedAt: new Date('2024-06-15T10:00:00Z'),
      },
      {
        userId: 'rev-2',
        displayName: 'Reviewer B',
        decision: null,
        comment: '',
        decidedAt: null,
        assignedAt: new Date('2024-06-15T10:00:00Z'),
      },
    ],
    requiredApprovals: 1,
    deadline: null,
    message: 'Please review',
    history: [],
    createdAt: new Date('2024-06-15T10:00:00Z'),
    updatedAt: new Date('2024-06-15T10:00:00Z'),
    completedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetApprovalIdCounters();
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Constants                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('approval-workflow constants', () => {
  it('STATUS_TRANSITIONS has entries for all statuses', () => {
    expect(Object.keys(STATUS_TRANSITIONS)).toHaveLength(7);
  });

  it('STATUS_LABELS has entries for all statuses', () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(7);
  });

  it('STATUS_COLORS has entries for all statuses', () => {
    expect(Object.keys(STATUS_COLORS)).toHaveLength(7);
  });

  it('has sensible reviewer limits', () => {
    expect(MIN_REVIEWERS).toBe(1);
    expect(MAX_REVIEWERS).toBe(10);
    expect(MAX_DEADLINE_DAYS).toBe(90);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  createApprovalRequest                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('createApprovalRequest', () => {
  it('creates a valid approval request', () => {
    const { request, error } = createApprovalRequest({
      orgId: 'org-1',
      targetType: 'asset',
      targetId: 'asset-1',
      targetName: 'photo.jpg',
      requesterId: 'req-1',
      requesterName: 'Requester',
      reviewerUsers,
    });
    expect(error).toBeUndefined();
    expect(request!.id).toBe('apr-1');
    expect(request!.status).toBe('pending_review');
    expect(request!.reviewers).toHaveLength(2);
    expect(request!.history).toHaveLength(1);
  });

  it('sets requiredApprovals to min of provided and reviewer count', () => {
    const { request } = createApprovalRequest({
      orgId: 'org-1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'req-1',
      requesterName: 'R',
      reviewerUsers: [{ userId: 'r1', displayName: 'R1' }],
      requiredApprovals: 5, // more than reviewer count
    });
    expect(request!.requiredApprovals).toBe(1); // clamped to reviewerUsers.length
  });

  it('rejects missing orgId', () => {
    const { error } = createApprovalRequest({
      orgId: '',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'r1',
      requesterName: 'R',
      reviewerUsers,
    });
    expect(error).toContain('orgId');
  });

  it('rejects missing targetId', () => {
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: '',
      targetName: 'a',
      requesterId: 'r1',
      requesterName: 'R',
      reviewerUsers,
    });
    expect(error).toContain('targetId');
  });

  it('rejects missing requesterId', () => {
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: '',
      requesterName: 'R',
      reviewerUsers,
    });
    expect(error).toContain('requesterId');
  });

  it('rejects too few reviewers', () => {
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'r1',
      requesterName: 'R',
      reviewerUsers: [],
    });
    expect(error).toContain('reviewer');
  });

  it('rejects too many reviewers', () => {
    const manyReviewers = Array.from({ length: MAX_REVIEWERS + 1 }, (_, i) => ({
      userId: `r${i}`,
      displayName: `R${i}`,
    }));
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'req-1',
      requesterName: 'R',
      reviewerUsers: manyReviewers,
    });
    expect(error).toContain('Maximum');
  });

  it('rejects requester as reviewer', () => {
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'rev-1',
      requesterName: 'R',
      reviewerUsers: [{ userId: 'rev-1', displayName: 'R1' }],
    });
    expect(error).toContain('Requester cannot');
  });

  it('rejects duplicate reviewers', () => {
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'req-1',
      requesterName: 'R',
      reviewerUsers: [
        { userId: 'rev-1', displayName: 'R1' },
        { userId: 'rev-1', displayName: 'R1 Dupe' },
      ],
    });
    expect(error).toContain('Duplicate');
  });

  it('rejects past deadline', () => {
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'req-1',
      requesterName: 'R',
      reviewerUsers,
      deadline: new Date('2020-01-01'),
    });
    expect(error).toContain('future');
  });

  it('rejects deadline too far in future', () => {
    const farFuture = new Date(
      Date.now() + (MAX_DEADLINE_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    const { error } = createApprovalRequest({
      orgId: 'o1',
      targetType: 'asset',
      targetId: 'a1',
      targetName: 'a',
      requesterId: 'req-1',
      requesterName: 'R',
      reviewerUsers,
      deadline: farFuture,
    });
    expect(error).toContain(`${MAX_DEADLINE_DAYS} days`);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Status Transitions                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('isValidTransition', () => {
  it('allows draft → pending_review', () => {
    expect(isValidTransition('draft', 'pending_review')).toBe(true);
  });

  it('allows in_review → approved', () => {
    expect(isValidTransition('in_review', 'approved')).toBe(true);
  });

  it('blocks draft → approved (skips steps)', () => {
    expect(isValidTransition('draft', 'approved')).toBe(false);
  });

  it('allows approved → published', () => {
    expect(isValidTransition('approved', 'published')).toBe(true);
  });

  it('allows changes_requested → pending_review (resubmit)', () => {
    expect(isValidTransition('changes_requested', 'pending_review')).toBe(true);
  });
});

describe('getAvailableTransitions', () => {
  it('returns valid transitions for pending_review', () => {
    const transitions = getAvailableTransitions('pending_review');
    expect(transitions).toContain('in_review');
    expect(transitions).toContain('draft');
  });

  it('returns valid transitions for approved', () => {
    const transitions = getAvailableTransitions('approved');
    expect(transitions).toContain('published');
    expect(transitions).toContain('draft');
  });
});

describe('transitionStatus', () => {
  it('transitions with history entry', () => {
    const req = makeRequest({ status: 'draft' });
    const { request } = transitionStatus(req, 'pending_review', 'u1', 'User');
    expect(request!.status).toBe('pending_review');
    expect(request!.history).toHaveLength(1);
  });

  it('rejects invalid transition', () => {
    const req = makeRequest({ status: 'draft' });
    const { error } = transitionStatus(req, 'approved', 'u1', 'User');
    expect(error).toContain('Cannot transition');
  });

  it('sets completedAt for terminal statuses', () => {
    const req = makeRequest({ status: 'in_review' });
    const { request } = transitionStatus(req, 'approved', 'u1', 'User');
    expect(request!.completedAt).not.toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Review Decisions                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('submitReviewDecision', () => {
  it('records approval and auto-approves when threshold met', () => {
    const req = makeRequest({ requiredApprovals: 1 });
    const { request } = submitReviewDecision(
      req,
      'rev-1',
      'approve',
      'Looks good',
    );
    expect(request!.reviewers[0].decision).toBe('approve');
    expect(request!.status).toBe('approved');
    expect(request!.completedAt).not.toBeNull();
  });

  it('stays in_review when not enough approvals', () => {
    const req = makeRequest({ requiredApprovals: 2 });
    const { request } = submitReviewDecision(req, 'rev-1', 'approve');
    expect(request!.status).toBe('in_review');
    expect(request!.completedAt).toBeNull();
  });

  it('rejects on rejection', () => {
    const req = makeRequest();
    const { request } = submitReviewDecision(
      req,
      'rev-1',
      'reject',
      'Not ready',
    );
    expect(request!.status).toBe('rejected');
  });

  it('requests changes', () => {
    const req = makeRequest();
    const { request } = submitReviewDecision(
      req,
      'rev-1',
      'request_changes',
      'Fix colors',
    );
    expect(request!.status).toBe('changes_requested');
  });

  it('rejects review in wrong status', () => {
    const req = makeRequest({ status: 'draft' });
    const { error } = submitReviewDecision(req, 'rev-1', 'approve');
    expect(error).toContain('Cannot review');
  });

  it('rejects non-assigned reviewer', () => {
    const req = makeRequest();
    const { error } = submitReviewDecision(req, 'non-reviewer', 'approve');
    expect(error).toContain('not an assigned reviewer');
  });

  it('rejects double review', () => {
    const req = makeRequest();
    req.reviewers[0].decision = 'approve';
    req.reviewers[0].decidedAt = new Date();
    const { error } = submitReviewDecision(req, 'rev-1', 'approve');
    expect(error).toContain('already submitted');
  });

  it('adds history entry', () => {
    const req = makeRequest();
    const { request } = submitReviewDecision(req, 'rev-1', 'approve');
    expect(request!.history.length).toBeGreaterThan(0);
  });
});

describe('determineStatus', () => {
  it('returns pending_review when no decisions', () => {
    const reviewers: Reviewer[] = [
      {
        userId: 'r1',
        displayName: 'R1',
        decision: null,
        comment: '',
        decidedAt: null,
        assignedAt: new Date(),
      },
    ];
    expect(determineStatus(reviewers, 1)).toBe('pending_review');
  });

  it('returns in_review when some decisions but not enough', () => {
    const reviewers: Reviewer[] = [
      {
        userId: 'r1',
        displayName: 'R1',
        decision: 'approve',
        comment: '',
        decidedAt: new Date(),
        assignedAt: new Date(),
      },
      {
        userId: 'r2',
        displayName: 'R2',
        decision: null,
        comment: '',
        decidedAt: null,
        assignedAt: new Date(),
      },
    ];
    expect(determineStatus(reviewers, 2)).toBe('in_review');
  });

  it('returns approved when threshold met', () => {
    const reviewers: Reviewer[] = [
      {
        userId: 'r1',
        displayName: 'R1',
        decision: 'approve',
        comment: '',
        decidedAt: new Date(),
        assignedAt: new Date(),
      },
      {
        userId: 'r2',
        displayName: 'R2',
        decision: 'approve',
        comment: '',
        decidedAt: new Date(),
        assignedAt: new Date(),
      },
    ];
    expect(determineStatus(reviewers, 2)).toBe('approved');
  });

  it('rejection overrides approvals', () => {
    const reviewers: Reviewer[] = [
      {
        userId: 'r1',
        displayName: 'R1',
        decision: 'approve',
        comment: '',
        decidedAt: new Date(),
        assignedAt: new Date(),
      },
      {
        userId: 'r2',
        displayName: 'R2',
        decision: 'reject',
        comment: '',
        decidedAt: new Date(),
        assignedAt: new Date(),
      },
    ];
    expect(determineStatus(reviewers, 1)).toBe('rejected');
  });
});

describe('decisionLabel', () => {
  it('returns human labels', () => {
    expect(decisionLabel('approve')).toBe('approved');
    expect(decisionLabel('reject')).toBe('rejected');
    expect(decisionLabel('request_changes')).toBe('requested changes');
  });
});

describe('countPendingReviewers', () => {
  it('counts pending', () => {
    const req = makeRequest();
    expect(countPendingReviewers(req)).toBe(2);
  });

  it('excludes decided reviewers', () => {
    const req = makeRequest();
    req.reviewers[0].decision = 'approve';
    expect(countPendingReviewers(req)).toBe(1);
  });
});

describe('hasPendingReview', () => {
  it('returns true for pending reviewer', () => {
    expect(hasPendingReview(makeRequest(), 'rev-1')).toBe(true);
  });

  it('returns false for non-reviewer', () => {
    expect(hasPendingReview(makeRequest(), 'stranger')).toBe(false);
  });

  it('returns false after decision', () => {
    const req = makeRequest();
    req.reviewers[0].decision = 'approve';
    expect(hasPendingReview(req, 'rev-1')).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Deadline                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('isOverdue', () => {
  it('returns false when no deadline', () => {
    expect(isOverdue(makeRequest())).toBe(false);
  });

  it('returns true when past deadline', () => {
    const req = makeRequest({ deadline: new Date('2024-01-01') });
    expect(isOverdue(req, new Date('2024-06-15'))).toBe(true);
  });

  it('returns false when completed', () => {
    const req = makeRequest({
      deadline: new Date('2024-01-01'),
      completedAt: new Date('2023-12-31'),
    });
    expect(isOverdue(req, new Date('2024-06-15'))).toBe(false);
  });
});

describe('timeUntilDeadline', () => {
  it('returns no deadline label', () => {
    const result = timeUntilDeadline(makeRequest());
    expect(result.label).toBe('No deadline');
    expect(result.overdue).toBe(false);
  });

  it('returns remaining time', () => {
    const deadline = new Date('2024-06-20T10:00:00Z');
    const now = new Date('2024-06-15T10:00:00Z');
    const req = makeRequest({ deadline });
    const result = timeUntilDeadline(req, now);
    expect(result.overdue).toBe(false);
    expect(result.label).toContain('5 days remaining');
  });

  it('returns overdue time', () => {
    const deadline = new Date('2024-06-10T10:00:00Z');
    const now = new Date('2024-06-15T10:00:00Z');
    const req = makeRequest({ deadline });
    const result = timeUntilDeadline(req, now);
    expect(result.overdue).toBe(true);
    expect(result.label).toContain('overdue');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Bulk Operations                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('bulkApprove', () => {
  it('approves multiple requests', () => {
    const requests = [makeRequest({ id: 'a1' }), makeRequest({ id: 'a2' })];
    const { approved, errors } = bulkApprove(
      requests,
      'rev-1',
      'Reviewer A',
      'LGTM',
    );
    expect(approved).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it('reports errors for invalid requests', () => {
    const requests = [makeRequest({ id: 'a1', status: 'draft' })];
    const { approved, errors } = bulkApprove(requests, 'rev-1', 'Reviewer A');
    expect(approved).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Auto-Approval Rules                                                    */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('evaluateCondition', () => {
  it('evaluates equals', () => {
    expect(
      evaluateCondition(
        { field: 'file_type', operator: 'equals', value: 'image/jpeg' },
        { file_type: 'image/jpeg' },
      ),
    ).toBe(true);
  });

  it('evaluates contains (string)', () => {
    expect(
      evaluateCondition(
        { field: 'file_type', operator: 'contains', value: 'image' },
        { file_type: 'image/jpeg' },
      ),
    ).toBe(true);
  });

  it('evaluates contains (array)', () => {
    expect(
      evaluateCondition(
        { field: 'tag', operator: 'contains', value: 'approved' },
        { tag: ['approved', 'landscape'] },
      ),
    ).toBe(true);
  });

  it('evaluates less_than', () => {
    expect(
      evaluateCondition(
        { field: 'file_size', operator: 'less_than', value: 1000000 },
        { file_size: 500000 },
      ),
    ).toBe(true);
  });

  it('evaluates greater_than', () => {
    expect(
      evaluateCondition(
        { field: 'file_size', operator: 'greater_than', value: 100 },
        { file_size: 500 },
      ),
    ).toBe(true);
  });

  it('evaluates in operator', () => {
    expect(
      evaluateCondition(
        {
          field: 'file_type',
          operator: 'in',
          value: ['image/jpeg', 'image/png'],
        },
        { file_type: 'image/png' },
      ),
    ).toBe(true);
  });

  it('returns false for missing field', () => {
    expect(
      evaluateCondition(
        { field: 'file_type', operator: 'equals', value: 'x' },
        {},
      ),
    ).toBe(false);
  });
});

describe('allConditionsMatch', () => {
  it('returns true when all conditions match', () => {
    const conditions: AutoApprovalCondition[] = [
      { field: 'file_type', operator: 'equals', value: 'image/jpeg' },
      { field: 'file_size', operator: 'less_than', value: 5000000 },
    ];
    expect(
      allConditionsMatch(conditions, {
        file_type: 'image/jpeg',
        file_size: 1000000,
      }),
    ).toBe(true);
  });

  it('returns false when any condition fails', () => {
    const conditions: AutoApprovalCondition[] = [
      { field: 'file_type', operator: 'equals', value: 'image/jpeg' },
      { field: 'file_size', operator: 'less_than', value: 500 },
    ];
    expect(
      allConditionsMatch(conditions, {
        file_type: 'image/jpeg',
        file_size: 1000000,
      }),
    ).toBe(false);
  });
});

describe('evaluateAutoApprovalRules', () => {
  it('returns first matching enabled rule', () => {
    const rules: AutoApprovalRule[] = [
      {
        id: 'r1',
        orgId: 'o1',
        name: 'Auto JPEG',
        enabled: true,
        conditions: [
          { field: 'file_type', operator: 'equals', value: 'image/jpeg' },
        ],
        resultStatus: 'approved',
      },
    ];
    const result = evaluateAutoApprovalRules(rules, {
      file_type: 'image/jpeg',
    });
    expect(result!.id).toBe('r1');
  });

  it('skips disabled rules', () => {
    const rules: AutoApprovalRule[] = [
      {
        id: 'r1',
        orgId: 'o1',
        name: 'Disabled',
        enabled: false,
        conditions: [
          { field: 'file_type', operator: 'equals', value: 'image/jpeg' },
        ],
        resultStatus: 'approved',
      },
    ];
    expect(
      evaluateAutoApprovalRules(rules, { file_type: 'image/jpeg' }),
    ).toBeNull();
  });

  it('returns null when no rules match', () => {
    const rules: AutoApprovalRule[] = [
      {
        id: 'r1',
        orgId: 'o1',
        name: 'PNG only',
        enabled: true,
        conditions: [
          { field: 'file_type', operator: 'equals', value: 'image/png' },
        ],
        resultStatus: 'approved',
      },
    ];
    expect(
      evaluateAutoApprovalRules(rules, { file_type: 'image/jpeg' }),
    ).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Statistics                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('computeApprovalStats', () => {
  it('computes stats for requests', () => {
    const requests: ApprovalRequest[] = [
      makeRequest({
        status: 'approved',
        completedAt: new Date('2024-06-16T10:00:00Z'),
      }),
      makeRequest({ id: 'a2', status: 'pending_review' }),
      makeRequest({
        id: 'a3',
        status: 'pending_review',
        deadline: new Date('2024-01-01'), // overdue
      }),
    ];
    const stats = computeApprovalStats(
      requests,
      'rev-1',
      new Date('2024-06-20'),
    );
    expect(stats.total).toBe(3);
    expect(stats.byStatus?.approved).toBe(1);
    expect(stats.byStatus?.pending_review).toBe(2);
    expect(stats.overdue).toBe(1);
    expect(stats.pendingMyReview).toBe(2); // rev-1 has pending reviews on a2 and a3
  });

  it('computes average review time', () => {
    const created = new Date('2024-06-15T10:00:00Z');
    const completed = new Date('2024-06-15T12:00:00Z'); // 2 hours later
    const requests: ApprovalRequest[] = [
      makeRequest({
        createdAt: created,
        completedAt: completed,
        status: 'approved',
      }),
    ];
    const stats = computeApprovalStats(requests);
    expect(stats.averageReviewTimeMs).toBe(2 * 60 * 60 * 1000);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Timeline                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('formatApprovalTimeline', () => {
  it('formats history entries as timeline', () => {
    const req = makeRequest({
      history: [
        {
          id: 'h1',
          action: 'created',
          userId: 'u1',
          userName: 'Alice',
          details: 'Requested review',
          timestamp: new Date('2024-06-15T10:00:00Z'),
        },
        {
          id: 'h2',
          action: 'review:approve',
          userId: 'u2',
          userName: 'Bob',
          details: 'Approved',
          timestamp: new Date('2024-06-15T12:00:00Z'),
        },
      ],
    });
    const timeline = formatApprovalTimeline(req);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].actor).toBe('Alice');
    expect(timeline[1].actor).toBe('Bob');
  });
});
