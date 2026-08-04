// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * Password Protect Tool
 * Upload a PDF, set user/owner passwords, download encrypted PDF.
 * Uses a server-side API route for encryption.
 */

import { useState, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Library,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { ToolOutputActions } from '@/components/dashboard/ToolOutputActions';

const AssetPicker = dynamic(
  () => import('@/components/dashboard/asset-picker'),
  { ssr: false },
);

interface ProtectState {
  file: File | null;
  fileName: string;
  userPassword: string;
  ownerPassword: string;
  showUserPwd: boolean;
  showOwnerPwd: boolean;
  processing: boolean;
  error: string | null;
  resultBlob: Blob | null;
  resultName: string;
}

export default function PdfProtectModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [state, setState] = useState<ProtectState>({
    file: null,
    fileName: '',
    userPassword: '',
    ownerPassword: '',
    showUserPwd: false,
    showOwnerPwd: false,
    processing: false,
    error: null,
    resultBlob: null,
    resultName: '',
  });

  const loadFile = useCallback((file: File) => {
    if (file.type !== 'application/pdf') return;
    setState((s) => ({ ...s, file, fileName: file.name, error: null }));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const handleProtect = useCallback(async () => {
    if (!state.file || !state.userPassword) return;
    setState((s) => ({ ...s, processing: true, error: null }));
    try {
      const formData = new FormData();
      formData.append('file', state.file);
      formData.append('userPassword', state.userPassword);
      if (state.ownerPassword)
        formData.append('ownerPassword', state.ownerPassword);

      const res = await fetch('/api/tools/pdf-protect', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: 'Encryption failed' }));
        throw new Error(data.error || 'Encryption failed');
      }
      const blob = await res.blob();
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      setState((s) => ({
        ...s,
        resultBlob: blob,
        resultName: `${baseName}_protected.pdf`,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : 'Encryption failed',
      }));
    } finally {
      setState((s) => ({ ...s, processing: false }));
    }
  }, [state]);

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
              Password Protect
            </h2>
            <p className="text-xs text-dash-text-muted mt-0.5">
              Encrypt a PDF with a password so it requires authentication to
              open
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
                data-testid="pdf-protect-drop"
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
                    if (f) loadFile(f);
                    e.target.value = '';
                  }}
                />
              </div>
              <button
                onClick={() => setShowPicker(true)}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-dash-border bg-dash-muted hover:border-[var(--im-primary)]/60 hover:bg-[var(--im-primary-light)] h-28 w-36 cursor-pointer transition-colors text-dash-text-muted"
                data-testid="pdf-protect-browse"
              >
                <Library className="h-5 w-5" />
                <span className="text-xs font-medium">Browse Library</span>
              </button>
            </div>
          ) : (
            <>
              {/* File info */}
              <div className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-muted/50 px-4 py-3">
                <Lock className="h-5 w-5 text-rose-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-dash-text truncate">
                    {state.fileName}
                  </p>
                  <p className="text-xs text-dash-text-muted">
                    {(state.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      file: null,
                      fileName: '',
                      error: null,
                    }))
                  }
                  className="rounded-lg p-1.5 text-dash-text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* User password */}
              <div>
                <label className="block text-xs font-medium text-dash-text2 mb-1">
                  Password to open <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={state.showUserPwd ? 'text' : 'password'}
                    value={state.userPassword}
                    onChange={(e) =>
                      setState((s) => ({ ...s, userPassword: e.target.value }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-10 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                    placeholder="Enter password"
                    data-testid="pdf-protect-user-pwd"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, showUserPwd: !s.showUserPwd }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dash-text-muted hover:text-dash-text"
                  >
                    {state.showUserPwd ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Owner password (optional) */}
              <div>
                <label className="block text-xs font-medium text-dash-text2 mb-1">
                  Owner password{' '}
                  <span className="text-dash-text-muted">(optional)</span>
                </label>
                <div className="relative">
                  <input
                    type={state.showOwnerPwd ? 'text' : 'password'}
                    value={state.ownerPassword}
                    onChange={(e) =>
                      setState((s) => ({ ...s, ownerPassword: e.target.value }))
                    }
                    className="w-full rounded-lg border border-dash-border bg-dash-muted px-3 py-2 pr-10 text-sm text-dash-text outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
                    placeholder="Same as user password if empty"
                    data-testid="pdf-protect-owner-pwd"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setState((s) => ({ ...s, showOwnerPwd: !s.showOwnerPwd }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dash-text-muted hover:text-dash-text"
                  >
                    {state.showOwnerPwd ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-dash-text-muted">
                  The owner password controls editing permissions. If left
                  empty, the user password is used for both.
                </p>
              </div>
            </>
          )}

          {state.error && (
            <p className="text-xs text-red-500" data-testid="pdf-protect-error">
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
              onClick={handleProtect}
              disabled={!state.file || !state.userPassword || state.processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--im-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--im-primary-fg)] shadow-sm transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="pdf-protect-btn"
            >
              {state.processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Encrypting…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Protect PDF
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
            if (files[0]) loadFile(files[0]);
          }}
        />
      )}
    </div>
  );
}
