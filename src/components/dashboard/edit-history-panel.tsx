// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  History,
  RotateCcw,
  Clock,
  User,
  Sliders,
  Crop,
  Pencil,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface EditEntry {
  index: number;
  adjustments: Record<string, number>;
  cropSettings: Record<string, unknown> | null;
  annotationCount: number;
  timestamp: string;
  user: { name?: string; email?: string } | null;
  mode: 'copy' | 'overwrite';
}

interface EditHistoryPanelProps {
  assetId: string;
  onRevert?: () => void;
  className?: string;
}

export function EditHistoryPanel({
  assetId,
  onRevert,
  className = '',
}: EditHistoryPanelProps) {
  const [edits, setEdits] = useState<EditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOriginal, setHasOriginal] = useState(false);
  const [editCount, setEditCount] = useState(0);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [reverting, setReverting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${assetId}/edits`);
      if (!res.ok) throw new Error('Failed to load edit history');
      const data = await res.json();
      setEdits(data.edits || []);
      setHasOriginal(data.hasOriginal);
      setEditCount(data.editCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRevert = async () => {
    if (!confirm('Revert to original? This will undo all edits.')) return;
    setReverting(true);
    try {
      const res = await fetch('/api/assets/edit/revert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Revert failed');
      }
      await fetchHistory();
      onRevert?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revert failed');
    } finally {
      setReverting(false);
    }
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAdjustmentSummary = (adj: Record<string, number>) => {
    const entries = Object.entries(adj).filter(([, v]) => v !== 0);
    if (entries.length === 0) return 'No adjustments';
    return (
      entries
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v}`)
        .join(', ') +
      (entries.length > 3 ? `, +${entries.length - 3} more` : '')
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        <span className="ml-2 text-sm text-zinc-500">Loading history…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 ${className}`}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Edit History
          </h3>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {editCount} edits
          </span>
        </div>

        {hasOriginal && (
          <button
            onClick={handleRevert}
            disabled={reverting}
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
          >
            {reverting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3" />
            )}
            Revert to Original
          </button>
        )}
      </div>

      {/* Edit list */}
      {edits.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-zinc-400">
          No edits recorded yet
        </div>
      ) : (
        <div className="max-h-80 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-700">
          {edits.map((edit) => (
            <div key={edit.index} className="group">
              <button
                onClick={() =>
                  setExpandedIdx(expandedIdx === edit.index ? null : edit.index)
                }
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  #{editCount - edit.index}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
                      {getAdjustmentSummary(edit.adjustments)}
                    </span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                        edit.mode === 'overwrite'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                          : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      }`}
                    >
                      {edit.mode}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDate(edit.timestamp)}
                    </span>
                    {edit.user && (
                      <span className="flex items-center gap-0.5">
                        <User className="h-2.5 w-2.5" />
                        {edit.user.name || edit.user.email || 'Unknown'}
                      </span>
                    )}
                  </div>
                </div>

                {expandedIdx === edit.index ? (
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                )}
              </button>

              {/* Expanded details */}
              {expandedIdx === edit.index && (
                <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {/* Adjustments detail */}
                    <div className="flex items-start gap-2">
                      <Sliders className="mt-0.5 h-3 w-3 shrink-0" />
                      <div>
                        <span className="font-medium">Adjustments:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(edit.adjustments)
                            .filter(([, v]) => v !== 0)
                            .map(([k, v]) => (
                              <span
                                key={k}
                                className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] dark:bg-zinc-700"
                              >
                                {k}: {v > 0 ? '+' : ''}
                                {v}
                              </span>
                            ))}
                          {Object.entries(edit.adjustments).filter(
                            ([, v]) => v !== 0,
                          ).length === 0 && (
                            <span className="text-zinc-400">None</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Crop */}
                    {edit.cropSettings && (
                      <div className="flex items-center gap-2">
                        <Crop className="h-3 w-3" />
                        <span>Cropped</span>
                      </div>
                    )}

                    {/* Annotations */}
                    {edit.annotationCount > 0 && (
                      <div className="flex items-center gap-2">
                        <Pencil className="h-3 w-3" />
                        <span>
                          {edit.annotationCount} annotation
                          {edit.annotationCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
