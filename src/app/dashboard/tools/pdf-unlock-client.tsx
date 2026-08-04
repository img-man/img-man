// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * PDF Unlock Tool
 * Upload an encrypted PDF, provide password, and save without encryption.
 * Entirely client-side via pdf-lib.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  ShieldOff,
  Library,
  Eye,
  EyeOff,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface UnlockState {
  file: File | null;
  fileBytes: ArrayBuffer | null;
  fileName: string;
  totalPages: number;
  fileSize: number;
  password: string;
  showPwd: boolean;
  needsPassword: boolean;
  processing: boolean;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfUnlockModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<UnlockState>({
    file: null,
    fileBytes: null,
    fileName: '',
    totalPages: 0,
    fileSize: 0,
    password: '',
    showPwd: false,
    needsPassword: false,
    processing: false,
    error: null,
    resultBlob: null,
    resultName: '',
  });

  const loadPdf = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') return;
    const bytes = await file.arrayBuffer();
    try {
      // Try to load without password first
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(bytes);
      setState((s) => ({
        ...s,
        file,
        fileBytes: bytes,
        fileName: file.name,
        fileSize: file.size,
        totalPages: doc.getPageCount(),
        needsPassword: false,
        error: null,
      }));
    } catch {
      // Loading failed — likely encrypted, needs password
      setState((s) => ({
        ...s,
        file,
        fileBytes: bytes,
        fileName: file.name,
        fileSize: file.size,
        needsPassword: true,
        totalPages: 0,
        error: null,
      }));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadPdf(file);
    },
    [loadPdf],
  );

  const handleUnlock = useCallback(async () => {
    if (!state.fileBytes) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const { PDFDocument } = await import('pdf-lib');
      let doc;
      if (state.needsPassword && state.password) {
        try {
          doc = await PDFDocument.load(state.fileBytes, {
            password: state.password,
          } as never);
        } catch {
          // Fallback: try ignoreEncryption to strip restrictions
          try {
            doc = await PDFDocument.load(state.fileBytes, {
              ignoreEncryption: true,
            });
          } catch (e2) {
            throw new Error(
              `Wrong password or unsupported encryption. ${e2 instanceof Error ? e2.message : ''}`,
            );
          }
        }
      } else {
        doc = await PDFDocument.load(state.fileBytes, {
          ignoreEncryption: true,
        });
      }
      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_unlocked.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: `Unlock failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
              Unlock PDF
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Remove password protection and restrictions from a PDF
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
          {!state.file ? (
            <div className="flex gap-2">
              <div
                className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                data-testid="pdf-unlock-drop"
              >
                <div className="flex flex-col items-center gap-1.5 text-dash-text-muted">
                  <Upload className="h-5 w-5" />
                  <p className="text-xs font-medium">
                    Drop a PDF or click to upload
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) loadPdf(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 w-36 cursor-pointer transition-colors text-dash-text-muted"
                data-testid="pdf-unlock-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <ShieldOff className="h-5 w-5 text-orange-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">
                    {state.fileName}
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    {state.totalPages > 0
                      ? `${state.totalPages} page${state.totalPages > 1 ? 's' : ''} · `
                      : ''}
                    {formatSize(state.fileSize)}
                    {state.needsPassword && (
                      <span className="ml-1.5 text-orange-500 font-medium">
                        · Password protected
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      file: null,
                      fileBytes: null,
                      fileName: '',
                      totalPages: 0,
                      fileSize: 0,
                      password: '',
                      needsPassword: false,
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Password field — shown when file appears encrypted */}
              {state.needsPassword && (
                <div>
                  <label className="block text-xs font-medium text-dash-text2 mb-1">
                    PDF Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={state.showPwd ? 'text' : 'password'}
                      value={state.password}
                      onChange={(e) =>
                        setState((s) => ({ ...s, password: e.target.value }))
                      }
                      className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-10 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                      placeholder="Enter the password to unlock this PDF"
                      data-testid="pdf-unlock-password"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setState((s) => ({ ...s, showPwd: !s.showPwd }))
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dash-text-muted hover:text-dash-text"
                    >
                      {state.showPwd ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-dash-text-muted">
                    Enter the existing password used to protect this PDF.
                  </p>
                </div>
              )}

              {/* Info banner */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  {state.needsPassword
                    ? 'Provide the correct password to remove encryption and download an unlocked copy.'
                    : 'This PDF does not appear to be password protected. You can still re-save it to strip any restrictions.'}
                </p>
              </div>
            </>
          )}

          {state.error && (
            <p className="text-xs text-red-500" data-testid="pdf-unlock-error">
              {state.error}
            </p>
          )}

          {state.resultBlob ? (
            <ToolOutputActions
              blob={state.resultBlob}
              fileName={state.resultName}
              mimeType="application/pdf"
            />
          ) : (
            <button
              onClick={handleUnlock}
              disabled={
                !state.file ||
                (state.needsPassword && !state.password) ||
                state.processing
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-unlock-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Unlocking…
                </>
              ) : (
                <>
                  <ShieldOff className="h-4 w-4" />
                  Unlock PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {showPicker && (
        <AssetPicker
          accept="application/pdf"
          multiple={false}
          onClose={() => setShowPicker(false)}
          onSelect={(files) => {
            setShowPicker(false);
            if (files[0]) loadPdf(files[0]);
          }}
        />
      )}
    </div>
  );
}
