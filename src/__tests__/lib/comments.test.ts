// SPDX-License-Identifier: Apache-2.0
/**
 * Platform-Wide Comment System — Tests
 * Sprint 13.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createComment,
  editComment,
  deleteComment,
  buildThreads,
  sortThreads,
  resolveThread,
  reopenThread,
  toggleReaction,
  getTotalReactions,
  extractMentions,
  validateMentions,
  buildCommentQuery,
  computeCommentStats,
  sanitizeCommentBody,
  resetCommentIdCounter,
  MAX_COMMENT_BODY_LENGTH,
  ALLOWED_REACTION_EMOJIS,
  type CommentData,
  type CommentAuthor,
  type CommentThread,
} from '@/lib/comments';

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Helpers                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

const author: CommentAuthor = {
  userId: 'user1',
  displayName: 'Alice',
  avatarUrl: 'https://example.com/alice.png',
};

function makeComment(overrides: Partial<CommentData> = {}): CommentData {
  return {
    id: 'cmt-1',
    targetType: 'asset',
    targetId: 'asset-1',
    orgId: 'org-1',
    parentId: null,
    author,
    body: 'Test comment',
    mentions: [],
    reactions: [],
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date('2024-06-15T10:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  resetCommentIdCounter();
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  createComment                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('createComment', () => {
  it('creates a valid comment', () => {
    const { comment, error } = createComment({
      targetType: 'asset',
      targetId: 'asset-1',
      orgId: 'org-1',
      author,
      body: 'Great image!',
    });
    expect(error).toBeUndefined();
    expect(comment).not.toBeNull();
    expect(comment!.id).toBe('cmt-1');
    expect(comment!.body).toBe('Great image!');
    expect(comment!.parentId).toBeNull();
  });

  it('creates a reply (with parentId)', () => {
    const { comment } = createComment({
      targetType: 'asset',
      targetId: 'asset-1',
      orgId: 'org-1',
      author,
      body: 'Reply text',
      parentId: 'cmt-parent',
    });
    expect(comment!.parentId).toBe('cmt-parent');
  });

  it('rejects empty body', () => {
    const { comment, error } = createComment({
      targetType: 'asset',
      targetId: 'asset-1',
      orgId: 'org-1',
      author,
      body: '   ',
    });
    expect(comment).toBeNull();
    expect(error).toContain('empty');
  });

  it('rejects overly long body', () => {
    const { comment, error } = createComment({
      targetType: 'asset',
      targetId: 'asset-1',
      orgId: 'org-1',
      author,
      body: 'x'.repeat(MAX_COMMENT_BODY_LENGTH + 1),
    });
    expect(comment).toBeNull();
    expect(error).toContain('maximum length');
  });

  it('rejects missing author', () => {
    const { error } = createComment({
      targetType: 'asset',
      targetId: 'asset-1',
      orgId: 'org-1',
      author: { userId: '', displayName: '' },
      body: 'Hello',
    });
    expect(error).toContain('Author');
  });

  it('rejects missing targetId', () => {
    const { error } = createComment({
      targetType: 'asset',
      targetId: '',
      orgId: 'org-1',
      author,
      body: 'Hello',
    });
    expect(error).toContain('targetId');
  });

  it('extracts mentions', () => {
    const { comment } = createComment({
      targetType: 'asset',
      targetId: 'asset-1',
      orgId: 'org-1',
      author,
      body: 'Hey @alice and @[Bob](user-bob) check this out',
    });
    expect(comment!.mentions).toContain('alice');
    expect(comment!.mentions).toContain('user-bob');
  });

  it('increments IDs', () => {
    const { comment: c1 } = createComment({
      targetType: 'asset',
      targetId: 'a',
      orgId: 'o',
      author,
      body: 'First',
    });
    const { comment: c2 } = createComment({
      targetType: 'asset',
      targetId: 'a',
      orgId: 'o',
      author,
      body: 'Second',
    });
    expect(c1!.id).toBe('cmt-1');
    expect(c2!.id).toBe('cmt-2');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  editComment                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('editComment', () => {
  it('edits comment body', () => {
    const original = makeComment();
    const { comment } = editComment(
      original,
      { body: 'Updated text' },
      'user1',
    );
    expect(comment!.body).toBe('Updated text');
    expect(comment!.editedAt).not.toBeNull();
  });

  it('re-extracts mentions on edit', () => {
    const original = makeComment();
    const { comment } = editComment(original, { body: 'Hey @bob' }, 'user1');
    expect(comment!.mentions).toContain('bob');
  });

  it('rejects edit from non-author', () => {
    const original = makeComment();
    const { error } = editComment(original, { body: 'Hacked' }, 'user2');
    expect(error).toContain('author');
  });

  it('rejects edit of deleted comment', () => {
    const original = makeComment({ deletedAt: new Date() });
    const { error } = editComment(original, { body: 'Update' }, 'user1');
    expect(error).toContain('deleted');
  });

  it('rejects empty body', () => {
    const original = makeComment();
    const { error } = editComment(original, { body: '' }, 'user1');
    expect(error).toContain('empty');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  deleteComment                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('deleteComment', () => {
  it('soft-deletes a comment', () => {
    const original = makeComment();
    const { comment } = deleteComment(original, 'user1');
    expect(comment!.deletedAt).not.toBeNull();
    expect(comment!.body).toBe('[deleted]');
  });

  it('allows admin to delete any comment', () => {
    const original = makeComment();
    const { comment } = deleteComment(original, 'admin-user', true);
    expect(comment!.deletedAt).not.toBeNull();
  });

  it('rejects delete from non-author non-admin', () => {
    const original = makeComment();
    const { error } = deleteComment(original, 'user2', false);
    expect(error).toContain('author or an admin');
  });

  it('rejects double delete', () => {
    const original = makeComment({ deletedAt: new Date() });
    const { error } = deleteComment(original, 'user1');
    expect(error).toContain('already deleted');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Threading                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildThreads', () => {
  it('groups comments into threads', () => {
    const root = makeComment({ id: 'cmt-root', parentId: null });
    const reply1 = makeComment({
      id: 'cmt-r1',
      parentId: 'cmt-root',
      createdAt: new Date('2024-06-15T11:00:00Z'),
    });
    const reply2 = makeComment({
      id: 'cmt-r2',
      parentId: 'cmt-root',
      createdAt: new Date('2024-06-15T12:00:00Z'),
    });
    const standalone = makeComment({ id: 'cmt-standalone', parentId: null });

    const threads = buildThreads([root, reply1, reply2, standalone]);
    expect(threads).toHaveLength(2);

    const rootThread = threads.find((t) => t.root.id === 'cmt-root')!;
    expect(rootThread.replies).toHaveLength(2);
    expect(rootThread.replyCount).toBe(2);
  });

  it('sorts replies chronologically within thread', () => {
    const root = makeComment({ id: 'root', parentId: null });
    const older = makeComment({
      id: 'older',
      parentId: 'root',
      createdAt: new Date('2024-01-01'),
    });
    const newer = makeComment({
      id: 'newer',
      parentId: 'root',
      createdAt: new Date('2024-06-01'),
    });

    const threads = buildThreads([root, newer, older]);
    expect(threads[0].replies[0].id).toBe('older');
    expect(threads[0].replies[1].id).toBe('newer');
  });

  it('reflects resolved state', () => {
    const root = makeComment({ resolved: true });
    const threads = buildThreads([root]);
    expect(threads[0].isResolved).toBe(true);
  });
});

describe('sortThreads', () => {
  const thread1: CommentThread = {
    root: makeComment({ id: 't1', createdAt: new Date('2024-01-01') }),
    replies: [],
    replyCount: 0,
    lastActivity: new Date('2024-06-01'),
    isResolved: false,
  };
  const thread2: CommentThread = {
    root: makeComment({ id: 't2', createdAt: new Date('2024-03-01') }),
    replies: [],
    replyCount: 0,
    lastActivity: new Date('2024-03-01'),
    isResolved: false,
  };

  it('sorts newest first', () => {
    const sorted = sortThreads([thread2, thread1], 'newest');
    expect(sorted[0].root.id).toBe('t1'); // most recent activity
  });

  it('sorts oldest first', () => {
    const sorted = sortThreads([thread2, thread1], 'oldest');
    expect(sorted[0].root.id).toBe('t1'); // oldest creation date
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Resolve / Reopen                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('resolveThread', () => {
  it('resolves an open thread', () => {
    const root = makeComment();
    const { comment } = resolveThread(root, 'resolver1');
    expect(comment.resolved).toBe(true);
    expect(comment.resolvedBy).toBe('resolver1');
    expect(comment.resolvedAt).not.toBeNull();
  });

  it('rejects resolving a reply', () => {
    const reply = makeComment({ parentId: 'parent' });
    const { error } = resolveThread(reply, 'u1');
    expect(error).toContain('root');
  });

  it('rejects resolving already resolved', () => {
    const root = makeComment({ resolved: true });
    const { error } = resolveThread(root, 'u1');
    expect(error).toContain('already resolved');
  });
});

describe('reopenThread', () => {
  it('reopens a resolved thread', () => {
    const root = makeComment({
      resolved: true,
      resolvedBy: 'u1',
      resolvedAt: new Date(),
    });
    const { comment } = reopenThread(root);
    expect(comment.resolved).toBe(false);
    expect(comment.resolvedBy).toBeNull();
  });

  it('rejects reopening already open thread', () => {
    const root = makeComment();
    const { error } = reopenThread(root);
    expect(error).toContain('not resolved');
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Reactions                                                              */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('toggleReaction', () => {
  it('adds a new reaction', () => {
    const comment = makeComment();
    const { comment: updated, added } = toggleReaction(comment, '👍', 'user1');
    expect(added).toBe(true);
    expect(updated.reactions).toHaveLength(1);
    expect(updated.reactions[0].count).toBe(1);
  });

  it('adds user to existing reaction', () => {
    const comment = makeComment({
      reactions: [{ emoji: '👍', userIds: ['user1'], count: 1 }],
    });
    const { comment: updated, added } = toggleReaction(comment, '👍', 'user2');
    expect(added).toBe(true);
    expect(updated.reactions[0].count).toBe(2);
  });

  it('removes reaction on toggle', () => {
    const comment = makeComment({
      reactions: [{ emoji: '👍', userIds: ['user1'], count: 1 }],
    });
    const { comment: updated, added } = toggleReaction(comment, '👍', 'user1');
    expect(added).toBe(false);
    expect(updated.reactions).toHaveLength(0);
  });

  it('rejects invalid emoji', () => {
    const { error } = toggleReaction(makeComment(), '💀', 'user1');
    expect(error).toContain('not in the allowed set');
  });
});

describe('getTotalReactions', () => {
  it('sums all reaction counts', () => {
    const comment = makeComment({
      reactions: [
        { emoji: '👍', userIds: ['u1', 'u2'], count: 2 },
        { emoji: '❤️', userIds: ['u1'], count: 1 },
      ],
    });
    expect(getTotalReactions(comment)).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Mentions                                                               */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('extractMentions', () => {
  it('extracts rich mentions @[Name](id)', () => {
    const mentions = extractMentions('Hey @[Alice](user1) and @[Bob](user2)');
    expect(mentions).toContain('user1');
    expect(mentions).toContain('user2');
  });

  it('extracts simple @username mentions', () => {
    const mentions = extractMentions('Hey @alice and @bob');
    expect(mentions).toContain('alice');
    expect(mentions).toContain('bob');
  });

  it('deduplicates mentions', () => {
    const mentions = extractMentions('@alice @alice @alice');
    expect(mentions).toHaveLength(1);
  });

  it('returns empty for no mentions', () => {
    expect(extractMentions('No mentions here')).toEqual([]);
  });
});

describe('validateMentions', () => {
  it('separates valid and invalid mentions', () => {
    const { valid, invalid } = validateMentions(
      ['user1', 'user2', 'user3'],
      ['user1', 'user3'],
    );
    expect(valid).toEqual(['user1', 'user3']);
    expect(invalid).toEqual(['user2']);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Query Builder                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('buildCommentQuery', () => {
  it('builds basic query', () => {
    const query = buildCommentQuery({ orgId: 'org-1' });
    expect(query.orgId).toBe('org-1');
    expect(query.deletedAt).toBeNull();
  });

  it('adds optional filters', () => {
    const query = buildCommentQuery({
      orgId: 'org-1',
      targetType: 'asset',
      targetId: 'a1',
      resolved: false,
      authorId: 'u1',
      parentId: null,
    });
    expect(query.targetType).toBe('asset');
    expect(query.targetId).toBe('a1');
    expect(query.resolved).toBe(false);
    expect(query['author.userId']).toBe('u1');
    expect(query.parentId).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Statistics                                                             */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('computeCommentStats', () => {
  it('computes statistics', () => {
    const comments = [
      makeComment({ id: 'c1', parentId: null, resolved: false }),
      makeComment({
        id: 'c2',
        parentId: null,
        resolved: true,
        mentions: ['user2'],
      }),
      makeComment({
        id: 'c3',
        parentId: 'c1',
        author: { ...author, userId: 'user2', displayName: 'Bob' },
      }),
    ];
    const stats = computeCommentStats(comments);
    expect(stats.totalComments).toBe(3);
    expect(stats.totalThreads).toBe(2);
    expect(stats.resolvedThreads).toBe(1);
    expect(stats.openThreads).toBe(1);
    expect(stats.uniqueAuthors).toBe(2);
    expect(stats.topMentioned).toHaveLength(1);
    expect(stats.topMentioned[0].userId).toBe('user2');
  });

  it('excludes deleted comments', () => {
    const comments = [
      makeComment({ deletedAt: new Date() }),
      makeComment({ id: 'c2' }),
    ];
    const stats = computeCommentStats(comments);
    expect(stats.totalComments).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════ */
/*  Sanitization                                                           */
/* ═══════════════════════════════════════════════════════════════════════ */

describe('sanitizeCommentBody', () => {
  it('strips script tags', () => {
    expect(
      sanitizeCommentBody('Hello <script>alert("xss")</script> world'),
    ).toBe('Hello  world');
  });

  it('strips style tags', () => {
    expect(sanitizeCommentBody('<style>body{display:none}</style>Hi')).toBe(
      'Hi',
    );
  });

  it('strips iframe tags', () => {
    expect(sanitizeCommentBody('<iframe src="evil.com"></iframe>text')).toBe(
      'text',
    );
  });

  it('strips onclick attributes', () => {
    expect(sanitizeCommentBody('<div onclick="evil()">ok</div>')).toBe(
      '<div >ok</div>',
    );
  });

  it('strips javascript: protocol', () => {
    expect(
      sanitizeCommentBody('click <a href="javascript:alert(1)">here</a>'),
    ).toBe('click <a href="alert(1)">here</a>');
  });

  it('preserves safe text', () => {
    expect(sanitizeCommentBody('Normal **bold** text')).toBe(
      'Normal **bold** text',
    );
  });
});
