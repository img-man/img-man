// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-7.1 — PDF Merge Tool
 * Upload multiple PDFs, reorder them, then merge into a single PDF.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  GripVertical,
  Trash2,
  ArrowUp,
  ArrowDown,
  FilePlus2,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface PdfFile {
  id: string;
  file: File;
  name: string;
  pageCount: number | null;
}

let _idCounter = 0;
function genId() {
  return `pdf-${++_idCounter}-${Date.now()}`;
}

export interface PdfMergeModalProps {
  onClose: () => void;
}

export default function PdfMergeModal({ onClose }: PdfMergeModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('merged.pdf');

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    const newFiles: PdfFile[] = [];
    for (const file of Array.from(fileList)) {
      if (file.type !== 'application/pdf') continue;
      // Try to read page count
      let pageCount: number | null = null;
      try {
        const { PDFDocument } = await import('pdf-lib');
        const bytes = await file.arrayBuffer();
        const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
        pageCount = doc.getPageCount();
      } catch {
        pageCount = null;
      }
      newFiles.push({ id: genId(), file, name: file.name, pageCount });
    }
    setFiles((prev) => [...prev, ...newFiles]);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const moveFile = useCallback((idx: number, dir: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const handleMerge = useCallback(async () => {
    if (files.length < 2) {
      setError('Please add at least 2 PDFs to merge.');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const { PDFDocument } = await import('pdf-lib');
      const merged = await PDFDocument.create();

      for (const pf of files) {
        const bytes = await pf.file.arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        for (const page of pages) {
          merged.addPage(page);
        }
      }

      const pdfBytes = await merged.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      setResultBlob(blob);
      setResultName('merged.pdf');
    } catch (err) {
      setError(
        `Merge failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    } finally {
      setProcessing(false);
    }
  }, [files]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-dash-border bg-dash-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-dash-text">
              PDF Merge
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Combine multiple PDFs into a single document
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Source selection */}
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-24 cursor-pointer transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              data-testid="pdf-merge-drop"
            >
              <div className="flex flex-col items-center gap-1.5 text-dash-text-muted">
                <Upload className="h-5 w-5" />
                <p className="text-xs font-medium">
                  Drop PDFs or click to upload
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
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
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-24 w-36 cursor-pointer transition-colors text-dash-text-muted"
              data-testid="pdf-merge-browse"
            >
              <Library className="h-5 w-5" />
              <span className="text-xs font-medium">Browse Library</span>
            </button>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-1.5" data-testid="pdf-merge-list">
              <p className="text-xs font-medium text-dash-text2">
                {files.length} file{files.length > 1 ? 's' : ''} · Drag to
                reorder
              </p>
              {files.map((pf, idx) => (
                <div
                  key={pf.id}
                  className="flex items-center gap-2.5 rounded-lg border border-dash-border bg-dash-muted/50 px-3 py-2 group"
                  data-testid={`pdf-file-${idx}`}
                >
                  <GripVertical className="h-4 w-4 text-dash-text-muted shrink-0 cursor-grab" />
                  <FilePlus2 className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-dash-text truncate">
                      {pf.name}
                    </p>
                    <p className="text-[10px] text-dash-text-muted">
                      {pf.pageCount !== null
                        ? `${pf.pageCount} page${pf.pageCount > 1 ? 's' : ''}`
                        : 'Reading…'}
                      {' · '}
                      {(pf.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveFile(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover disabled:opacity-30"
                      title="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => moveFile(idx, 1)}
                      disabled={idx === files.length - 1}
                      className="rounded p-1 text-dash-text-muted hover:bg-dash-surface-hover disabled:opacity-30"
                      title="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeFile(pf.id)}
                      className="rounded p-1 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Remove"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500" data-testid="pdf-merge-error">
              {error}
            </p>
          )}

          {/* Merge button */}
          {resultBlob ? (
            <ToolOutputActions
              blob={resultBlob}
              fileName={resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleMerge}
              disabled={files.length < 2 || processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-merge-btn"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Merging…
                </>
              ) : (
                <>
                  <FilePlus2 className="h-4 w-4" />
                  Merge PDFs
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Asset Picker overlay */}
      {showPicker && (
        <AssetPicker
          accept="application/pdf"
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
