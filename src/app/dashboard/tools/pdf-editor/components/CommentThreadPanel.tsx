// SPDX-License-Identifier: Apache-2.0
/**
 * CommentThreadPanel — Phase 6, Week 22
 *
 * Left sidebar panel showing:
 * - Comment thread list for current page
 * - Add new comment at position
 * - Reply to threads, edit, delete
 * - Resolve / reopen threads
 * - Review workflow status & actions
 * - Activity log feed
 */

'use client';

import { useState, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Check,
  RotateCcw,
  Send,
  Edit3,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Star,
} from 'lucide-react';
import type {
  CommentThread,
  Comment,
  ReviewRequest,
  ReviewStatus,
  ActivityEntry,
} from '../types';

/* ──────────────── Props ──────────────── */

interface CommentThreadPanelProps {
  threads: CommentThread[];
  currentPage: number;
  currentUserId: string;
  currentUserName: string;
  onAddThread: (
    page: number,
    position: { x: number; y: number },
    content: string,
  ) => void;
  onReply: (threadId: string, content: string) => void;
  onEditComment: (threadId: string, commentId: string, content: string) => void;
  onDeleteComment: (threadId: string, commentId: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  reviewRequest?: ReviewRequest | null;
  onSubmitReview?: (
    decision: 'approved' | 'rejected' | 'changes-requested',
    comment: string,
  ) => void;
  activities: ActivityEntry[];
}

/* ──────────────── Single Comment ──────────────── */

function CommentBubble({
  comment,
  isOwn,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  isOwn: boolean;
  onEdit: (content: string) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      onEdit(editContent);
      setIsEditing(false);
    }
  };

  return (
    <div className="group flex gap-2 px-2 py-1.5">
      {/* Avatar */}
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--im-primary)]/20 text-[9px] font-bold text-[var(--im-primary)]">
        {comment.authorName.slice(0, 2).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Author + time */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[var(--dash-text)]">
            {comment.authorName}
          </span>
          <span className="text-[10px] text-[var(--dash-text-muted)]">
            {comment.createdAt.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {comment.isEdited && (
            <span className="text-[9px] italic text-[var(--dash-text-muted)]">
              (edited)
            </span>
          )}
        </div>

        {/* Content or edit field */}
        {isEditing ? (
          <div className="mt-1 flex gap-1">
            <input
              className="flex-1 rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 py-0.5 text-[11px] text-[var(--dash-text)]"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            />
            <button
              onClick={handleSaveEdit}
              className="rounded bg-[var(--im-primary)] px-1.5 text-[var(--im-primary-fg)]"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <p className="mt-0.5 text-[11px] text-[var(--dash-text)] leading-relaxed break-words">
            {comment.content}
          </p>
        )}

        {/* Actions (own comments only) */}
        {isOwn && !isEditing && (
          <div className="mt-0.5 flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => setIsEditing(true)}
              className="text-[10px] text-[var(--dash-text-muted)] hover:text-[var(--im-primary)]"
            >
              <Edit3 className="h-2.5 w-2.5 inline mr-0.5" />
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-[10px] text-[var(--dash-text-muted)] hover:text-red-500"
            >
              <Trash2 className="h-2.5 w-2.5 inline mr-0.5" />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────── Thread Card ──────────────── */

function ThreadCard({
  thread,
  currentUserId,
  onReply,
  onEditComment,
  onDeleteComment,
  onResolve,
  onReopen,
}: {
  thread: CommentThread;
  currentUserId: string;
  onReply: (content: string) => void;
  onEditComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onResolve: () => void;
  onReopen: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [replyText, setReplyText] = useState('');

  const handleReply = () => {
    if (replyText.trim()) {
      onReply(replyText);
      setReplyText('');
    }
  };

  const isResolved = thread.status === 'resolved';

  return (
    <div
      className={`rounded-lg border ${isResolved ? 'border-green-500/20 bg-green-500/5' : 'border-[var(--dash-border)]'} overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 hover:bg-[var(--dash-surface-hover)]"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-[var(--dash-text-muted)]" />
        ) : (
          <ChevronRight className="h-3 w-3 text-[var(--dash-text-muted)]" />
        )}
        <span className="text-[10px] text-[var(--dash-text-muted)]">
          {thread.comments.length} comment
          {thread.comments.length !== 1 ? 's' : ''}
          {isResolved && ' · Resolved'}
        </span>
        <span className="ml-auto text-[10px] text-[var(--dash-text-muted)]">
          p.{thread.page}
        </span>
      </button>

      {expanded && (
        <>
          {/* Comments */}
          <div className="divide-y divide-[var(--dash-border)]/50">
            {thread.comments.map((c) => (
              <CommentBubble
                key={c.id}
                comment={c}
                isOwn={c.authorId === currentUserId}
                onEdit={(content) => onEditComment(c.id, content)}
                onDelete={() => onDeleteComment(c.id)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 border-t border-[var(--dash-border)]/50 px-2 py-1">
            {!isResolved ? (
              <>
                <input
                  className="flex-1 rounded border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 py-0.5 text-[11px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)]"
                  placeholder="Reply…"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  className="rounded p-1 text-[var(--im-primary)] hover:bg-[var(--im-primary)]/10 disabled:opacity-30"
                >
                  <Send className="h-3 w-3" />
                </button>
                <button
                  onClick={onResolve}
                  className="rounded p-1 text-green-500 hover:bg-green-500/10"
                  title="Resolve thread"
                >
                  <CheckCircle2 className="h-3 w-3" />
                </button>
              </>
            ) : (
              <button
                onClick={onReopen}
                className="flex items-center gap-1 text-[10px] text-[var(--dash-text-muted)] hover:text-[var(--im-primary)]"
              >
                <RotateCcw className="h-3 w-3" />
                Reopen
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────── Main Panel ──────────────── */

export default function CommentThreadPanel({
  threads,
  currentPage,
  currentUserId,
  currentUserName,
  onAddThread,
  onReply,
  onEditComment,
  onDeleteComment,
  onResolve,
  onReopen,
  reviewRequest,
  onSubmitReview,
  activities,
}: CommentThreadPanelProps) {
  const [activeTab, setActiveTab] = useState<
    'comments' | 'review' | 'activity'
  >('comments');
  const [filterResolved, setFilterResolved] = useState(false);
  const [reviewComment, setReviewComment] = useState('');

  const pageThreads = threads.filter((t) => t.page === currentPage);
  const filteredThreads = filterResolved
    ? pageThreads
    : pageThreads.filter((t) => t.status === 'open');
  const allOpen = threads.filter((t) => t.status === 'open').length;

  const tabs = [
    { id: 'comments' as const, label: 'Comments', count: allOpen },
    { id: 'review' as const, label: 'Review' },
    { id: 'activity' as const, label: 'Activity' },
  ];

  return (
    <div
      className="flex h-full flex-col text-xs"
      data-testid="comment-thread-panel"
    >
      {/* Tab bar */}
      <div className="flex border-b border-[var(--dash-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-center text-[11px] font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-[var(--im-primary)] text-[var(--im-primary)]'
                : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]'
            }`}
          >
            {tab.label}
            {'count' in tab && tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 rounded-full bg-[var(--im-primary)]/20 px-1.5 text-[9px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Comments tab */}
      {activeTab === 'comments' && (
        <div className="flex-1 overflow-y-auto">
          {/* Filter + add */}
          <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-3 py-1.5">
            <button
              onClick={() => setFilterResolved(!filterResolved)}
              className={`flex items-center gap-1 text-[10px] ${filterResolved ? 'text-[var(--im-primary)]' : 'text-[var(--dash-text-muted)]'}`}
            >
              <Filter className="h-3 w-3" />
              {filterResolved ? 'Show all' : 'Show resolved'}
            </button>
            <span className="text-[10px] text-[var(--dash-text-muted)]">
              Page {currentPage} · {filteredThreads.length} thread
              {filteredThreads.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2 p-2">
            {filteredThreads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                currentUserId={currentUserId}
                onReply={(content) => onReply(thread.id, content)}
                onEditComment={(commentId, content) =>
                  onEditComment(thread.id, commentId, content)
                }
                onDeleteComment={(commentId) =>
                  onDeleteComment(thread.id, commentId)
                }
                onResolve={() => onResolve(thread.id)}
                onReopen={() => onReopen(thread.id)}
              />
            ))}

            {filteredThreads.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-[var(--dash-text-muted)]">
                <MessageSquare className="h-8 w-8 opacity-30" />
                <p className="text-center">No comments on this page.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review tab */}
      {activeTab === 'review' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {reviewRequest ? (
            <>
              <div className="rounded-lg border border-[var(--dash-border)] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[var(--dash-text)]">
                    Review Request
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                      reviewRequest.status === 'approved'
                        ? 'bg-green-500/20 text-green-600'
                        : reviewRequest.status === 'rejected'
                          ? 'bg-red-500/20 text-red-600'
                          : reviewRequest.status === 'changes-requested'
                            ? 'bg-yellow-500/20 text-yellow-600'
                            : 'bg-blue-500/20 text-blue-600'
                    }`}
                  >
                    {reviewRequest.status.replace('-', ' ')}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--dash-text-muted)]">
                  From <strong>{reviewRequest.requesterName}</strong>
                  {reviewRequest.message && `: "${reviewRequest.message}"`}
                </p>

                {/* Reviewers list */}
                <div className="space-y-1">
                  {reviewRequest.reviewers.map((r) => (
                    <div
                      key={r.userId}
                      className="flex items-center justify-between text-[10px]"
                    >
                      <span className="text-[var(--dash-text)]">
                        {r.displayName}
                      </span>
                      {r.decision ? (
                        <span
                          className={
                            r.decision === 'approved'
                              ? 'text-green-500'
                              : r.decision === 'rejected'
                                ? 'text-red-500'
                                : 'text-yellow-500'
                          }
                        >
                          {r.decision === 'approved'
                            ? '✅ Approved'
                            : r.decision === 'rejected'
                              ? '❌ Rejected'
                              : '⚠️ Changes requested'}
                        </span>
                      ) : (
                        <span className="text-[var(--dash-text-muted)]">
                          Pending
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit decision */}
              {onSubmitReview &&
                reviewRequest.reviewers.some(
                  (r) => r.userId === currentUserId && !r.decision,
                ) && (
                  <div className="space-y-2">
                    <textarea
                      className="w-full rounded-md border border-[var(--dash-border)] bg-[var(--dash-surface)] px-2 py-1.5 text-[11px] text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)] resize-none"
                      rows={2}
                      placeholder="Add a comment (optional)…"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          onSubmitReview('approved', reviewComment);
                          setReviewComment('');
                        }}
                        className="flex-1 rounded bg-green-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-600"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          onSubmitReview('changes-requested', reviewComment);
                          setReviewComment('');
                        }}
                        className="flex-1 rounded bg-yellow-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-yellow-600"
                      >
                        Request Changes
                      </button>
                      <button
                        onClick={() => {
                          onSubmitReview('rejected', reviewComment);
                          setReviewComment('');
                        }}
                        className="flex-1 rounded bg-red-500 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-600"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-[var(--dash-text-muted)]">
              <Star className="h-8 w-8 opacity-30" />
              <p className="text-center">No review requested yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Activity tab */}
      {activeTab === 'activity' && (
        <div className="flex-1 overflow-y-auto">
          {activities.length > 0 ? (
            <div className="divide-y divide-[var(--dash-border)]/50">
              {activities.slice(0, 50).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 px-3 py-2"
                >
                  <Clock className="h-3 w-3 mt-0.5 shrink-0 text-[var(--dash-text-muted)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[var(--dash-text)]">
                      <strong>{entry.userName}</strong> {entry.description}
                    </p>
                    <p className="text-[10px] text-[var(--dash-text-muted)]">
                      {entry.timestamp.toLocaleString()}
                      {entry.page && ` · Page ${entry.page}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-[var(--dash-text-muted)]">
              <Clock className="h-8 w-8 opacity-30" />
              <p className="text-center">No activity yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
