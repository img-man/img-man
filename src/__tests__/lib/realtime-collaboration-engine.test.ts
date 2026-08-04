// SPDX-License-Identifier: Apache-2.0
/**
 * Realtime Collaboration Engine — Tests
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COLLABORATOR_COLORS,
  buildPresenceIndicatorSummary,
  canCollaboratorEdit,
  createRealtimeSession,
  getActiveCollaborators,
  getCollaborator,
  getPresencePageBreakdown,
  getSelectionAwareness,
  joinRealtimeSession,
  leaveRealtimeSession,
  markIdleCollaborators,
  sanitizeSelectionIds,
  setSessionConnectionStatus,
  updateCollaboratorPresence,
} from '@/lib/realtime-collaboration-engine';

const NOW = new Date('2026-03-06T12:00:00Z');

function baseSession() {
  return createRealtimeSession({
    designId: 'design_1',
    orgId: 'org_1',
    hostId: 'user_owner',
  }, NOW);
}

describe('realtime-collaboration-engine session lifecycle', () => {
  it('creates a session', () => {
    const session = baseSession();
    expect(session.designId).toBe('design_1');
    expect(session.connectionStatus).toBe('connecting');
    expect(session.collaborators).toHaveLength(0);
  });

  it('joins a collaborator with assigned color', () => {
    const session = joinRealtimeSession(baseSession(), {
      id: 'collab_1',
      userId: 'user_1',
      displayName: 'Alice Jones',
      role: 'editor',
    }, NOW);
    expect(session.collaborators).toHaveLength(1);
    expect(session.collaborators[0].color).toBe(DEFAULT_COLLABORATOR_COLORS[0]);
    expect(session.collaborators[0].status).toBe('online');
  });

  it('rejoins existing collaborator instead of duplicating', () => {
    const joined = joinRealtimeSession(baseSession(), {
      id: 'collab_1',
      userId: 'user_1',
      displayName: 'Alice Jones',
      role: 'editor',
    }, NOW);
    const rejoined = joinRealtimeSession(joined, {
      id: 'collab_1',
      userId: 'user_1',
      displayName: 'Alice Updated',
      role: 'owner',
    }, NOW);
    expect(rejoined.collaborators).toHaveLength(1);
    expect(rejoined.collaborators[0].displayName).toBe('Alice Updated');
    expect(rejoined.collaborators[0].role).toBe('owner');
  });

  it('marks collaborator offline on leave', () => {
    const joined = joinRealtimeSession(baseSession(), {
      id: 'collab_1',
      userId: 'user_1',
      displayName: 'Alice',
      role: 'editor',
    }, NOW);
    const left = leaveRealtimeSession(joined, 'collab_1', NOW);
    expect(left.collaborators[0].status).toBe('offline');
    expect(left.collaborators[0].presence.selectionIds).toHaveLength(0);
  });

  it('updates session connection status', () => {
    const next = setSessionConnectionStatus(baseSession(), 'connected', NOW);
    expect(next.connectionStatus).toBe('connected');
  });

  it('enforces max collaborators by moving to error state', () => {
    const session = createRealtimeSession({
      designId: 'design_1',
      orgId: 'org_1',
      hostId: 'user_owner',
      maxCollaborators: 1,
    }, NOW);
    const one = joinRealtimeSession(session, {
      id: 'collab_1',
      userId: 'user_1',
      displayName: 'Alice',
      role: 'editor',
    }, NOW);
    const two = joinRealtimeSession(one, {
      id: 'collab_2',
      userId: 'user_2',
      displayName: 'Bob',
      role: 'viewer',
    }, NOW);
    expect(two.collaborators).toHaveLength(1);
    expect(two.connectionStatus).toBe('error');
  });
});

describe('realtime-collaboration-engine presence', () => {
  function populatedSession() {
    const session = joinRealtimeSession(baseSession(), {
      id: 'collab_1',
      userId: 'user_1',
      displayName: 'Alice Jones',
      role: 'editor',
      pageId: 'page_1',
    }, NOW);
    return joinRealtimeSession(session, {
      id: 'collab_2',
      userId: 'user_2',
      displayName: 'Bob Stone',
      role: 'viewer',
      pageId: 'page_2',
    }, NOW);
  }

  it('gets collaborator by id', () => {
    const session = populatedSession();
    expect(getCollaborator(session, 'collab_1')?.displayName).toBe('Alice Jones');
    expect(getCollaborator(session, 'missing')).toBeNull();
  });

  it('updates cursor, selection, and page', () => {
    const updated = updateCollaboratorPresence(populatedSession(), 'collab_1', {
      cursor: { x: 120, y: 60 },
      selectionIds: ['el_1', 'el_2'],
      pageId: 'page_3',
    }, NOW);
    const collaborator = getCollaborator(updated, 'collab_1');
    expect(collaborator?.presence.cursor).toEqual({ x: 120, y: 60 });
    expect(collaborator?.presence.selectionIds).toEqual(['el_1', 'el_2']);
    expect(collaborator?.presence.pageId).toBe('page_3');
  });

  it('marks stale collaborators idle', () => {
    const old = new Date('2026-03-06T11:00:00Z');
    const session = updateCollaboratorPresence(populatedSession(), 'collab_1', {
      cursor: { x: 1, y: 1 },
    }, old);
    const idle = markIdleCollaborators(session, 30 * 60 * 1000, NOW);
    expect(getCollaborator(idle, 'collab_1')?.status).toBe('idle');
    expect(getCollaborator(idle, 'collab_2')?.status).toBe('online');
  });

  it('returns active collaborators sorted by role then activity', () => {
    const session = populatedSession();
    const active = getActiveCollaborators(session);
    expect(active).toHaveLength(2);
    expect(active[0].role).toBe('editor');
  });

  it('builds selection awareness for a page', () => {
    let session = populatedSession();
    session = updateCollaboratorPresence(session, 'collab_1', {
      selectionIds: ['el_1'],
      pageId: 'page_1',
    }, NOW);
    session = updateCollaboratorPresence(session, 'collab_2', {
      selectionIds: ['el_9'],
      pageId: 'page_2',
    }, NOW);
    const awareness = getSelectionAwareness(session, 'page_1');
    expect(awareness).toHaveLength(1);
    expect(awareness[0].collaboratorId).toBe('collab_1');
  });

  it('builds presence indicator summary', () => {
    let session = populatedSession();
    session = leaveRealtimeSession(session, 'collab_2', NOW);
    const summary = buildPresenceIndicatorSummary(session);
    expect(summary.totalCollaborators).toBe(2);
    expect(summary.onlineCount).toBe(1);
    expect(summary.offlineCount).toBe(1);
    expect(summary.label).toBe('1 person editing');
  });

  it('builds page breakdown', () => {
    const session = populatedSession();
    const breakdown = getPresencePageBreakdown(session);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].count).toBe(1);
  });
});

describe('realtime-collaboration-engine helpers', () => {
  it('determines editable roles', () => {
    expect(canCollaboratorEdit('owner')).toBe(true);
    expect(canCollaboratorEdit('editor')).toBe(true);
    expect(canCollaboratorEdit('commenter')).toBe(false);
  });

  it('sanitizes duplicate selection ids', () => {
    expect(sanitizeSelectionIds(['el_1', '', 'el_1', 'el_2'])).toEqual(['el_1', 'el_2']);
  });
});
