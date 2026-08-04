// SPDX-License-Identifier: Apache-2.0
/**
 * MetadataEditor Component — Phase 4, Week 15
 *
 * Form-based editor for PDF document metadata (Title, Author, Subject, etc.)
 * and custom metadata key-value pairs.
 */

'use client';

import { useState, useCallback } from 'react';
import { Info, Plus, Trash2, Calendar, Tag, X } from 'lucide-react';
import type { PdfMetadata } from '../types';
import {
  createEmptyMetadata,
  updateMetadata,
  getMetadataFieldCount,
  parseKeywords,
  joinKeywords,
} from '../engine/metadata-engine';

/* ──────────────────────── Props ──────────────────────── */

interface MetadataEditorProps {
  open: boolean;
  onClose: () => void;
  onApply: (metadata: PdfMetadata) => void;
  initialMetadata?: PdfMetadata;
}

/* ──────────────────────── Component ──────────────────────── */

export default function MetadataEditor({
  open,
  onClose,
  onApply,
  initialMetadata,
}: MetadataEditorProps) {
  const [metadata, setMetadata] = useState<PdfMetadata>(
    initialMetadata ?? createEmptyMetadata(),
  );
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');

  const fieldCount = getMetadataFieldCount(metadata);

  const updateField = useCallback(
    <K extends keyof PdfMetadata>(key: K, value: PdfMetadata[K]) => {
      setMetadata((prev) =>
        updateMetadata(prev, { [key]: value } as Partial<PdfMetadata>),
      );
    },
    [],
  );

  const addCustomField = useCallback(() => {
    if (!newCustomKey.trim()) return;
    setMetadata((prev) => ({
      ...prev,
      custom: { ...prev.custom, [newCustomKey.trim()]: newCustomValue },
    }));
    setNewCustomKey('');
    setNewCustomValue('');
  }, [newCustomKey, newCustomValue]);

  const removeCustomField = useCallback((key: string) => {
    setMetadata((prev) => {
      const custom = { ...prev.custom };
      delete custom[key];
      return { ...prev, custom };
    });
  }, []);

  const handleApply = useCallback(() => {
    onApply(metadata);
    onClose();
  }, [metadata, onApply, onClose]);

  const handleClear = useCallback(() => {
    setMetadata(createEmptyMetadata());
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[480px] max-h-[85vh] rounded-xl border border-dash-border bg-dash-surface shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dash-border">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-im-primary" />
            <h2 className="text-sm font-semibold text-dash-text">
              Document Metadata
            </h2>
            <span className="text-[10px] text-dash-text-muted">
              ({fieldCount} fields)
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Standard Fields */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-dash-text">
              Standard Properties
            </h3>

            {(
              [
                ['title', 'Title', 'Document title'],
                ['author', 'Author', 'Document author'],
                ['subject', 'Subject', 'Document subject or description'],
                [
                  'creator',
                  'Creator',
                  'Application that created the original document',
                ],
                ['producer', 'Producer', 'Application that produced the PDF'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] text-dash-text-muted">
                  {label}
                </label>
                <input
                  type="text"
                  value={metadata[key] ?? ''}
                  onChange={(e) => updateField(key, e.target.value)}
                  placeholder={placeholder}
                  className="w-full rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 text-xs text-dash-text placeholder:text-dash-text-muted/50 focus:border-im-primary focus:outline-none"
                />
              </div>
            ))}

            {/* Keywords */}
            <div className="space-y-1">
              <label className="text-[11px] text-dash-text-muted flex items-center gap-1">
                <Tag className="h-3 w-3" /> Keywords
              </label>
              <input
                type="text"
                value={metadata.keywords ?? ''}
                onChange={(e) => updateField('keywords', e.target.value)}
                placeholder="keyword1, keyword2, keyword3"
                className="w-full rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 text-xs text-dash-text placeholder:text-dash-text-muted/50 focus:border-im-primary focus:outline-none"
              />
              {metadata.keywords && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {parseKeywords(metadata.keywords).map((kw, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-im-primary/10 px-2 py-0.5 text-[10px] text-im-primary"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Dates (read-only display) */}
            {(metadata.creationDate || metadata.modificationDate) && (
              <div className="grid grid-cols-2 gap-3">
                {metadata.creationDate && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-dash-text-muted flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Created
                    </label>
                    <p className="text-[11px] text-dash-text">
                      {metadata.creationDate.toLocaleDateString()}
                    </p>
                  </div>
                )}
                {metadata.modificationDate && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-dash-text-muted flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Modified
                    </label>
                    <p className="text-[11px] text-dash-text">
                      {metadata.modificationDate.toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Custom Fields */}
          <section className="space-y-3">
            <h3 className="text-xs font-medium text-dash-text">
              Custom Properties
            </h3>

            {Object.entries(metadata.custom).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <input
                  type="text"
                  value={key}
                  disabled
                  className="w-1/3 rounded-md border border-dash-border bg-dash-surface-hover px-2 py-1.5 text-xs text-dash-text-muted"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) =>
                    setMetadata((prev) => ({
                      ...prev,
                      custom: { ...prev.custom, [key]: e.target.value },
                    }))
                  }
                  className="flex-1 rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text focus:border-im-primary focus:outline-none"
                />
                <button
                  onClick={() => removeCustomField(key)}
                  className="rounded p-1 text-dash-text-muted hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Add Custom Field */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newCustomKey}
                onChange={(e) => setNewCustomKey(e.target.value)}
                placeholder="Key"
                className="w-1/3 rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text placeholder:text-dash-text-muted/50 focus:border-im-primary focus:outline-none"
              />
              <input
                type="text"
                value={newCustomValue}
                onChange={(e) => setNewCustomValue(e.target.value)}
                placeholder="Value"
                onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
                className="flex-1 rounded-md border border-dash-border bg-dash-surface px-2 py-1.5 text-xs text-dash-text placeholder:text-dash-text-muted/50 focus:border-im-primary focus:outline-none"
              />
              <button
                onClick={addCustomField}
                disabled={!newCustomKey.trim()}
                className="rounded-md bg-im-primary/10 p-1.5 text-im-primary hover:bg-im-primary/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-dash-border">
          <button
            onClick={handleClear}
            className="rounded-md px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
          >
            Clear All
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-dash-border px-3 py-1.5 text-xs text-dash-text-muted hover:bg-dash-surface-hover transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="rounded-md bg-im-primary px-4 py-1.5 text-xs font-medium text-im-primary-fg hover:bg-im-primary/90 transition"
            >
              Apply Metadata
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
