// SPDX-License-Identifier: Apache-2.0
'use client';

import { History, X, Clock, RotateCcw } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */
export interface SnapshotEntry {
  _id: string;
  name: string;
  createdAt: string;
}

interface VersionPanelProps {
  open: boolean;
  onClose: () => void;
  snapshots: SnapshotEntry[];
  snapshotName: string;
  onSnapshotNameChange: (v: string) => void;
  snapshotLoading: boolean;
  onCreateSnapshot: (name: string) => void;
  onRestoreSnapshot: (id: string) => void;
}

/* ─── Component ──────────────────────────────────────────────────────── */
export default function VersionPanel({
  open,
  onClose,
  snapshots,
  snapshotName,
  onSnapshotNameChange,
  snapshotLoading,
  onCreateSnapshot,
  onRestoreSnapshot,
}: VersionPanelProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[420px] max-h-[80vh] rounded-xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
          <div className="flex items-center gap-2">
            <History size={16} className="text-dash-text2" />
            <h3 className="text-sm font-semibold text-dash-text">
              Version History
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text2 hover:bg-dash-muted transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Create new snapshot */}
        <div className="border-b border-dash-border p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Snapshot name (e.g. v1.0 final)"
              value={snapshotName}
              onChange={(e) => onSnapshotNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && snapshotName.trim()) {
                  onCreateSnapshot(snapshotName.trim());
                }
              }}
              className="flex-1 rounded-lg border border-dash-border bg-dash-bg px-3 py-1.5 text-xs text-dash-text placeholder:text-dash-text2/50 focus:border-[var(--im-primary)] focus:outline-none"
            />
            <button
              onClick={() => {
                if (snapshotName.trim()) {
                  onCreateSnapshot(snapshotName.trim());
                } else {
                  onCreateSnapshot(`Snapshot ${new Date().toLocaleString()}`);
                }
              }}
              disabled={snapshotLoading}
              className="rounded-lg bg-[var(--im-primary)] px-3 py-1.5 text-xs font-medium text-[var(--im-primary-fg)] hover:bg-[var(--im-primary)]/90 disabled:opacity-50 transition-colors"
            >
              {snapshotLoading ? '…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Snapshot list */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {snapshots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-dash-text2/60">
              <Clock size={24} />
              <p className="text-xs">No saved versions yet</p>
              <p className="text-[10px]">
                Save a snapshot to preserve a point in time
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {snapshots.map((snap) => (
                <div
                  key={snap._id}
                  className="flex items-center justify-between rounded-lg border border-dash-border px-3 py-2 hover:bg-dash-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-medium text-dash-text">
                      {snap.name}
                    </p>
                    <p className="text-[10px] text-dash-text2/70">
                      {new Date(snap.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onRestoreSnapshot(snap._id)}
                    disabled={snapshotLoading}
                    className="flex items-center gap-1 rounded-md border border-dash-border px-2 py-1 text-[10px] font-medium text-dash-text2 hover:bg-dash-muted disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw size={10} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
