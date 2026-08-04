// SPDX-License-Identifier: Apache-2.0
/**
 * Realtime Collaboration Engine — Sprint 17.1/17.3/17.5
 *
 * Pure-function helpers for design-session collaboration state:
 * - session lifecycle
 * - collaborator presence
 * - live selections
 * - presence indicator summaries
 */

export type CollaboratorRole = 'owner' | 'editor' | 'commenter' | 'viewer';
export type CollaboratorStatus = 'online' | 'idle' | 'offline';
export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface CursorPosition {
  x: number;
  y: number;
}

export interface CollaboratorPresence {
  pageId: string | null;
  cursor: CursorPosition | null;
  selectionIds: string[];
  lastActiveAt: Date;
}

export interface Collaborator {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  presence: CollaboratorPresence;
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface RealtimeSession {
  sessionId: string;
  designId: string;
  orgId: string;
  hostId: string;
  connectionStatus: ConnectionStatus;
  collaborators: Collaborator[];
  maxCollaborators: number;
  createdAt: Date;
  updatedAt: Date;
  lastEventAt: Date;
}

export interface CreateRealtimeSessionInput {
  sessionId?: string;
  designId: string;
  orgId: string;
  hostId: string;
  maxCollaborators?: number;
}

export interface JoinCollaboratorInput {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  role: CollaboratorRole;
  color?: string;
  pageId?: string | null;
}

export interface PresenceIndicatorSummary {
  totalCollaborators: number;
  onlineCount: number;
  idleCount: number;
  offlineCount: number;
  editingCount: number;
  label: string;
  avatarStack: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    color: string;
    status: CollaboratorStatus;
  }>;
}

export interface SelectionAwarenessEntry {
  collaboratorId: string;
  displayName: string;
  color: string;
  selectionIds: string[];
  pageId: string | null;
}

export const DEFAULT_COLLABORATOR_COLORS = [
  '#7C3AED',
  '#2563EB',
  '#059669',
  '#DC2626',
  '#EA580C',
  '#DB2777',
  '#0891B2',
  '#4F46E5',
] as const;

const ROLE_PRIORITY: Record<CollaboratorRole, number> = {
  owner: 0,
  editor: 1,
  commenter: 2,
  viewer: 3,
};

function buildEmptyPresence(now: Date, pageId: string | null = null): CollaboratorPresence {
  return {
    pageId,
    cursor: null,
    selectionIds: [],
    lastActiveAt: now,
  };
}

function pickCollaboratorColor(collaborators: Collaborator[], preferred?: string): string {
  if (preferred) return preferred;
  const used = new Set(collaborators.map((collaborator) => collaborator.color));
  const next = DEFAULT_COLLABORATOR_COLORS.find((color) => !used.has(color));
  return next ?? DEFAULT_COLLABORATOR_COLORS[collaborators.length % DEFAULT_COLLABORATOR_COLORS.length];
}

export function createRealtimeSession(
  input: CreateRealtimeSessionInput,
  now: Date = new Date(),
): RealtimeSession {
  return {
    sessionId: input.sessionId ?? `rt_${input.designId}_${now.getTime()}`,
    designId: input.designId,
    orgId: input.orgId,
    hostId: input.hostId,
    connectionStatus: 'connecting',
    collaborators: [],
    maxCollaborators: input.maxCollaborators ?? 25,
    createdAt: now,
    updatedAt: now,
    lastEventAt: now,
  };
}

export function getCollaborator(
  session: RealtimeSession,
  collaboratorId: string,
): Collaborator | null {
  return session.collaborators.find((collaborator) => collaborator.id === collaboratorId) ?? null;
}

export function canCollaboratorEdit(role: CollaboratorRole): boolean {
  return role === 'owner' || role === 'editor';
}

export function joinRealtimeSession(
  session: RealtimeSession,
  collaborator: JoinCollaboratorInput,
  now: Date = new Date(),
): RealtimeSession {
  const existing = getCollaborator(session, collaborator.id);
  const color = pickCollaboratorColor(session.collaborators, collaborator.color);

  if (existing) {
    return {
      ...session,
      collaborators: session.collaborators.map((item) =>
        item.id === collaborator.id
          ? {
              ...item,
              displayName: collaborator.displayName,
              avatarUrl: collaborator.avatarUrl ?? null,
              role: collaborator.role,
              color,
              status: 'online',
              presence: {
                ...item.presence,
                pageId: collaborator.pageId ?? item.presence.pageId,
                lastActiveAt: now,
              },
              lastSeenAt: now,
            }
          : item,
      ),
      updatedAt: now,
      lastEventAt: now,
    };
  }

  if (session.collaborators.length >= session.maxCollaborators) {
    return {
      ...session,
      connectionStatus: 'error',
      updatedAt: now,
      lastEventAt: now,
    };
  }

  return {
    ...session,
    connectionStatus: session.connectionStatus === 'error' ? 'connected' : session.connectionStatus,
    collaborators: [
      ...session.collaborators,
      {
        id: collaborator.id,
        userId: collaborator.userId,
        displayName: collaborator.displayName,
        avatarUrl: collaborator.avatarUrl ?? null,
        color,
        role: collaborator.role,
        status: 'online',
        presence: buildEmptyPresence(now, collaborator.pageId ?? null),
        joinedAt: now,
        lastSeenAt: now,
      },
    ],
    updatedAt: now,
    lastEventAt: now,
  };
}

export function leaveRealtimeSession(
  session: RealtimeSession,
  collaboratorId: string,
  now: Date = new Date(),
): RealtimeSession {
  return {
    ...session,
    collaborators: session.collaborators.map((collaborator) =>
      collaborator.id === collaboratorId
        ? {
            ...collaborator,
            status: 'offline',
            presence: {
              ...collaborator.presence,
              cursor: null,
              selectionIds: [],
            },
            lastSeenAt: now,
          }
        : collaborator,
    ),
    updatedAt: now,
    lastEventAt: now,
  };
}

export function setSessionConnectionStatus(
  session: RealtimeSession,
  status: ConnectionStatus,
  now: Date = new Date(),
): RealtimeSession {
  return {
    ...session,
    connectionStatus: status,
    updatedAt: now,
    lastEventAt: now,
  };
}

export interface UpdateCollaboratorPresenceInput {
  pageId?: string | null;
  cursor?: CursorPosition | null;
  selectionIds?: string[];
  status?: CollaboratorStatus;
}

export function updateCollaboratorPresence(
  session: RealtimeSession,
  collaboratorId: string,
  input: UpdateCollaboratorPresenceInput,
  now: Date = new Date(),
): RealtimeSession {
  return {
    ...session,
    collaborators: session.collaborators.map((collaborator) => {
      if (collaborator.id !== collaboratorId) return collaborator;
      return {
        ...collaborator,
        status: input.status ?? collaborator.status,
        presence: {
          pageId: input.pageId ?? collaborator.presence.pageId,
          cursor: input.cursor === undefined ? collaborator.presence.cursor : input.cursor,
          selectionIds: input.selectionIds ?? collaborator.presence.selectionIds,
          lastActiveAt: now,
        },
        lastSeenAt: now,
      };
    }),
    updatedAt: now,
    lastEventAt: now,
  };
}

export function markIdleCollaborators(
  session: RealtimeSession,
  idleThresholdMs: number,
  now: Date = new Date(),
): RealtimeSession {
  return {
    ...session,
    collaborators: session.collaborators.map((collaborator) => {
      if (collaborator.status === 'offline') return collaborator;
      const idle = now.getTime() - collaborator.presence.lastActiveAt.getTime() >= idleThresholdMs;
      return {
        ...collaborator,
        status: idle ? 'idle' : 'online',
      };
    }),
    updatedAt: now,
  };
}

export function getActiveCollaborators(session: RealtimeSession): Collaborator[] {
  return session.collaborators
    .filter((collaborator) => collaborator.status !== 'offline')
    .sort((left, right) => {
      const roleDelta = ROLE_PRIORITY[left.role] - ROLE_PRIORITY[right.role];
      if (roleDelta !== 0) return roleDelta;
      return right.presence.lastActiveAt.getTime() - left.presence.lastActiveAt.getTime();
    });
}

export function getSelectionAwareness(
  session: RealtimeSession,
  pageId?: string | null,
): SelectionAwarenessEntry[] {
  return getActiveCollaborators(session)
    .filter((collaborator) => collaborator.presence.selectionIds.length > 0)
    .filter((collaborator) => pageId == null || collaborator.presence.pageId === pageId)
    .map((collaborator) => ({
      collaboratorId: collaborator.id,
      displayName: collaborator.displayName,
      color: collaborator.color,
      selectionIds: [...collaborator.presence.selectionIds],
      pageId: collaborator.presence.pageId,
    }));
}

export function buildPresenceIndicatorSummary(
  session: RealtimeSession,
  maxAvatars: number = 5,
): PresenceIndicatorSummary {
  const online = session.collaborators.filter((collaborator) => collaborator.status === 'online');
  const idle = session.collaborators.filter((collaborator) => collaborator.status === 'idle');
  const offline = session.collaborators.filter((collaborator) => collaborator.status === 'offline');
  const editing = session.collaborators.filter(
    (collaborator) => collaborator.status !== 'offline' && canCollaboratorEdit(collaborator.role),
  );

  const avatarStack = getActiveCollaborators(session)
    .slice(0, maxAvatars)
    .map((collaborator) => ({
      id: collaborator.id,
      displayName: collaborator.displayName,
      avatarUrl: collaborator.avatarUrl,
      color: collaborator.color,
      status: collaborator.status,
    }));

  const activeCount = online.length + idle.length;
  const label =
    activeCount === 0
      ? 'Nobody editing'
      : activeCount === 1
        ? '1 person editing'
        : `${activeCount} people editing`;

  return {
    totalCollaborators: session.collaborators.length,
    onlineCount: online.length,
    idleCount: idle.length,
    offlineCount: offline.length,
    editingCount: editing.length,
    label,
    avatarStack,
  };
}

export function getPresencePageBreakdown(
  session: RealtimeSession,
): Array<{ pageId: string; collaboratorIds: string[]; count: number }> {
  const pageMap = new Map<string, string[]>();

  for (const collaborator of getActiveCollaborators(session)) {
    const pageId = collaborator.presence.pageId;
    if (!pageId) continue;
    const existing = pageMap.get(pageId) ?? [];
    existing.push(collaborator.id);
    pageMap.set(pageId, existing);
  }

  return [...pageMap.entries()]
    .map(([pageId, collaboratorIds]) => ({
      pageId,
      collaboratorIds,
      count: collaboratorIds.length,
    }))
    .sort((left, right) => right.count - left.count);
}

export function sanitizeSelectionIds(selectionIds: string[]): string[] {
  return [...new Set(selectionIds.filter(Boolean))];
}
