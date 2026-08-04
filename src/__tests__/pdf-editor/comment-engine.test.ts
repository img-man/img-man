// SPDX-License-Identifier: Apache-2.0
/**
 * Comment Engine — Phase 6 Tests
 *
 * Tests thread management, comment CRUD, mentions,
 * review workflow, and activity log.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetCommentIdCounters,
  createCommentThread,
  addReply,
  editComment,
  deleteComment,
  resolveThread,
  reopenThread,
  getThreadsForPage,
  getOpenThreads,
  getResolvedThreads,
  countTotalComments,
  extractMentions,
  isMentioned,
  createReviewRequest,
  submitReviewDecision,
  getReviewStatusLabel,
  getReviewStatusColor,
  isReviewComplete,
  countPendingReviewers,
  createActivityEntry,
  getActivityActionLabel,
  getActivityActionIcon,
  getActivitiesForPage,
  getActivitiesByUser,
  getRecentActivities,
} from '../../app/dashboard/tools/pdf-editor/engine/comment-engine';
import type {
  CommentThread,
  ReviewRequest,
} from '../../app/dashboard/tools/pdf-editor/types';
import {
  MAX_COMMENT_LENGTH,
  MAX_COMMENTS_PER_THREAD,
} from '../../app/dashboard/tools/pdf-editor/constants';

describe('Comment Engine (Phase 6)', () => {
  beforeEach(() => {
    resetCommentIdCounters();
  });

  /* ═══════ Thread management ═══════ */
  describe('createCommentThread', () => {
    it('creates a thread with first comment', () => {
      const { thread, error } = createCommentThread(
        1,
        { x: 100, y: 200 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'This needs review',
        },
      );
      expect(error).toBeUndefined();
      expect(thread.page).toBe(1);
      expect(thread.x).toBe(100);
      expect(thread.y).toBe(200);
      expect(thread.status).toBe('open');
      expect(thread.comments).toHaveLength(1);
      expect(thread.comments[0].content).toBe('This needs review');
      expect(thread.comments[0].threadId).toBe(thread.id);
    });

    it('rejects empty content', () => {
      const { error } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: '   ',
        },
      );
      expect(error).toContain('empty');
    });

    it('rejects content exceeding max length', () => {
      const { error } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'x'.repeat(MAX_COMMENT_LENGTH + 1),
        },
      );
      expect(error).toContain(`${MAX_COMMENT_LENGTH}`);
    });

    it('extracts mentions from first comment', () => {
      const { thread } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'Hey @bob and @carol, check this out',
        },
      );
      expect(thread.comments[0].mentions).toContain('bob');
      expect(thread.comments[0].mentions).toContain('carol');
    });
  });

  describe('addReply', () => {
    let thread: CommentThread;

    beforeEach(() => {
      const result = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'Initial comment',
        },
      );
      thread = result.thread;
    });

    it('adds a reply to a thread', () => {
      const { thread: updated, error } = addReply(thread, {
        authorId: 'user-2',
        authorName: 'Bob',
        content: 'I agree',
      });
      expect(error).toBeUndefined();
      expect(updated.comments).toHaveLength(2);
      expect(updated.comments[1].authorName).toBe('Bob');
    });

    it('rejects empty reply', () => {
      const { error } = addReply(thread, {
        authorId: 'user-2',
        authorName: 'Bob',
        content: '',
      });
      expect(error).toContain('empty');
    });

    it('rejects reply exceeding max length', () => {
      const { error } = addReply(thread, {
        authorId: 'user-2',
        authorName: 'Bob',
        content: 'y'.repeat(MAX_COMMENT_LENGTH + 1),
      });
      expect(error).toContain(`${MAX_COMMENT_LENGTH}`);
    });

    it('enforces maximum comments per thread', () => {
      let current = thread;
      // Fill up thread to max
      for (let i = 1; i < MAX_COMMENTS_PER_THREAD; i++) {
        const { thread: updated } = addReply(current, {
          authorId: `user-${i}`,
          authorName: `User ${i}`,
          content: `Reply ${i}`,
        });
        current = updated;
      }
      const { error } = addReply(current, {
        authorId: 'overflow',
        authorName: 'Overflow',
        content: 'Too many',
      });
      expect(error).toContain('maximum');
    });
  });

  describe('editComment', () => {
    it('edits a comment and marks as edited', () => {
      const { thread } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'Original',
        },
      );
      const commentId = thread.comments[0].id;
      const { thread: updated, error } = editComment(
        thread,
        commentId,
        'Edited content',
      );
      expect(error).toBeUndefined();
      expect(updated.comments[0].content).toBe('Edited content');
      expect(updated.comments[0].isEdited).toBe(true);
      expect(updated.comments[0].updatedAt).toBeDefined();
    });

    it('rejects empty edit', () => {
      const { thread } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'Original',
        },
      );
      const { error } = editComment(thread, thread.comments[0].id, '');
      expect(error).toContain('empty');
    });
  });

  describe('deleteComment', () => {
    it('removes a comment from thread', () => {
      const { thread } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'First',
        },
      );
      const { thread: withReply } = addReply(thread, {
        authorId: 'user-2',
        authorName: 'Bob',
        content: 'Second',
      });
      const { thread: afterDelete } = deleteComment(
        withReply,
        withReply.comments[0].id,
      );
      expect(afterDelete).not.toBeNull();
      expect(afterDelete!.comments).toHaveLength(1);
      expect(afterDelete!.comments[0].content).toBe('Second');
    });

    it('returns null when last comment is deleted', () => {
      const { thread } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'Only comment',
        },
      );
      const { thread: afterDelete } = deleteComment(
        thread,
        thread.comments[0].id,
      );
      expect(afterDelete).toBeNull();
    });
  });

  describe('resolveThread / reopenThread', () => {
    it('resolves a thread', () => {
      const { thread } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'Fix this',
        },
      );
      const resolved = resolveThread(thread, 'user-2');
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedBy).toBe('user-2');
      expect(resolved.resolvedAt).toBeDefined();
    });

    it('reopens a resolved thread', () => {
      const { thread } = createCommentThread(
        1,
        { x: 0, y: 0 },
        {
          authorId: 'user-1',
          authorName: 'Alice',
          content: 'Fix this',
        },
      );
      const resolved = resolveThread(thread, 'user-2');
      const reopened = reopenThread(resolved);
      expect(reopened.status).toBe('open');
      expect(reopened.resolvedAt).toBeUndefined();
      expect(reopened.resolvedBy).toBeUndefined();
    });
  });

  /* ═══════ Query helpers ═══════ */
  describe('thread queries', () => {
    let threads: CommentThread[];

    beforeEach(() => {
      const t1 = createCommentThread(
        1,
        { x: 0, y: 0 },
        { authorId: 'u1', authorName: 'A', content: 'Page 1 thread' },
      ).thread;
      const t2 = createCommentThread(
        2,
        { x: 0, y: 0 },
        { authorId: 'u2', authorName: 'B', content: 'Page 2 thread' },
      ).thread;
      const t3 = resolveThread(
        createCommentThread(
          1,
          { x: 50, y: 50 },
          { authorId: 'u3', authorName: 'C', content: 'Resolved thread' },
        ).thread,
        'u1',
      );
      threads = [t1, t2, t3];
    });

    it('filters by page', () => {
      expect(getThreadsForPage(threads, 1)).toHaveLength(2);
      expect(getThreadsForPage(threads, 2)).toHaveLength(1);
    });

    it('gets open threads', () => {
      expect(getOpenThreads(threads)).toHaveLength(2);
    });

    it('gets resolved threads', () => {
      expect(getResolvedThreads(threads)).toHaveLength(1);
    });

    it('counts total comments', () => {
      expect(countTotalComments(threads)).toBe(3);
    });
  });

  /* ═══════ Mentions ═══════ */
  describe('extractMentions / isMentioned', () => {
    it('extracts @mentions', () => {
      expect(extractMentions('Hello @alice and @bob')).toEqual([
        'alice',
        'bob',
      ]);
    });

    it('deduplicates mentions', () => {
      expect(extractMentions('@alice said @alice was right')).toEqual([
        'alice',
      ]);
    });

    it('handles no mentions', () => {
      expect(extractMentions('No tags here')).toEqual([]);
    });

    it('supports dots and dashes', () => {
      const mentions = extractMentions('@john.doe and @jane-smith');
      expect(mentions).toContain('john.doe');
      expect(mentions).toContain('jane-smith');
    });

    it('checks if user is mentioned in text', () => {
      expect(isMentioned('@alice review this', 'alice')).toBe(true);
      expect(isMentioned('@alice review this', 'bob')).toBe(false);
    });
  });

  /* ═══════ Review workflow ═══════ */
  describe('createReviewRequest / submitReviewDecision', () => {
    let review: ReviewRequest;

    beforeEach(() => {
      review = createReviewRequest(
        'doc-1',
        { userId: 'user-1', name: 'Alice' },
        [
          { userId: 'user-2', displayName: 'Bob' },
          { userId: 'user-3', displayName: 'Carol' },
        ],
        'Please review this document',
      );
    });

    it('creates a review request', () => {
      expect(review.documentId).toBe('doc-1');
      expect(review.requesterId).toBe('user-1');
      expect(review.status).toBe('in-review');
      expect(review.reviewers).toHaveLength(2);
      expect(review.message).toBe('Please review this document');
    });

    it('approves when all approve', () => {
      let r = submitReviewDecision(review, 'user-2', 'approved');
      expect(r.status).toBe('in-review'); // Still one pending
      r = submitReviewDecision(r, 'user-3', 'approved');
      expect(r.status).toBe('approved');
    });

    it('rejects if any reviewer rejects', () => {
      const r = submitReviewDecision(review, 'user-2', 'rejected');
      expect(r.status).toBe('rejected');
    });

    it('changes-requested if any reviewer requests changes', () => {
      const r = submitReviewDecision(review, 'user-3', 'changes-requested');
      expect(r.status).toBe('changes-requested');
    });

    it('tracks review completion', () => {
      expect(isReviewComplete(review)).toBe(false);
      expect(countPendingReviewers(review)).toBe(2);
      const r1 = submitReviewDecision(review, 'user-2', 'approved');
      expect(countPendingReviewers(r1)).toBe(1);
      const r2 = submitReviewDecision(r1, 'user-3', 'approved');
      expect(isReviewComplete(r2)).toBe(true);
      expect(countPendingReviewers(r2)).toBe(0);
    });
  });

  describe('getReviewStatusLabel / getReviewStatusColor', () => {
    it('returns labels for known statuses', () => {
      expect(getReviewStatusLabel('in-review')).toBeTruthy();
      expect(getReviewStatusLabel('approved')).toBeTruthy();
    });

    it('returns colors for known statuses', () => {
      expect(getReviewStatusColor('approved')).toMatch(/^#/);
      expect(getReviewStatusColor('rejected')).toMatch(/^#/);
    });
  });

  /* ═══════ Activity log ═══════ */
  describe('activity log', () => {
    it('creates an activity entry', () => {
      const entry = createActivityEntry(
        'annotation-added',
        { userId: 'user-1', userName: 'Alice' },
        'Added a highlight',
        3,
      );
      expect(entry.action).toBe('annotation-added');
      expect(entry.userId).toBe('user-1');
      expect(entry.description).toBe('Added a highlight');
      expect(entry.page).toBe(3);
    });

    it('returns labels and icons for actions', () => {
      expect(getActivityActionLabel('annotation-added')).toBeTruthy();
      expect(getActivityActionIcon('annotation-added')).toBeTruthy();
    });

    it('filters by page', () => {
      const a1 = createActivityEntry(
        'annotation-added',
        { userId: 'u1', userName: 'A' },
        'Highlight',
        1,
      );
      const a2 = createActivityEntry(
        'page-added',
        { userId: 'u1', userName: 'A' },
        'Added page',
        2,
      );
      const a3 = createActivityEntry(
        'comment-added',
        { userId: 'u2', userName: 'B' },
        'Comment',
        1,
      );
      expect(getActivitiesForPage([a1, a2, a3], 1)).toHaveLength(2);
      expect(getActivitiesForPage([a1, a2, a3], 2)).toHaveLength(1);
    });

    it('filters by user', () => {
      const a1 = createActivityEntry(
        'annotation-added',
        { userId: 'u1', userName: 'A' },
        'one',
      );
      const a2 = createActivityEntry(
        'page-added',
        { userId: 'u2', userName: 'B' },
        'two',
      );
      expect(getActivitiesByUser([a1, a2], 'u1')).toHaveLength(1);
    });

    it('returns recent activities sorted by time', () => {
      const activities = Array.from({ length: 5 }, (_, i) =>
        createActivityEntry(
          'annotation-added',
          { userId: 'u1', userName: 'A' },
          `Activity ${i}`,
          i + 1,
        ),
      );
      const recent = getRecentActivities(activities, 3);
      expect(recent).toHaveLength(3);
      // Most recent first
      expect(recent[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        recent[1].timestamp.getTime(),
      );
    });
  });
});
