// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-7.5 — Batch Rename Tool
 * Pattern-based renaming with live preview.
 * Works on a local file list (no server call in demo) — ready to wire to server action.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { X, Upload, Type, ArrowRight, Check, Loader2, Library } from 'lucide-react';
import dynamic from 'next/dynamic';

const AssetPicker = dynamic(() => import('@/components/dashboard/asset-picker'), { ssr: false });

interface RenameEntry {
  id: string;
  originalName: string;
  extension: string;
}

export interface BatchRenameModalProps {
  onClose: () => void;
}

/* ── Pattern tokens (exported for tests) ── */
export const RENAME_TOKENS = [
  { token: '{original}', label: 'Original name', desc: 'Filename without extension' },
  { token: '{counter}', label: 'Counter', desc: 'Sequential number (001, 002, ...)' },
  { token: '{date}', label: 'Date', desc: 'YYYY-MM-DD' },
  { token: '{time}', label: 'Time', desc: 'HH-MM-SS' },
  { token: '{random}', label: 'Random', desc: '4-char random string' },
] as const;

/** Apply rename pattern to a single entry */
export function applyPattern(
  entry: RenameEntry,
  pattern: string,
  index: number,
  prefix: string,
  suffix: string,
): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  const counter = String(index + 1).padStart(3, '0');
  const random = Math.random().toString(36).slice(2, 6);

  let result = pattern
    .replace(/\{original\}/gi, entry.originalName)
    .replace(/\{counter\}/gi, counter)
    .replace(/\{date\}/gi, dateStr)
    .replace(/\{time\}/gi, timeStr)
    .replace(/\{random\}/gi, random);

  result = `${prefix}${result}${suffix}`;

  // Sanitize: remove characters invalid in filenames
  result = result.replace(/[<>:"/\\|?*]/g, '_');

  return `${result}.${entry.extension}`;
}

let _rnId = 0;

export default function BatchRenameModal({ onClose }: BatchRenameModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<RenameEntry[]>([]);
  const [pattern, setPattern] = useState('{original}');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newEntries: RenameEntry[] = [];
    for (const file of Array.from(fileList)) {
      const dotIdx = file.name.lastIndexOf('.');
      const name = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name;
      const ext = dotIdx > 0 ? file.name.slice(dotIdx + 1) : '';
      newEntries.push({
        id: `rn-${++_rnId}-${Date.now()}`,
        originalName: name,
        extension: ext,
      });
    }
    setEntries((prev) => [...prev, ...newEntries]);
    setApplied(false);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  // Stable preview (pin random value per render cycle)
  const previewNames = useMemo(() => {
    return entries.map((entry, i) => applyPattern(entry, pattern, i, prefix, suffix));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, pattern, prefix, suffix]);

  const handleApply = useCallback(async () => {
    if (entries.length === 0) {
      setError('Please add files to rename.');
      return;
    }
    setApplying(true);
    setError(null);
    try {
      // In a full implementation, this would call a server action:
      // await batchRenameAction(entries.map((e, i) => ({ oldName: `${e.originalName}.${e.extension}`, newName: previewNames[i] })))
      // For now, simulate a brief delay
      await new Promise((r) => setTimeout(r, 300));
      setApplied(true);
    } catch (err) {
      setError(`Rename failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApplying(false);
    }
  }, [entries]);

  const insertToken = useCallback((token: string) => {
    setPattern((prev) => prev + token);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">Batch Rename</h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Rename multiple files using pattern templates
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Source selection */}
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 h-20 cursor-pointer transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              data-testid="rename-drop"
            >
              <div className="flex flex-col items-center gap-1 text-dash-text-muted">
                <Upload className="h-5 w-5" />
                <p className="text-xs font-medium">Upload files</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <button
              onClick={() => setShowPicker(true)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-20 w-36 cursor-pointer transition-colors text-dash-text-muted"
              data-testid="rename-browse"
            >
              <Library className="h-5 w-5" />
              <span className="text-xs font-medium">Browse Library</span>
            </button>
          </div>

          {/* Pattern input */}
          <div>
            <label className="block text-xs font-medium text-dash-text2 mb-1">Rename Pattern</label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => { setPattern(e.target.value); setApplied(false); }}
              className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text font-mono"
              placeholder="{original}"
              data-testid="rename-pattern"
            />
          </div>

          {/* Token pills */}
          <div className="flex flex-wrap gap-1.5">
            {RENAME_TOKENS.map((t) => (
              <button
                key={t.token}
                onClick={() => insertToken(t.token)}
                className="rounded-full border border-dash-border px-2.5 py-1 text-[10px] font-medium text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
                title={t.desc}
                data-testid={`rename-token-${t.token.replace(/[{}]/g, '')}`}
              >
                {t.token}
              </button>
            ))}
          </div>

          {/* Prefix / Suffix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">Prefix</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => { setPrefix(e.target.value); setApplied(false); }}
                className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text"
                placeholder="e.g. project_"
                data-testid="rename-prefix"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-dash-text2 mb-1">Suffix</label>
              <input
                type="text"
                value={suffix}
                onChange={(e) => { setSuffix(e.target.value); setApplied(false); }}
                className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 text-sm text-dash-text"
                placeholder="e.g. _final"
                data-testid="rename-suffix"
              />
            </div>
          </div>

          {/* Preview list */}
          {entries.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto" data-testid="rename-preview">
              {entries.map((entry, i) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 rounded-lg border border-dash-border px-3 py-1.5 text-xs"
                >
                  <span className="text-dash-text-muted truncate flex-1">
                    {entry.originalName}.{entry.extension}
                  </span>
                  <ArrowRight className="h-3 w-3 text-dash-text-muted flex-shrink-0" />
                  <span className="text-dash-text font-medium truncate flex-1">
                    {previewNames[i]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={entries.length === 0 || applying || applied}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="rename-apply-btn"
          >
            {applying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Renaming…
              </>
            ) : applied ? (
              <>
                <Check className="h-4 w-4" />
                Renamed!
              </>
            ) : (
              <>
                <Type className="h-4 w-4" />
                Apply Rename
              </>
            )}
          </button>
        </div>
      </div>

      {/* Asset Picker overlay */}
      {showPicker && (
        <AssetPicker
          multiple
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            addFiles(files);
          }}
        />
      )}
    </div>
  );
}
