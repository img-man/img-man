// SPDX-License-Identifier: Apache-2.0
/**
 * Design Presence Engine — Sprint 17.2/17.3/17.5
 *
 * Pure helpers for cursor broadcasting, collaborator overlays,
 * avatar stacks, and selection-awareness rendering metadata.
 */

import type {
  Collaborator,
  CursorPosition,
  RealtimeSession,
} from '@/lib/realtime-collaboration-engine';

export interface CanvasViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  zoom: number;
  panX?: number;
  panY?: number;
}

export interface ClientCursorInput {
  clientX: number;
  clientY: number;
}

export interface CursorBroadcastPayload {
  collaboratorId: string;
  pageId: string | null;
  cursor: CursorPosition;
  sentAt: Date;
}

export interface CursorOverlay {
  collaboratorId: string;
  displayName: string;
  color: string;
  x: number;
  y: number;
  pageId: string | null;
  isIdle: boolean;
}

export interface SelectionOverlay {
  collaboratorId: string;
  displayName: string;
  color: string;
  elementIds: string[];
  pageId: string | null;
}

export interface PresenceAvatar {
  id: string;
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  color: string;
  status: Collaborator['status'];
}

export function getInitials(displayName: string): string {
  const cleaned = displayName.trim().split(/\s+/).filter(Boolean);
  if (cleaned.length === 0) return '?';
  if (cleaned.length === 1) return cleaned[0].slice(0, 2).toUpperCase();
  return `${cleaned[0][0] ?? ''}${cleaned[1][0] ?? ''}`.toUpperCase();
}

export function toCanvasCursor(
  input: ClientCursorInput,
  viewport: CanvasViewport,
): CursorPosition {
  const panX = viewport.panX ?? 0;
  const panY = viewport.panY ?? 0;
  return {
    x: (input.clientX - viewport.left - panX) / viewport.zoom,
    y: (input.clientY - viewport.top - panY) / viewport.zoom,
  };
}

export function clampCursorToViewport(
  cursor: CursorPosition,
  viewport: CanvasViewport,
): CursorPosition {
  return {
    x: Math.max(0, Math.min(cursor.x, viewport.width / viewport.zoom)),
    y: Math.max(0, Math.min(cursor.y, viewport.height / viewport.zoom)),
  };
}

export function shouldBroadcastCursor(
  previous: CursorPosition | null,
  next: CursorPosition | null,
  minDeltaPx: number = 2,
): boolean {
  if (!next) return false;
  if (!previous) return true;
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  return Math.sqrt(dx * dx + dy * dy) >= minDeltaPx;
}

export function buildCursorBroadcastPayload(
  collaboratorId: string,
  pageId: string | null,
  cursor: CursorPosition,
  now: Date = new Date(),
): CursorBroadcastPayload {
  return {
    collaboratorId,
    pageId,
    cursor,
    sentAt: now,
  };
}

export function buildCursorOverlays(
  session: RealtimeSession,
  pageId?: string | null,
): CursorOverlay[] {
  return session.collaborators
    .filter((collaborator) => collaborator.status !== 'offline')
    .filter((collaborator) => collaborator.presence.cursor !== null)
    .filter((collaborator) => pageId == null || collaborator.presence.pageId === pageId)
    .map((collaborator) => ({
      collaboratorId: collaborator.id,
      displayName: collaborator.displayName,
      color: collaborator.color,
      x: collaborator.presence.cursor!.x,
      y: collaborator.presence.cursor!.y,
      pageId: collaborator.presence.pageId,
      isIdle: collaborator.status === 'idle',
    }));
}

export function buildSelectionOverlays(
  session: RealtimeSession,
  pageId?: string | null,
): SelectionOverlay[] {
  return session.collaborators
    .filter((collaborator) => collaborator.status !== 'offline')
    .filter((collaborator) => collaborator.presence.selectionIds.length > 0)
    .filter((collaborator) => pageId == null || collaborator.presence.pageId === pageId)
    .map((collaborator) => ({
      collaboratorId: collaborator.id,
      displayName: collaborator.displayName,
      color: collaborator.color,
      elementIds: [...collaborator.presence.selectionIds],
      pageId: collaborator.presence.pageId,
    }));
}

export function buildPresenceAvatars(
  collaborators: Collaborator[],
  maxItems: number = 5,
): PresenceAvatar[] {
  return collaborators
    .filter((collaborator) => collaborator.status !== 'offline')
    .sort((left, right) => right.presence.lastActiveAt.getTime() - left.presence.lastActiveAt.getTime())
    .slice(0, maxItems)
    .map((collaborator) => ({
      id: collaborator.id,
      displayName: collaborator.displayName,
      initials: getInitials(collaborator.displayName),
      avatarUrl: collaborator.avatarUrl,
      color: collaborator.color,
      status: collaborator.status,
    }));
}

export function formatPresenceLabel(
  activeCount: number,
  idleCount: number = 0,
): string {
  if (activeCount <= 0) return 'Nobody editing';
  if (idleCount > 0) {
    return activeCount === 1
      ? '1 person editing · 1 idle'
      : `${activeCount} people editing · ${idleCount} idle`;
  }
  return activeCount === 1 ? '1 person editing' : `${activeCount} people editing`;
}

export function sortPresenceByActivity(collaborators: Collaborator[]): Collaborator[] {
  return [...collaborators].sort(
    (left, right) => right.presence.lastActiveAt.getTime() - left.presence.lastActiveAt.getTime(),
  );
}

export function getPresenceHotspots(
  overlays: CursorOverlay[],
  distanceThreshold: number = 24,
): Array<{ x: number; y: number; collaboratorIds: string[]; count: number }> {
  const groups: Array<{ x: number; y: number; collaboratorIds: string[] }> = [];

  for (const overlay of overlays) {
    const existing = groups.find((group) => {
      const dx = group.x - overlay.x;
      const dy = group.y - overlay.y;
      return Math.sqrt(dx * dx + dy * dy) <= distanceThreshold;
    });

    if (existing) {
      existing.collaboratorIds.push(overlay.collaboratorId);
      existing.x = (existing.x + overlay.x) / 2;
      existing.y = (existing.y + overlay.y) / 2;
    } else {
      groups.push({
        x: overlay.x,
        y: overlay.y,
        collaboratorIds: [overlay.collaboratorId],
      });
    }
  }

  return groups.map((group) => ({
    x: group.x,
    y: group.y,
    collaboratorIds: group.collaboratorIds,
    count: group.collaboratorIds.length,
  }));
}
