// SPDX-License-Identifier: Apache-2.0
/**
 * CollaborationPanel — Phase 6, Week 21
 *
 * Left sidebar panel showing:
 * - Connection status indicator
 * - Collaborator list with avatars, cursors, and presence
 * - Object lock indicators
 * - Share session / invite link controls
 * - Role management for the host
 */

'use client';

import { copyText } from '@/lib/clipboard';
import { useState } from 'react';
import {
  Users,
  Link2,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Clock,
  UserPlus,
  Eye,
  Edit3,
  MessageSquare,
  Crown,
  Lock,
} from 'lucide-react';
import type {
  CollaborationSession,
  Collaborator,
  CollaboratorRole,
} from '../types';

/* ──────────────── Props ──────────────── */

interface CollaborationPanelProps {
  session: CollaborationSession | null;
  currentCollaboratorId: string | null;
  onCreateSession: () => void;
  onLeaveSession: () => void;
  onGenerateInvite: () => void;
  onChangeRole: (collaboratorId: string, role: CollaboratorRole) => void;
  onKickCollaborator: (collaboratorId: string) => void;
}

/* ──────────────── Status Badge ──────────────── */

function ConnectionBadge({
  status,
}: {
  status: CollaborationSession['connectionStatus'];
}) {
  const config: Record<
    string,
    { icon: typeof Wifi; color: string; label: string }
  > = {
    connected: { icon: Wifi, color: 'text-green-500', label: 'Connected' },
    connecting: { icon: Clock, color: 'text-yellow-500', label: 'Connecting…' },
    reconnecting: {
      icon: Clock,
      color: 'text-yellow-500',
      label: 'Reconnecting…',
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-[var(--dash-text-muted)]',
      label: 'Disconnected',
    },
    error: { icon: WifiOff, color: 'text-red-500', label: 'Connection Error' },
  };
  const c = config[status] ?? config.disconnected;
  const Icon = c.icon;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={`h-3 w-3 ${c.color}`} />
      <span className={c.color}>{c.label}</span>
    </div>
  );
}

/* ──────────────── Role Icon ──────────────── */

function RoleIcon({ role }: { role: CollaboratorRole }) {
  switch (role) {
    case 'owner':
      return <Crown className="h-3 w-3 text-yellow-500" />;
    case 'editor':
      return <Edit3 className="h-3 w-3 text-blue-500" />;
    case 'commenter':
      return <MessageSquare className="h-3 w-3 text-green-500" />;
    case 'viewer':
      return <Eye className="h-3 w-3 text-[var(--dash-text-muted)]" />;
    default:
      return null;
  }
}

/* ──────────────── Collaborator Row ──────────────── */

function CollaboratorRow({
  collaborator,
  isHost,
  isSelf,
  onChangeRole,
  onKick,
}: {
  collaborator: Collaborator;
  isHost: boolean;
  isSelf: boolean;
  onChangeRole: (role: CollaboratorRole) => void;
  onKick: () => void;
}) {
  const statusColors: Record<string, string> = {
    online: 'bg-green-500',
    idle: 'bg-yellow-500',
    offline: 'bg-gray-400',
  };

  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--dash-surface-hover)]">
      {/* Avatar / Color dot */}
      <div className="relative">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: collaborator.color }}
        >
          {collaborator.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--dash-surface)] ${statusColors[collaborator.status] ?? 'bg-gray-400'}`}
        />
      </div>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 text-xs font-medium text-[var(--dash-text)] truncate">
          {collaborator.displayName}
          {isSelf && (
            <span className="text-[var(--dash-text-muted)]">(you)</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[var(--dash-text-muted)]">
          <RoleIcon role={collaborator.role} />
          <span className="capitalize">{collaborator.role}</span>
          {collaborator.currentPage && (
            <span>· Page {collaborator.currentPage}</span>
          )}
        </div>
      </div>

      {/* Host actions */}
      {isHost && !isSelf && (
        <div className="flex items-center gap-1">
          <select
            className="h-5 rounded bg-[var(--dash-surface)] text-[10px] text-[var(--dash-text)] border border-[var(--dash-border)] cursor-pointer"
            value={collaborator.role}
            onChange={(e) => onChangeRole(e.target.value as CollaboratorRole)}
          >
            <option value="editor">Editor</option>
            <option value="commenter">Commenter</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={onKick}
            className="rounded p-0.5 text-[var(--dash-text-muted)] hover:text-red-500 hover:bg-red-500/10"
            title="Remove from session"
          >
            <Users className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────── Main Panel ──────────────── */

export default function CollaborationPanel({
  session,
  currentCollaboratorId,
  onCreateSession,
  onLeaveSession,
  onGenerateInvite,
  onChangeRole,
  onKickCollaborator,
}: CollaborationPanelProps) {
  const [copied, setCopied] = useState(false);

  const isHost = session?.hostId === currentCollaboratorId;

  function copyInviteLink() {
    if (session?.inviteLink) {
      copyText(session.inviteLink).then((ok) => {
        if (!ok) return; // Clipboard write failed (permissions/insecure context)
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  /* ── No session ── */
  if (!session) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 p-4"
        data-testid="collaboration-panel"
      >
        <Users className="h-10 w-10 text-[var(--dash-text-muted)]" />
        <p className="text-sm text-[var(--dash-text-muted)] text-center">
          Start a collaboration session to edit with others in real time.
        </p>
        <button
          onClick={onCreateSession}
          className="flex items-center gap-2 rounded-lg bg-[var(--im-primary)] px-4 py-2 text-sm font-medium text-[var(--im-primary-fg)] hover:opacity-90 transition"
        >
          <UserPlus className="h-4 w-4" />
          Start Session
        </button>
      </div>
    );
  }

  const online = session.collaborators.filter((c) => c.status !== 'offline');
  const offline = session.collaborators.filter((c) => c.status === 'offline');

  return (
    <div
      className="flex h-full flex-col text-xs"
      data-testid="collaboration-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-3 py-2">
        <div className="flex items-center gap-2 font-semibold text-[var(--dash-text)]">
          <Users className="h-4 w-4" />
          Collaboration
        </div>
        <ConnectionBadge status={session.connectionStatus} />
      </div>

      {/* Invite link */}
      <div className="border-b border-[var(--dash-border)] p-3 space-y-2">
        {session.inviteLink ? (
          <div className="flex items-center gap-1">
            <div className="flex-1 truncate rounded bg-[var(--dash-surface-hover)] px-2 py-1 text-[10px] text-[var(--dash-text-muted)]">
              {session.inviteLink}
            </div>
            <button
              onClick={copyInviteLink}
              className="rounded p-1 hover:bg-[var(--dash-surface-hover)] text-[var(--dash-text-muted)]"
              title="Copy invite link"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={onGenerateInvite}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--dash-border)] px-3 py-1.5 text-[var(--dash-text-muted)] hover:border-[var(--im-primary)] hover:text-[var(--im-primary)] transition"
          >
            <Link2 className="h-3.5 w-3.5" />
            Generate Invite Link
          </button>
        )}
      </div>

      {/* Collaborators */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Online / Idle */}
        {online.length > 0 && (
          <div className="mb-2">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">
              Online ({online.length})
            </div>
            {online.map((c) => (
              <CollaboratorRow
                key={c.id}
                collaborator={c}
                isHost={isHost}
                isSelf={c.id === currentCollaboratorId}
                onChangeRole={(role) => onChangeRole(c.id, role)}
                onKick={() => onKickCollaborator(c.id)}
              />
            ))}
          </div>
        )}

        {/* Offline */}
        {offline.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">
              Offline ({offline.length})
            </div>
            {offline.map((c) => (
              <CollaboratorRow
                key={c.id}
                collaborator={c}
                isHost={isHost}
                isSelf={c.id === currentCollaboratorId}
                onChangeRole={(role) => onChangeRole(c.id, role)}
                onKick={() => onKickCollaborator(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Locks indicator */}
      {session.locks.length > 0 && (
        <div className="border-t border-[var(--dash-border)] p-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-[var(--dash-text-muted)]">
            <Lock className="h-3 w-3" />
            {session.locks.length} object{session.locks.length !== 1 ? 's' : ''}{' '}
            locked
          </div>
        </div>
      )}

      {/* Leave button */}
      <div className="border-t border-[var(--dash-border)] p-3">
        <button
          onClick={onLeaveSession}
          className="w-full rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition"
        >
          {isHost ? 'End Session' : 'Leave Session'}
        </button>
      </div>
    </div>
  );
}
