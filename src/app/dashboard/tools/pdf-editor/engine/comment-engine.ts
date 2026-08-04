// SPDX-License-Identifier: Apache-2.0
/**
 * Comment Engine — Phase 6, Week 22
 *
 * Provides:
 * - Comment thread management (create, reply, resolve, reopen)
 * - Comment CRUD (add, edit, delete)
 * - Mention extraction and validation
 * - Review workflow (request, approve, reject, track)
 * - Activity log management
 * - Notification helpers
 *
 * Note: Actual persistence is handled by server actions.
 * This engine handles pure state transformations.
 */

import type {
  Comment,
  CommentThread,
  CommentStatus,
  ReviewRequest,
  ReviewStatus,
  ReviewerEntry,
  ActivityEntry,
  ActivityActionType,
} from '../types';
import {
  MAX_COMMENT_LENGTH,
  MAX_COMMENTS_PER_THREAD,
  MAX_MENTIONS_PER_COMMENT,
  REVIEW_STATUSES,
  ACTIVITY_ACTIONS,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   ID counters (resettable for testing)
   ══════════════════════════════════════════════════════════════════════════ */

let nextThreadId = 1;
let nextCommentId = 1;
let nextReviewId = 1;
let nextActivityId = 1;

export function resetCommentIdCounters(): void {
  nextThreadId = 1;
  nextCommentId = 1;
  nextReviewId = 1;
  nextActivityId = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   Comment thread management
   ══════════════════════════════════════════════════════════════════════════ */

/** Create a new comment thread at a position on a page. */
export function createCommentThread(
  page: number,
  position: { x: number; y: number },
  firstComment: {
    authorId: string;
    authorName: string;
    content: string;
    authorAvatarUrl?: string;
  },
): { thread: CommentThread; error?: string } {
  if (!firstComment.content.trim()) {
    return {
      thread: null as unknown as CommentThread,
      error: 'Comment cannot be empty',
    };
  }

  if (firstComment.content.length > MAX_COMMENT_LENGTH) {
    return {
      thread: null as unknown as CommentThread,
      error: `Comment exceeds ${MAX_COMMENT_LENGTH} characters`,
    };
  }

  const mentions = extractMentions(firstComment.content);
  const comment: Comment = {
    id: `comment-${nextCommentId++}`,
    threadId: '', // Set below
    authorId: firstComment.authorId,
    authorName: firstComment.authorName,
    authorAvatarUrl: firstComment.authorAvatarUrl,
    content: firstComment.content,
    mentions: mentions.slice(0, MAX_MENTIONS_PER_COMMENT),
    createdAt: new Date(),
    isEdited: false,
  };

  const thread: CommentThread = {
    id: `thread-${nextThreadId++}`,
    page,
    x: position.x,
    y: position.y,
    status: 'open',
    comments: [{ ...comment, threadId: '' }],
    createdAt: new Date(),
  };

  // Backfill threadId
  thread.comments[0].threadId = thread.id;

  return { thread };
}

/** Add a reply to an existing thread. */
export function addReply(
  thread: CommentThread,
  reply: {
    authorId: string;
    authorName: string;
    content: string;
    authorAvatarUrl?: string;
  },
): { thread: CommentThread; error?: string } {
  if (!reply.content.trim()) {
    return { thread, error: 'Reply cannot be empty' };
  }

  if (reply.content.length > MAX_COMMENT_LENGTH) {
    return { thread, error: `Reply exceeds ${MAX_COMMENT_LENGTH} characters` };
  }

  if (thread.comments.length >= MAX_COMMENTS_PER_THREAD) {
    return {
      thread,
      error: `Thread has reached maximum of ${MAX_COMMENTS_PER_THREAD} comments`,
    };
  }

  const mentions = extractMentions(reply.content);
  const comment: Comment = {
    id: `comment-${nextCommentId++}`,
    threadId: thread.id,
    authorId: reply.authorId,
    authorName: reply.authorName,
    authorAvatarUrl: reply.authorAvatarUrl,
    content: reply.content,
    mentions: mentions.slice(0, MAX_MENTIONS_PER_COMMENT),
    createdAt: new Date(),
    isEdited: false,
  };

  return {
    thread: { ...thread, comments: [...thread.comments, comment] },
  };
}

/** Edit a comment's content. */
export function editComment(
  thread: CommentThread,
  commentId: string,
  newContent: string,
): { thread: CommentThread; error?: string } {
  if (!newContent.trim()) {
    return { thread, error: 'Comment cannot be empty' };
  }

  if (newContent.length > MAX_COMMENT_LENGTH) {
    return {
      thread,
      error: `Comment exceeds ${MAX_COMMENT_LENGTH} characters`,
    };
  }

  const mentions = extractMentions(newContent);
  return {
    thread: {
      ...thread,
      comments: thread.comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              content: newContent,
              mentions: mentions.slice(0, MAX_MENTIONS_PER_COMMENT),
              updatedAt: new Date(),
              isEdited: true,
            }
          : c,
      ),
    },
  };
}

/** Delete a comment from a thread. If last comment, the thread is removed. */
export function deleteComment(
  thread: CommentThread,
  commentId: string,
): { thread: CommentThread | null } {
  const remaining = thread.comments.filter((c) => c.id !== commentId);
  if (remaining.length === 0) return { thread: null };
  return { thread: { ...thread, comments: remaining } };
}

/** Resolve a comment thread. */
export function resolveThread(
  thread: CommentThread,
  resolvedBy: string,
): CommentThread {
  return {
    ...thread,
    status: 'resolved',
    resolvedAt: new Date(),
    resolvedBy,
  };
}

/** Reopen a resolved comment thread. */
export function reopenThread(thread: CommentThread): CommentThread {
  return {
    ...thread,
    status: 'open',
    resolvedAt: undefined,
    resolvedBy: undefined,
  };
}

/** Get threads for a specific page. */
export function getThreadsForPage(
  threads: CommentThread[],
  page: number,
): CommentThread[] {
  return threads.filter((t) => t.page === page);
}

/** Get only open (unresolved) threads. */
export function getOpenThreads(threads: CommentThread[]): CommentThread[] {
  return threads.filter((t) => t.status === 'open');
}

/** Get resolved threads. */
export function getResolvedThreads(threads: CommentThread[]): CommentThread[] {
  return threads.filter((t) => t.status === 'resolved');
}

/** Count total comments across all threads. */
export function countTotalComments(threads: CommentThread[]): number {
  return threads.reduce((sum, t) => sum + t.comments.length, 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   Mentions
   ══════════════════════════════════════════════════════════════════════════ */

/** Extract @mentions from text. Returns array of user identifiers (after @). */
export function extractMentions(text: string): string[] {
  const regex = /@([a-zA-Z0-9_.-]+)/g;
  const mentions: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (!mentions.includes(match[1])) {
      mentions.push(match[1]);
    }
  }
  return mentions;
}

/** Check if a specific user is mentioned in text. */
export function isMentioned(text: string, userId: string): boolean {
  return extractMentions(text).includes(userId);
}

/* ══════════════════════════════════════════════════════════════════════════
   Review workflow
   ══════════════════════════════════════════════════════════════════════════ */

/** Create a new review request. */
export function createReviewRequest(
  documentId: string,
  requester: { userId: string; name: string },
  reviewerIds: { userId: string; displayName: string }[],
  message?: string,
): ReviewRequest {
  return {
    id: `review-${nextReviewId++}`,
    documentId,
    requesterId: requester.userId,
    requesterName: requester.name,
    reviewers: reviewerIds.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
    })),
    status: 'in-review',
    message,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Submit a reviewer's decision. */
export function submitReviewDecision(
  review: ReviewRequest,
  reviewerId: string,
  decision: 'approved' | 'rejected' | 'changes-requested',
  comment?: string,
): ReviewRequest {
  const updatedReviewers = review.reviewers.map((r) =>
    r.userId === reviewerId
      ? { ...r, decision, comment, decidedAt: new Date() }
      : r,
  );

  // Calculate overall status
  const decided = updatedReviewers.filter((r) => r.decision !== undefined);
  let status: ReviewStatus = 'in-review';

  if (decided.some((r) => r.decision === 'rejected')) {
    status = 'rejected';
  } else if (decided.some((r) => r.decision === 'changes-requested')) {
    status = 'changes-requested';
  } else if (
    decided.length === updatedReviewers.length &&
    decided.every((r) => r.decision === 'approved')
  ) {
    status = 'approved';
  }

  return {
    ...review,
    reviewers: updatedReviewers,
    status,
    updatedAt: new Date(),
  };
}

/** Get a review status label. */
export function getReviewStatusLabel(status: ReviewStatus): string {
  const s = REVIEW_STATUSES.find((r) => r.value === status);
  return s?.label ?? status;
}

/** Get a review status color. */
export function getReviewStatusColor(status: ReviewStatus): string {
  const s = REVIEW_STATUSES.find((r) => r.value === status);
  return s?.color ?? '#6B7280';
}

/** Check if all reviewers have decided. */
export function isReviewComplete(review: ReviewRequest): boolean {
  return review.reviewers.every((r) => r.decision !== undefined);
}

/** Count pending reviewers. */
export function countPendingReviewers(review: ReviewRequest): number {
  return review.reviewers.filter((r) => r.decision === undefined).length;
}

/* ══════════════════════════════════════════════════════════════════════════
   Activity log
   ══════════════════════════════════════════════════════════════════════════ */

/** Create an activity entry. */
export function createActivityEntry(
  action: ActivityActionType,
  user: { userId: string; userName: string },
  description: string,
  page?: number,
  details?: Record<string, unknown>,
): ActivityEntry {
  return {
    id: `activity-${nextActivityId++}`,
    action,
    userId: user.userId,
    userName: user.userName,
    description,
    timestamp: new Date(),
    page,
    details,
  };
}

/** Get the label for an activity action. */
export function getActivityActionLabel(action: ActivityActionType): string {
  const a = ACTIVITY_ACTIONS.find((act) => act.value === action);
  return a?.label ?? action;
}

/** Get the icon for an activity action. */
export function getActivityActionIcon(action: ActivityActionType): string {
  const a = ACTIVITY_ACTIONS.find((act) => act.value === action);
  return a?.icon ?? '📋';
}

/** Filter activities by page. */
export function getActivitiesForPage(
  activities: ActivityEntry[],
  page: number,
): ActivityEntry[] {
  return activities.filter((a) => a.page === page);
}

/** Filter activities by user. */
export function getActivitiesByUser(
  activities: ActivityEntry[],
  userId: string,
): ActivityEntry[] {
  return activities.filter((a) => a.userId === userId);
}

/** Get the most recent N activities. */
export function getRecentActivities(
  activities: ActivityEntry[],
  count: number,
): ActivityEntry[] {
  return [...activities]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, count);
}
