// SPDX-License-Identifier: Apache-2.0
/**
 * Design Presence Engine — Tests
 */

import { describe, expect, it } from 'vitest';
import {
  buildCursorBroadcastPayload,
  buildCursorOverlays,
  buildPresenceAvatars,
  buildSelectionOverlays,
  clampCursorToViewport,
  formatPresenceLabel,
  getInitials,
  getPresenceHotspots,
  shouldBroadcastCursor,
  sortPresenceByActivity,
  toCanvasCursor,
} from '@/lib/design-presence-engine';
import {
  createRealtimeSession,
  joinRealtimeSession,
  updateCollaboratorPresence,
} from '@/lib/realtime-collaboration-engine';

const NOW = new Date('2026-03-06T12:00:00Z');

function makeSession() {
  let session = createRealtimeSession({
    designId: 'design_1',
    orgId: 'org_1',
    hostId: 'owner_1',
  }, NOW);
  session = joinRealtimeSession(session, {
    id: 'collab_1',
    userId: 'user_1',
    displayName: 'Alice Jones',
    role: 'editor',
    pageId: 'page_1',
  }, NOW);
  session = joinRealtimeSession(session, {
    id: 'collab_2',
    userId: 'user_2',
    displayName: 'Bob Stone',
    role: 'viewer',
    pageId: 'page_1',
  }, NOW);
  session = updateCollaboratorPresence(session, 'collab_1', {
    cursor: { x: 20, y: 30 },
    selectionIds: ['el_1'],
  }, NOW);
  session = updateCollaboratorPresence(session, 'collab_2', {
    cursor: { x: 24, y: 32 },
    selectionIds: ['el_2', 'el_3'],
  }, NOW);
  return session;
}

describe('design-presence-engine cursor math', () => {
  it('converts client position to canvas coordinates', () => {
    const cursor = toCanvasCursor(
      { clientX: 210, clientY: 120 },
      { left: 10, top: 20, width: 400, height: 300, zoom: 2 },
    );
    expect(cursor).toEqual({ x: 100, y: 50 });
  });

  it('accounts for pan offsets', () => {
    const cursor = toCanvasCursor(
      { clientX: 210, clientY: 120 },
      { left: 10, top: 20, width: 400, height: 300, zoom: 2, panX: 10, panY: 20 },
    );
    expect(cursor).toEqual({ x: 95, y: 40 });
  });

  it('clamps cursor inside viewport', () => {
    const cursor = clampCursorToViewport(
      { x: 500, y: -20 },
      { left: 0, top: 0, width: 200, height: 100, zoom: 1 },
    );
    expect(cursor).toEqual({ x: 200, y: 0 });
  });

  it('detects when cursor should broadcast', () => {
    expect(shouldBroadcastCursor(null, { x: 1, y: 1 })).toBe(true);
    expect(shouldBroadcastCursor({ x: 1, y: 1 }, { x: 2, y: 2 }, 5)).toBe(false);
    expect(shouldBroadcastCursor({ x: 1, y: 1 }, { x: 10, y: 10 }, 5)).toBe(true);
  });

  it('builds cursor broadcast payload', () => {
    const payload = buildCursorBroadcastPayload('collab_1', 'page_1', { x: 10, y: 20 }, NOW);
    expect(payload.collaboratorId).toBe('collab_1');
    expect(payload.pageId).toBe('page_1');
    expect(payload.cursor.x).toBe(10);
  });
});

describe('design-presence-engine overlays', () => {
  it('builds cursor overlays by page', () => {
    const overlays = buildCursorOverlays(makeSession(), 'page_1');
    expect(overlays).toHaveLength(2);
    expect(overlays[0].pageId).toBe('page_1');
  });

  it('builds selection overlays', () => {
    const overlays = buildSelectionOverlays(makeSession(), 'page_1');
    expect(overlays).toHaveLength(2);
    expect(overlays[1].elementIds).toContain('el_3');
  });

  it('creates presence avatars', () => {
    const avatars = buildPresenceAvatars(makeSession().collaborators, 1);
    expect(avatars).toHaveLength(1);
    expect(avatars[0].initials).toBe('AJ');
  });

  it('sorts by activity', () => {
    const sorted = sortPresenceByActivity(makeSession().collaborators);
    expect(sorted).toHaveLength(2);
  });

  it('groups hotspots by proximity', () => {
    const hotspots = getPresenceHotspots(buildCursorOverlays(makeSession(), 'page_1'), 10);
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].count).toBe(2);
  });
});

describe('design-presence-engine labels', () => {
  it('extracts initials', () => {
    expect(getInitials('Alice Jones')).toBe('AJ');
    expect(getInitials('single')).toBe('SI');
    expect(getInitials('')).toBe('?');
  });

  it('formats presence labels', () => {
    expect(formatPresenceLabel(0)).toBe('Nobody editing');
    expect(formatPresenceLabel(1)).toBe('1 person editing');
    expect(formatPresenceLabel(3, 1)).toBe('3 people editing · 1 idle');
  });
});
