// SPDX-License-Identifier: Apache-2.0
/**
 * Collaboration Engine — Phase 6, Week 21
 *
 * Provides:
 * - Collaboration session management (create, join, leave)
 * - Collaborator presence tracking (status, cursors, page)
 * - Object locking (acquire, release, timeout check)
 * - Change attribution (color-coded by user)
 * - Invite link generation
 * - Event queue for WebSocket sync
 *
 * Note: Actual WebSocket transport is handled by the hook layer.
 * This engine manages the pure state transformations.
 */

import type {
  Collaborator,
  CollaboratorRole,
  CollaboratorStatus,
  CollaborationSession,
  ConnectionStatus,
  ObjectLock,
  CollabEvent,
  CollabEventType,
  PresenceInfo,
} from '../types';
import {
  COLLABORATOR_COLORS,
  MAX_COLLABORATORS,
  IDLE_TIMEOUT_MS,
  LOCK_TIMEOUT_MS,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   ID counters (resettable for testing)
   ══════════════════════════════════════════════════════════════════════════ */

let nextCollabId = 1;
let nextEventId = 1;

export function resetCollabIdCounters(): void {
  nextCollabId = 1;
  nextEventId = 1;
}

/* ══════════════════════════════════════════════════════════════════════════
   Session management
   ══════════════════════════════════════════════════════════════════════════ */

/** Create a fresh collaboration session with the host as first collaborator. */
export function createCollabSession(
  documentId: string,
  host: { userId: string; displayName: string; avatarUrl?: string },
): CollaborationSession {
  const hostCollaborator = createCollaborator(
    host.userId,
    host.displayName,
    'owner',
    host.avatarUrl,
  );

  return {
    sessionId: `session-${nextCollabId++}`,
    documentId,
    collaborators: [hostCollaborator],
    locks: [],
    connectionStatus: 'connected',
    inviteLink: undefined,
    createdAt: new Date(),
    hostId: hostCollaborator.id,
  };
}

/** Add a collaborator to the session. */
export function addCollaborator(
  session: CollaborationSession,
  user: { userId: string; displayName: string; avatarUrl?: string },
  role: CollaboratorRole = 'editor',
): { session: CollaborationSession; success: boolean; error?: string } {
  if (session.collaborators.length >= MAX_COLLABORATORS) {
    return {
      session,
      success: false,
      error: `Maximum of ${MAX_COLLABORATORS} collaborators reached`,
    };
  }

  if (session.collaborators.some((c) => c.userId === user.userId)) {
    return { session, success: false, error: 'User is already in the session' };
  }

  const collaborator = createCollaborator(
    user.userId,
    user.displayName,
    role,
    user.avatarUrl,
  );

  return {
    session: {
      ...session,
      collaborators: [...session.collaborators, collaborator],
    },
    success: true,
  };
}

/** Remove a collaborator from the session and release their locks. */
export function removeCollaborator(
  session: CollaborationSession,
  collaboratorId: string,
): CollaborationSession {
  return {
    ...session,
    collaborators: session.collaborators.filter((c) => c.id !== collaboratorId),
    locks: session.locks.filter((l) => l.lockedBy !== collaboratorId),
  };
}

/** Update the session's connection status. */
export function updateConnectionStatus(
  session: CollaborationSession,
  status: ConnectionStatus,
): CollaborationSession {
  return { ...session, connectionStatus: status };
}

/** Generate an invite link for the session. */
export function generateInviteLink(
  session: CollaborationSession,
  baseUrl: string,
): CollaborationSession {
  const link = `${baseUrl}/collab/${session.sessionId}?doc=${session.documentId}`;
  return { ...session, inviteLink: link };
}

/** Get a collaborator by ID. */
export function getCollaborator(
  session: CollaborationSession,
  collaboratorId: string,
): Collaborator | null {
  return session.collaborators.find((c) => c.id === collaboratorId) ?? null;
}

/** Get the host collaborator. */
export function getHost(session: CollaborationSession): Collaborator | null {
  return session.collaborators.find((c) => c.id === session.hostId) ?? null;
}

/** Check if a user has a given role. */
export function hasRole(
  session: CollaborationSession,
  collaboratorId: string,
  role: CollaboratorRole,
): boolean {
  const collab = getCollaborator(session, collaboratorId);
  return collab?.role === role;
}

/** Check if a collaborator can edit (owner or editor roles). */
export function canEdit(
  session: CollaborationSession,
  collaboratorId: string,
): boolean {
  const collab = getCollaborator(session, collaboratorId);
  if (!collab) return false;
  return collab.role === 'owner' || collab.role === 'editor';
}

/** Check if a collaborator can comment (owner, editor, or commenter). */
export function canComment(
  session: CollaborationSession,
  collaboratorId: string,
): boolean {
  const collab = getCollaborator(session, collaboratorId);
  if (!collab) return false;
  return collab.role !== 'viewer';
}

/* ══════════════════════════════════════════════════════════════════════════
   Presence & cursor tracking
   ══════════════════════════════════════════════════════════════════════════ */

/** Update a collaborator's presence information. */
export function updatePresence(
  session: CollaborationSession,
  presence: PresenceInfo,
): CollaborationSession {
  return {
    ...session,
    collaborators: session.collaborators.map((c) =>
      c.id === presence.collaboratorId
        ? {
            ...c,
            currentPage: presence.page,
            cursorPosition: presence.cursor,
            status: 'online' as CollaboratorStatus,
            lastActiveAt: new Date(),
          }
        : c,
    ),
  };
}

/** Mark idle collaborators based on IDLE_TIMEOUT. */
export function markIdleCollaborators(
  session: CollaborationSession,
  now: Date = new Date(),
): CollaborationSession {
  return {
    ...session,
    collaborators: session.collaborators.map((c) => {
      if (c.status === 'offline') return c;
      const elapsed = now.getTime() - c.lastActiveAt.getTime();
      if (elapsed > IDLE_TIMEOUT_MS && c.status !== 'idle') {
        return { ...c, status: 'idle' as CollaboratorStatus };
      }
      return c;
    }),
  };
}

/** Get collaborators on a specific page. */
export function getCollaboratorsOnPage(
  session: CollaborationSession,
  page: number,
): Collaborator[] {
  return session.collaborators.filter(
    (c) => c.currentPage === page && c.status !== 'offline',
  );
}

/** Count active (online + idle) collaborators. */
export function countActiveCollaborators(
  session: CollaborationSession,
): number {
  return session.collaborators.filter((c) => c.status !== 'offline').length;
}

/* ══════════════════════════════════════════════════════════════════════════
   Object locking
   ══════════════════════════════════════════════════════════════════════════ */

/** Try to acquire a lock on an object. */
export function acquireLock(
  session: CollaborationSession,
  objectId: string,
  collaboratorId: string,
  page: number,
): { session: CollaborationSession; success: boolean; lockedBy?: string } {
  const existing = session.locks.find((l) => l.objectId === objectId);
  if (existing && existing.lockedBy !== collaboratorId) {
    return { session, success: false, lockedBy: existing.lockedBy };
  }

  if (existing && existing.lockedBy === collaboratorId) {
    // Refresh the lock
    return {
      session: {
        ...session,
        locks: session.locks.map((l) =>
          l.objectId === objectId ? { ...l, lockedAt: new Date() } : l,
        ),
      },
      success: true,
    };
  }

  const lock: ObjectLock = {
    objectId,
    lockedBy: collaboratorId,
    lockedAt: new Date(),
    page,
  };

  return {
    session: { ...session, locks: [...session.locks, lock] },
    success: true,
  };
}

/** Release a lock on an object. */
export function releaseLock(
  session: CollaborationSession,
  objectId: string,
  collaboratorId: string,
): CollaborationSession {
  return {
    ...session,
    locks: session.locks.filter(
      (l) => !(l.objectId === objectId && l.lockedBy === collaboratorId),
    ),
  };
}

/** Release all locks held by a collaborator. */
export function releaseAllLocks(
  session: CollaborationSession,
  collaboratorId: string,
): CollaborationSession {
  return {
    ...session,
    locks: session.locks.filter((l) => l.lockedBy !== collaboratorId),
  };
}

/** Check if an object is locked by someone else. */
export function isLockedByOther(
  session: CollaborationSession,
  objectId: string,
  collaboratorId: string,
): boolean {
  const lock = session.locks.find((l) => l.objectId === objectId);
  return lock !== undefined && lock.lockedBy !== collaboratorId;
}

/** Get the lock info for an object. */
export function getLockInfo(
  session: CollaborationSession,
  objectId: string,
): ObjectLock | null {
  return session.locks.find((l) => l.objectId === objectId) ?? null;
}

/** Clean up expired locks. */
export function cleanExpiredLocks(
  session: CollaborationSession,
  now: Date = new Date(),
): CollaborationSession {
  return {
    ...session,
    locks: session.locks.filter((l) => {
      const elapsed = now.getTime() - l.lockedAt.getTime();
      return elapsed < LOCK_TIMEOUT_MS;
    }),
  };
}

/** Get all locks on a specific page. */
export function getLocksOnPage(
  session: CollaborationSession,
  page: number,
): ObjectLock[] {
  return session.locks.filter((l) => l.page === page);
}

/* ══════════════════════════════════════════════════════════════════════════
   Event queue
   ══════════════════════════════════════════════════════════════════════════ */

/** Create a collaboration event. */
export function createCollabEvent(
  type: CollabEventType,
  collaboratorId: string,
  payload: Record<string, unknown> = {},
): CollabEvent {
  return {
    type,
    collaboratorId,
    timestamp: new Date(),
    payload,
  };
}

/** Get the label for a collaboration event type. */
export function getCollabEventLabel(type: CollabEventType): string {
  const labels: Record<CollabEventType, string> = {
    join: 'Joined session',
    leave: 'Left session',
    'cursor-move': 'Moved cursor',
    'annotation-add': 'Added annotation',
    'annotation-update': 'Updated annotation',
    'annotation-delete': 'Deleted annotation',
    'page-change': 'Changed page',
    'lock-acquire': 'Locked object',
    'lock-release': 'Unlocked object',
    'presence-update': 'Updated presence',
  };
  return labels[type] ?? type;
}

/* ══════════════════════════════════════════════════════════════════════════
   Internal helpers
   ══════════════════════════════════════════════════════════════════════════ */

function createCollaborator(
  userId: string,
  displayName: string,
  role: CollaboratorRole,
  avatarUrl?: string,
): Collaborator {
  const colorIndex = (nextCollabId - 1) % COLLABORATOR_COLORS.length;
  return {
    id: `collab-${nextCollabId++}`,
    userId,
    displayName,
    avatarUrl,
    color: COLLABORATOR_COLORS[colorIndex],
    role,
    status: 'online',
    currentPage: 1,
    cursorPosition: undefined,
    lastActiveAt: new Date(),
  };
}
