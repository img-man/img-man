// SPDX-License-Identifier: Apache-2.0
/**
 * Collaboration Engine — Phase 6 Tests
 *
 * Tests session management, collaborator CRUD, presence tracking,
 * object locking, and event queue.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  resetCollabIdCounters,
  createCollabSession,
  addCollaborator,
  removeCollaborator,
  updateConnectionStatus,
  generateInviteLink,
  getCollaborator,
  getHost,
  hasRole,
  canEdit,
  canComment,
  updatePresence,
  markIdleCollaborators,
  getCollaboratorsOnPage,
  countActiveCollaborators,
  acquireLock,
  releaseLock,
  releaseAllLocks,
  isLockedByOther,
  getLockInfo,
  cleanExpiredLocks,
  getLocksOnPage,
  createCollabEvent,
  getCollabEventLabel,
} from '../../app/dashboard/tools/pdf-editor/engine/collab-engine';
import type {
  CollaborationSession,
  PresenceInfo,
} from '../../app/dashboard/tools/pdf-editor/types';
import {
  IDLE_TIMEOUT_MS,
  LOCK_TIMEOUT_MS,
  MAX_COLLABORATORS,
  COLLABORATOR_COLORS,
} from '../../app/dashboard/tools/pdf-editor/constants';

describe('Collaboration Engine (Phase 6)', () => {
  beforeEach(() => {
    resetCollabIdCounters();
  });

  /* ═══════ Session management ═══════ */
  describe('createCollabSession', () => {
    it('creates a session with host as first collaborator', () => {
      const session = createCollabSession('doc-1', {
        userId: 'user-1',
        displayName: 'Alice',
      });
      expect(session.documentId).toBe('doc-1');
      expect(session.collaborators).toHaveLength(1);
      expect(session.collaborators[0].role).toBe('owner');
      expect(session.collaborators[0].displayName).toBe('Alice');
      expect(session.connectionStatus).toBe('connected');
      expect(session.hostId).toBe(session.collaborators[0].id);
      expect(session.locks).toEqual([]);
    });

    it('assigns a color from the palette', () => {
      const session = createCollabSession('doc-1', {
        userId: 'user-1',
        displayName: 'Alice',
      });
      expect(COLLABORATOR_COLORS).toContain(session.collaborators[0].color);
    });

    it('includes session ID', () => {
      const session = createCollabSession('doc-1', {
        userId: 'user-1',
        displayName: 'Alice',
      });
      expect(session.sessionId).toMatch(/^session-/);
    });
  });

  describe('addCollaborator', () => {
    let session: CollaborationSession;

    beforeEach(() => {
      session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
    });

    it('adds a new collaborator', () => {
      const result = addCollaborator(session, {
        userId: 'user-2',
        displayName: 'Bob',
      });
      expect(result.success).toBe(true);
      expect(result.session.collaborators).toHaveLength(2);
      expect(result.session.collaborators[1].displayName).toBe('Bob');
      expect(result.session.collaborators[1].role).toBe('editor'); // default
    });

    it('respects custom role', () => {
      const result = addCollaborator(
        session,
        { userId: 'user-2', displayName: 'Bob' },
        'commenter',
      );
      expect(result.session.collaborators[1].role).toBe('commenter');
    });

    it('rejects duplicate users', () => {
      const result = addCollaborator(session, {
        userId: 'host',
        displayName: 'Host Again',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('already');
    });

    it('enforces MAX_COLLABORATORS limit', () => {
      let current = session;
      for (let i = 1; i < MAX_COLLABORATORS; i++) {
        const r = addCollaborator(current, {
          userId: `user-${i}`,
          displayName: `User ${i}`,
        });
        current = r.session;
      }
      const over = addCollaborator(current, {
        userId: 'one-too-many',
        displayName: 'Extra',
      });
      expect(over.success).toBe(false);
      expect(over.error).toContain('Maximum');
    });
  });

  describe('removeCollaborator', () => {
    it('removes a collaborator and their locks', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const { session: s2 } = addCollaborator(session, {
        userId: 'user-2',
        displayName: 'Bob',
      });
      const bob = s2.collaborators[1];
      const { session: s3 } = acquireLock(s2, 'obj-1', bob.id, 1);
      const result = removeCollaborator(s3, bob.id);
      expect(result.collaborators).toHaveLength(1);
      expect(result.locks).toHaveLength(0);
    });
  });

  describe('updateConnectionStatus', () => {
    it('updates the connection status', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const updated = updateConnectionStatus(session, 'reconnecting');
      expect(updated.connectionStatus).toBe('reconnecting');
    });
  });

  describe('generateInviteLink', () => {
    it('generates an invite link', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const updated = generateInviteLink(session, 'https://example.com');
      expect(updated.inviteLink).toContain('https://example.com');
      expect(updated.inviteLink).toContain(session.sessionId);
      expect(updated.inviteLink).toContain('doc-1');
    });
  });

  describe('getCollaborator / getHost', () => {
    it('finds a collaborator by ID', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const c = getCollaborator(session, session.collaborators[0].id);
      expect(c?.displayName).toBe('Host');
    });

    it('returns null for unknown ID', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      expect(getCollaborator(session, 'nonexistent')).toBeNull();
    });

    it('returns the host', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const host = getHost(session);
      expect(host?.role).toBe('owner');
    });
  });

  describe('hasRole / canEdit / canComment', () => {
    let session: CollaborationSession;
    let hostId: string;
    let editorId: string;
    let commenterId: string;
    let viewerId: string;

    beforeEach(() => {
      session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      hostId = session.collaborators[0].id;
      let s = addCollaborator(
        session,
        { userId: 'editor', displayName: 'Editor' },
        'editor',
      ).session;
      editorId = s.collaborators[1].id;
      s = addCollaborator(
        s,
        { userId: 'commenter', displayName: 'Commenter' },
        'commenter',
      ).session;
      commenterId = s.collaborators[2].id;
      s = addCollaborator(
        s,
        { userId: 'viewer', displayName: 'Viewer' },
        'viewer',
      ).session;
      viewerId = s.collaborators[3].id;
      session = s;
    });

    it('hasRole checks correctly', () => {
      expect(hasRole(session, hostId, 'owner')).toBe(true);
      expect(hasRole(session, hostId, 'editor')).toBe(false);
    });

    it('canEdit allows owner and editor', () => {
      expect(canEdit(session, hostId)).toBe(true);
      expect(canEdit(session, editorId)).toBe(true);
      expect(canEdit(session, commenterId)).toBe(false);
      expect(canEdit(session, viewerId)).toBe(false);
    });

    it('canComment allows all except viewer', () => {
      expect(canComment(session, hostId)).toBe(true);
      expect(canComment(session, editorId)).toBe(true);
      expect(canComment(session, commenterId)).toBe(true);
      expect(canComment(session, viewerId)).toBe(false);
    });

    it('returns false for nonexistent collaborator', () => {
      expect(canEdit(session, 'ghost')).toBe(false);
      expect(canComment(session, 'ghost')).toBe(false);
    });
  });

  /* ═══════ Presence ═══════ */
  describe('updatePresence', () => {
    it('updates page and cursor', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      const presence: PresenceInfo = {
        collaboratorId: collabId,
        page: 5,
        cursor: { x: 100, y: 200 },
      };
      const updated = updatePresence(session, presence);
      const c = updated.collaborators[0];
      expect(c.currentPage).toBe(5);
      expect(c.cursorPosition).toEqual({ x: 100, y: 200 });
      expect(c.status).toBe('online');
    });
  });

  describe('markIdleCollaborators', () => {
    it('marks idle collaborators after timeout', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      // Set lastActiveAt to long ago
      const modified: CollaborationSession = {
        ...session,
        collaborators: session.collaborators.map((c) => ({
          ...c,
          lastActiveAt: new Date(Date.now() - IDLE_TIMEOUT_MS - 1000),
        })),
      };
      const updated = markIdleCollaborators(modified);
      expect(updated.collaborators[0].status).toBe('idle');
    });

    it('leaves recently active collaborators as online', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const updated = markIdleCollaborators(session);
      expect(updated.collaborators[0].status).toBe('online');
    });
  });

  describe('getCollaboratorsOnPage / countActiveCollaborators', () => {
    it('filters by page', () => {
      let session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      session = addCollaborator(session, {
        userId: 'user-2',
        displayName: 'Bob',
      }).session;
      session = updatePresence(session, {
        collaboratorId: session.collaborators[0].id,
        page: 3,
      });
      session = updatePresence(session, {
        collaboratorId: session.collaborators[1].id,
        page: 5,
      });
      expect(getCollaboratorsOnPage(session, 3)).toHaveLength(1);
      expect(getCollaboratorsOnPage(session, 5)).toHaveLength(1);
      expect(getCollaboratorsOnPage(session, 1)).toHaveLength(0);
    });

    it('counts active collaborators', () => {
      let session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      session = addCollaborator(session, {
        userId: 'user-2',
        displayName: 'Bob',
      }).session;
      expect(countActiveCollaborators(session)).toBe(2);
    });
  });

  /* ═══════ Object Locking ═══════ */
  describe('acquireLock', () => {
    it('acquires a lock on a free object', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      const { session: s2, success } = acquireLock(
        session,
        'obj-1',
        collabId,
        1,
      );
      expect(success).toBe(true);
      expect(s2.locks).toHaveLength(1);
      expect(s2.locks[0].objectId).toBe('obj-1');
    });

    it('refreshes an existing own lock', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      const { session: s2 } = acquireLock(session, 'obj-1', collabId, 1);
      const { session: s3, success } = acquireLock(s2, 'obj-1', collabId, 1);
      expect(success).toBe(true);
      expect(s3.locks).toHaveLength(1); // Still one lock, just refreshed
    });

    it('fails if locked by another collaborator', () => {
      let session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      session = addCollaborator(session, {
        userId: 'user-2',
        displayName: 'Bob',
      }).session;
      const hostId = session.collaborators[0].id;
      const bobId = session.collaborators[1].id;
      const { session: s2 } = acquireLock(session, 'obj-1', hostId, 1);
      const { success, lockedBy } = acquireLock(s2, 'obj-1', bobId, 1);
      expect(success).toBe(false);
      expect(lockedBy).toBe(hostId);
    });
  });

  describe('releaseLock / releaseAllLocks', () => {
    it('releases a specific lock', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      const { session: s2 } = acquireLock(session, 'obj-1', collabId, 1);
      const s3 = releaseLock(s2, 'obj-1', collabId);
      expect(s3.locks).toHaveLength(0);
    });

    it('releases all locks for a collaborator', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      let s = acquireLock(session, 'obj-1', collabId, 1).session;
      s = acquireLock(s, 'obj-2', collabId, 2).session;
      const result = releaseAllLocks(s, collabId);
      expect(result.locks).toHaveLength(0);
    });
  });

  describe('isLockedByOther / getLockInfo', () => {
    it('detects lock by other', () => {
      let session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      session = addCollaborator(session, {
        userId: 'user-2',
        displayName: 'Bob',
      }).session;
      const hostId = session.collaborators[0].id;
      const bobId = session.collaborators[1].id;
      session = acquireLock(session, 'obj-1', hostId, 1).session;
      expect(isLockedByOther(session, 'obj-1', bobId)).toBe(true);
      expect(isLockedByOther(session, 'obj-1', hostId)).toBe(false);
    });

    it('returns lock info', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      const { session: s2 } = acquireLock(session, 'obj-1', collabId, 1);
      const info = getLockInfo(s2, 'obj-1');
      expect(info?.lockedBy).toBe(collabId);
      expect(info?.page).toBe(1);
    });

    it('returns null for unlocked object', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      expect(getLockInfo(session, 'obj-1')).toBeNull();
    });
  });

  describe('cleanExpiredLocks / getLocksOnPage', () => {
    it('removes expired locks', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      const { session: s2 } = acquireLock(session, 'obj-1', collabId, 1);
      const futureDate = new Date(Date.now() + LOCK_TIMEOUT_MS + 1000);
      const cleaned = cleanExpiredLocks(s2, futureDate);
      expect(cleaned.locks).toHaveLength(0);
    });

    it('keeps non-expired locks', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      const { session: s2 } = acquireLock(session, 'obj-1', collabId, 1);
      const cleaned = cleanExpiredLocks(s2);
      expect(cleaned.locks).toHaveLength(1);
    });

    it('filters locks by page', () => {
      const session = createCollabSession('doc-1', {
        userId: 'host',
        displayName: 'Host',
      });
      const collabId = session.collaborators[0].id;
      let s = acquireLock(session, 'obj-1', collabId, 1).session;
      s = acquireLock(s, 'obj-2', collabId, 2).session;
      expect(getLocksOnPage(s, 1)).toHaveLength(1);
      expect(getLocksOnPage(s, 2)).toHaveLength(1);
      expect(getLocksOnPage(s, 3)).toHaveLength(0);
    });
  });

  /* ═══════ Events ═══════ */
  describe('createCollabEvent / getCollabEventLabel', () => {
    it('creates an event with correct fields', () => {
      const evt = createCollabEvent('join', 'collab-1', { reason: 'invite' });
      expect(evt.type).toBe('join');
      expect(evt.collaboratorId).toBe('collab-1');
      expect(evt.payload).toEqual({ reason: 'invite' });
      expect(evt.timestamp).toBeInstanceOf(Date);
    });

    it('returns labels for all event types', () => {
      expect(getCollabEventLabel('join')).toBe('Joined session');
      expect(getCollabEventLabel('leave')).toBe('Left session');
      expect(getCollabEventLabel('cursor-move')).toBe('Moved cursor');
      expect(getCollabEventLabel('annotation-add')).toBe('Added annotation');
      expect(getCollabEventLabel('lock-acquire')).toBe('Locked object');
      expect(getCollabEventLabel('lock-release')).toBe('Unlocked object');
      expect(getCollabEventLabel('presence-update')).toBe('Updated presence');
    });
  });
});
