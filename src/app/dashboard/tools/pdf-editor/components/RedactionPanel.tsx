// SPDX-License-Identifier: Apache-2.0
/**
 * RedactionPanel Component — Phase 4, Week 13
 *
 * Side panel for managing redaction marks.
 * Shows a list of all redaction areas, allows applying (burning),
 * and confirms irreversible redaction operations.
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  EyeOff,
  Trash2,
  AlertTriangle,
  Check,
  Palette,
  Type,
} from 'lucide-react';
import type { RedactionAnnotation } from '../types';
import { DEFAULT_REDACTION_FILL, REDACTION_OVERLAY_COLOR } from '../constants';
import {
  countRedactions,
  getRedactionMarkStyle,
} from '../engine/redaction-engine';

/* ──────────────────────── Props ──────────────────────── */

interface RedactionPanelProps {
  redactions: RedactionAnnotation[];
  onSelectRedaction: (id: string) => void;
  onDeleteRedaction: (id: string) => void;
  onUpdateRedaction: (id: string, update: Partial<RedactionAnnotation>) => void;
  onApplyAll: () => void;
  onApplySelected: (ids: string[]) => void;
  selectedId?: string;
}

/* ──────────────────────── Component ──────────────────────── */

export default function RedactionPanel({
  redactions,
  onSelectRedaction,
  onDeleteRedaction,
  onUpdateRedaction,
  onApplyAll,
  onApplySelected,
  selectedId,
}: RedactionPanelProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const counts = useMemo(() => countRedactions(redactions), [redactions]);
  const unapplied = useMemo(
    () => redactions.filter((r) => !r.applied),
    [redactions],
  );

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleApplyClick = useCallback((action: 'all' | 'selected') => {
    setConfirmAction(action);
    setShowConfirmDialog(true);
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'all') {
      onApplyAll();
    } else {
      onApplySelected([...selectedIds]);
    }
    setShowConfirmDialog(false);
    setSelectedIds(new Set());
  }, [confirmAction, selectedIds, onApplyAll, onApplySelected]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dash-border">
        <div className="flex items-center gap-2">
          <EyeOff className="h-4 w-4 text-red-400" />
          <h3 className="text-xs font-semibold text-dash-text">Redactions</h3>
        </div>
        <span className="text-[10px] text-dash-text-muted">
          {counts.unapplied} pending / {counts.applied} applied
        </span>
      </div>

      {/* Instructions */}
      {counts.total === 0 && (
        <div className="p-4 text-center text-xs text-dash-text-muted">
          <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p>No redaction marks yet.</p>
          <p className="mt-1 text-[10px]">
            Use the Redaction tool to mark areas to redact.
          </p>
        </div>
      )}

      {/* Redaction List */}
      <div className="flex-1 overflow-y-auto">
        {redactions.map((redaction) => {
          const style = getRedactionMarkStyle(redaction.applied);
          return (
            <div
              key={redaction.id}
              onClick={() => onSelectRedaction(redaction.id)}
              className={`flex items-center gap-2 px-3 py-2 border-b border-dash-border/50 cursor-pointer transition ${
                selectedId === redaction.id
                  ? 'bg-im-primary/10'
                  : 'hover:bg-dash-surface-hover'
              } ${redaction.applied ? 'opacity-60' : ''}`}
            >
              {/* Selection checkbox (only for unapplied) */}
              {!redaction.applied && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(redaction.id)}
                  onChange={() => toggleSelection(redaction.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-3.5 w-3.5 rounded border-dash-border accent-im-primary"
                />
              )}

              {/* Color swatch */}
              <div
                className="h-4 w-4 rounded border border-dash-border flex-shrink-0"
                style={{
                  backgroundColor: redaction.fillColor,
                  opacity: style.opacity,
                }}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-dash-text truncate">
                  {redaction.name}
                </p>
                <p className="text-[10px] text-dash-text-muted">
                  Page {redaction.page} • {Math.round(redaction.width)}×
                  {Math.round(redaction.height)}
                </p>
              </div>

              {/* Status badge */}
              {redaction.applied ? (
                <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
                  Applied
                </span>
              ) : (
                <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                  Pending
                </span>
              )}

              {/* Delete (only unapplied) */}
              {!redaction.applied && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRedaction(redaction.id);
                  }}
                  className="rounded p-0.5 text-dash-text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {counts.unapplied > 0 && (
        <div className="px-3 py-2 border-t border-dash-border space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => handleApplyClick('all')}
              className="flex-1 rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition"
            >
              Apply All ({counts.unapplied})
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => handleApplyClick('selected')}
                className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
              >
                Apply {selectedIds.size}
              </button>
            )}
          </div>
          <p className="text-[10px] text-dash-text-muted text-center">
            Applying redactions permanently removes content underneath.
          </p>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[380px] rounded-xl border border-dash-border bg-dash-surface p-5 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-red-500/20 p-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-dash-text">
                  Apply Redactions?
                </h3>
                <p className="text-[11px] text-dash-text-muted mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <p className="text-xs text-dash-text-muted mb-4">
              {confirmAction === 'all'
                ? `${counts.unapplied} redaction(s) will be permanently burned into the document. All content beneath the marked areas will be irrecoverably removed.`
                : `${selectedIds.size} selected redaction(s) will be permanently burned into the document.`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="rounded-md border border-dash-border px-3 py-1.5 text-xs text-dash-text-muted hover:bg-dash-surface-hover transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="rounded-md bg-red-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition"
              >
                <Check className="h-3 w-3 inline-block mr-1" />
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
