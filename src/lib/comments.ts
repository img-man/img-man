// SPDX-License-Identifier: Apache-2.0
/**
 * Platform-Wide Comment System — Sprint 13.2
 *
 * Provides a universal commenting engine for any entity (asset, design, folder):
 * - Comment CRUD (create, edit, delete)
 * - Threading (replies to parent comments)
 * - @mention extraction and validation
 * - Reactions (emoji-based)
 * - Thread resolution (resolve/reopen)
 * - Pagination & filtering
 * - Rich text sanitization
 *
 * Note: Pure state-transform functions. Actual MongoDB persistence
 * is handled by server actions. This is the platform-wide complement
 * to the PDF-editor-specific comment-engine.ts.
 */

/* ══════════════════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════════════════ */

export type CommentTargetType = 'asset' | 'design' | 'folder' | 'page';

export type CommentSortOrder = 'newest' | 'oldest' | 'most-reactions';

export interface CommentAuthor {
  userId: string;
  displayName: string;
  avatarUrl?: string;
}

export interface CommentReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface CommentData {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  orgId: string;
  parentId: string | null;
  author: CommentAuthor;
  body: string;
  mentions: string[];
  reactions: CommentReaction[];
  resolved: boolean;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface CommentThread {
  root: CommentData;
  replies: CommentData[];
  replyCount: number;
  lastActivity: Date;
  isResolved: boolean;
}

export interface CommentCreateInput {
  targetType: CommentTargetType;
  targetId: string;
  orgId: string;
  author: CommentAuthor;
  body: string;
  parentId?: string | null;
}

export interface CommentUpdateInput {
  body: string;
}

export interface CommentQueryFilters {
  targetType?: CommentTargetType;
  targetId?: string;
  orgId: string;
  resolved?: boolean;
  authorId?: string;
  parentId?: string | null;
  sortOrder?: CommentSortOrder;
}

export interface CommentStats {
  totalComments: number;
  totalThreads: number;
  resolvedThreads: number;
  openThreads: number;
  uniqueAuthors: number;
  topMentioned: { userId: string; count: number }[];
}

/* ══════════════════════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════════════════════ */

export const MAX_COMMENT_BODY_LENGTH = 5000;
export const MAX_MENTIONS_PER_COMMENT = 20;
export const MAX_REACTIONS_PER_COMMENT = 50;
export const MAX_REPLY_DEPTH = 1; // flat replies only (no nested threads)

export const ALLOWED_REACTION_EMOJIS = [
  '👍',
  '👎',
  '❤️',
  '🎉',
  '😄',
  '😕',
  '🚀',
  '👀',
  '✅',
  '❌',
  '🔥',
  '💯',
  '⭐',
  '🤔',
  '👏',
  '🙏',
] as const;

/** Regex to extract @mentions from comment body */
const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

/** Simpler @username mention regex */
const SIMPLE_MENTION_REGEX = /@(\w{3,30})/g;

/* ══════════════════════════════════════════════════════════════════════════
   ID counter (resettable for testing)
   ══════════════════════════════════════════════════════════════════════════ */

let nextCommentId = 1;

export function resetCommentIdCounter(): void {
  nextCommentId = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   Comment CRUD
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Create a new comment (or reply). Validates body length and extracts mentions.
 */
export function createComment(input: CommentCreateInput): {
  comment: CommentData | null;
  error?: string;
} {
  const body = input.body.trim();

  if (!body) {
    return { comment: null, error: 'Comment body cannot be empty' };
  }

  if (body.length > MAX_COMMENT_BODY_LENGTH) {
    return {
      comment: null,
      error: `Comment exceeds maximum length of ${MAX_COMMENT_BODY_LENGTH} characters`,
    };
  }

  if (!input.author.userId || !input.author.displayName) {
    return {
      comment: null,
      error: 'Author userId and displayName are required',
    };
  }

  if (!input.targetId) {
    return { comment: null, error: 'targetId is required' };
  }

  const mentions = extractMentions(body).slice(0, MAX_MENTIONS_PER_COMMENT);

  const comment: CommentData = {
    id: `cmt-${nextCommentId++}`,
    targetType: input.targetType,
    targetId: input.targetId,
    orgId: input.orgId,
    parentId: input.parentId ?? null,
    author: { ...input.author },
    body,
    mentions,
    reactions: [],
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date(),
  };

  return { comment };
}

/**
 * Edit an existing comment's body. Re-extracts mentions.
 */
export function editComment(
  comment: CommentData,
  update: CommentUpdateInput,
  editorUserId: string,
): { comment: CommentData | null; error?: string } {
  if (comment.deletedAt) {
    return { comment: null, error: 'Cannot edit a deleted comment' };
  }

  if (comment.author.userId !== editorUserId) {
    return { comment: null, error: 'Only the author can edit this comment' };
  }

  const body = update.body.trim();
  if (!body) {
    return { comment: null, error: 'Comment body cannot be empty' };
  }

  if (body.length > MAX_COMMENT_BODY_LENGTH) {
    return {
      comment: null,
      error: `Comment exceeds maximum length of ${MAX_COMMENT_BODY_LENGTH} characters`,
    };
  }

  const mentions = extractMentions(body).slice(0, MAX_MENTIONS_PER_COMMENT);

  return {
    comment: {
      ...comment,
      body,
      mentions,
      editedAt: new Date(),
    },
  };
}

/**
 * Soft-delete a comment (marks as deleted, preserves for audit).
 */
export function deleteComment(
  comment: CommentData,
  requesterUserId: string,
  isAdmin: boolean = false,
): { comment: CommentData | null; error?: string } {
  if (comment.deletedAt) {
    return { comment: null, error: 'Comment is already deleted' };
  }

  if (comment.author.userId !== requesterUserId && !isAdmin) {
    return {
      comment: null,
      error: 'Only the author or an admin can delete this comment',
    };
  }

  return {
    comment: {
      ...comment,
      deletedAt: new Date(),
      body: '[deleted]',
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Thread Management
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build comment threads from a flat list of comments.
 * Groups replies under their parent and sorts by activity.
 */
export function buildThreads(
  comments: CommentData[],
  sortOrder: CommentSortOrder = 'newest',
): CommentThread[] {
  // Separate root comments (no parentId) and replies
  const roots: CommentData[] = [];
  const repliesByParent = new Map<string, CommentData[]>();

  for (const comment of comments) {
    if (comment.parentId === null) {
      roots.push(comment);
    } else {
      const existing = repliesByParent.get(comment.parentId) ?? [];
      existing.push(comment);
      repliesByParent.set(comment.parentId, existing);
    }
  }

  // Build threads
  const threads: CommentThread[] = roots.map((root) => {
    const replies = (repliesByParent.get(root.id) ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const allDates = [root.createdAt, ...replies.map((r) => r.createdAt)];
    const lastActivity = new Date(
      Math.max(...allDates.map((d) => d.getTime())),
    );

    return {
      root,
      replies,
      replyCount: replies.length,
      lastActivity,
      isResolved: root.resolved,
    };
  });

  // Sort threads
  return sortThreads(threads, sortOrder);
}

/**
 * Sort threads by the specified order.
 */
export function sortThreads(
  threads: CommentThread[],
  sortOrder: CommentSortOrder,
): CommentThread[] {
  const sorted = [...threads];
  switch (sortOrder) {
    case 'newest':
      return sorted.sort(
        (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
      );
    case 'oldest':
      return sorted.sort(
        (a, b) => a.root.createdAt.getTime() - b.root.createdAt.getTime(),
      );
    case 'most-reactions': {
      const totalReactions = (t: CommentThread) =>
        t.root.reactions.reduce((sum, r) => sum + r.count, 0) +
        t.replies.reduce(
          (sum, reply) =>
            sum + reply.reactions.reduce((s, r) => s + r.count, 0),
          0,
        );
      return sorted.sort((a, b) => totalReactions(b) - totalReactions(a));
    }
    default:
      return sorted;
  }
}

/**
 * Resolve a comment thread (mark as resolved).
 */
export function resolveThread(
  root: CommentData,
  resolverUserId: string,
): { comment: CommentData; error?: string } {
  if (root.parentId !== null) {
    return { comment: root, error: 'Only root comments can be resolved' };
  }

  if (root.resolved) {
    return { comment: root, error: 'Thread is already resolved' };
  }

  return {
    comment: {
      ...root,
      resolved: true,
      resolvedBy: resolverUserId,
      resolvedAt: new Date(),
    },
  };
}

/**
 * Reopen a resolved comment thread.
 */
export function reopenThread(root: CommentData): {
  comment: CommentData;
  error?: string;
} {
  if (!root.resolved) {
    return { comment: root, error: 'Thread is not resolved' };
  }

  return {
    comment: {
      ...root,
      resolved: false,
      resolvedBy: null,
      resolvedAt: null,
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Reactions
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Toggle a reaction on a comment. If the user already reacted with this
 * emoji, remove it; otherwise add it.
 */
export function toggleReaction(
  comment: CommentData,
  emoji: string,
  userId: string,
): { comment: CommentData; added: boolean; error?: string } {
  if (
    !ALLOWED_REACTION_EMOJIS.includes(
      emoji as (typeof ALLOWED_REACTION_EMOJIS)[number],
    )
  ) {
    return {
      comment,
      added: false,
      error: `Emoji "${emoji}" is not in the allowed set`,
    };
  }

  const reactions = [...comment.reactions];
  const existingIdx = reactions.findIndex((r) => r.emoji === emoji);

  if (existingIdx >= 0) {
    const existing = reactions[existingIdx];
    if (existing.userIds.includes(userId)) {
      // Remove user's reaction
      const newUserIds = existing.userIds.filter((id) => id !== userId);
      if (newUserIds.length === 0) {
        reactions.splice(existingIdx, 1);
      } else {
        reactions[existingIdx] = {
          ...existing,
          userIds: newUserIds,
          count: newUserIds.length,
        };
      }
      return { comment: { ...comment, reactions }, added: false };
    } else {
      // Add user to existing reaction
      const newUserIds = [...existing.userIds, userId];
      reactions[existingIdx] = {
        ...existing,
        userIds: newUserIds,
        count: newUserIds.length,
      };
      return { comment: { ...comment, reactions }, added: true };
    }
  }

  // New reaction emoji
  if (reactions.length >= MAX_REACTIONS_PER_COMMENT) {
    return {
      comment,
      added: false,
      error: `Maximum of ${MAX_REACTIONS_PER_COMMENT} unique reactions reached`,
    };
  }

  reactions.push({ emoji, userIds: [userId], count: 1 });
  return { comment: { ...comment, reactions }, added: true };
}

/**
 * Get the total reaction count for a comment.
 */
export function getTotalReactions(comment: CommentData): number {
  return comment.reactions.reduce((sum, r) => sum + r.count, 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   Mention Extraction
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Extract @mentions from comment body.
 * Supports both rich format @[Name](userId) and simple @username.
 */
export function extractMentions(body: string): string[] {
  const mentions = new Set<string>();

  // Rich format: @[Display Name](userId)
  let match: RegExpExecArray | null;
  const richRegex = new RegExp(MENTION_REGEX.source, 'g');
  while ((match = richRegex.exec(body)) !== null) {
    mentions.add(match[2]); // userId
  }

  // Simple format: @username
  const simpleRegex = new RegExp(SIMPLE_MENTION_REGEX.source, 'g');
  while ((match = simpleRegex.exec(body)) !== null) {
    mentions.add(match[1]); // username
  }

  return Array.from(mentions);
}

/**
 * Validate that mentioned users belong to the organization.
 */
export function validateMentions(
  mentions: string[],
  orgMemberIds: string[],
): { valid: string[]; invalid: string[] } {
  const memberSet = new Set(orgMemberIds);
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const mention of mentions) {
    if (memberSet.has(mention)) {
      valid.push(mention);
    } else {
      invalid.push(mention);
    }
  }

  return { valid, invalid };
}

/* ══════════════════════════════════════════════════════════════════════════
   Query & Filter Helpers
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Build a MongoDB-compatible query from comment filters.
 */
export function buildCommentQuery(
  filters: CommentQueryFilters,
): Record<string, unknown> {
  const query: Record<string, unknown> = {
    orgId: filters.orgId,
    deletedAt: null, // Exclude soft-deleted
  };

  if (filters.targetType) query.targetType = filters.targetType;
  if (filters.targetId) query.targetId = filters.targetId;
  if (filters.resolved !== undefined) query.resolved = filters.resolved;
  if (filters.authorId) query['author.userId'] = filters.authorId;
  if (filters.parentId !== undefined) query.parentId = filters.parentId;

  return query;
}

/* ══════════════════════════════════════════════════════════════════════════
   Statistics
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Compute statistics from a list of comments.
 */
export function computeCommentStats(comments: CommentData[]): CommentStats {
  const active = comments.filter((c) => c.deletedAt === null);
  const roots = active.filter((c) => c.parentId === null);
  const resolvedRoots = roots.filter((c) => c.resolved);
  const authors = new Set(active.map((c) => c.author.userId));

  // Count mentions
  const mentionCounts = new Map<string, number>();
  for (const comment of active) {
    for (const mention of comment.mentions) {
      mentionCounts.set(mention, (mentionCounts.get(mention) ?? 0) + 1);
    }
  }

  const topMentioned = Array.from(mentionCounts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalComments: active.length,
    totalThreads: roots.length,
    resolvedThreads: resolvedRoots.length,
    openThreads: roots.length - resolvedRoots.length,
    uniqueAuthors: authors.size,
    topMentioned,
  };
}

/**
 * Sanitize comment body — strip dangerous HTML/script tags while
 * preserving basic formatting markers.
 */
export function sanitizeCommentBody(body: string): string {
  return body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, '')
    .trim();
}
