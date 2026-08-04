// SPDX-License-Identifier: Apache-2.0
'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Cloud, AlertCircle, FileWarning } from 'lucide-react';
import { useEmbedScope } from '@/app/embed/dashboard/embed-scope-context';
import { getFileTypeInfo } from '@/lib/file-types';
import {
  summarizeUploadSelection,
  uploadAssetFile,
} from '@/lib/upload-helpers';

/* ─── Types ─────────────────────────────────────────────── */

interface UploadFileStatus {
  name: string;
  mimeType: string;
  progress: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

interface UploadButtonProps {
  folderId?: string | null;
  onUploadComplete?: () => void;
}

/* ─── Component ─────────────────────────────────────────── */

export function UploadButton({
  folderId,
  onUploadComplete,
}: UploadButtonProps) {
  const { isEmbed } = useEmbedScope();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<UploadFileStatus[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [bucketReady, setBucketReady] = useState<boolean | null>(null);
  const [showProvisionPrompt, setShowProvisionPrompt] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  // Check if bucket is provisioned
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        const bucket = data.settings?.storageConfig?.bucket;
        setBucketReady(!!bucket);
      })
      .catch(() => setBucketReady(true));
  }, []);

  const handleProvision = useCallback(async () => {
    setProvisioning(true);
    try {
      const res = await fetch('/api/settings/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto' }),
      });
      if (res.ok) {
        setBucketReady(true);
        setShowProvisionPrompt(false);
      }
    } catch {
      // ignore
    } finally {
      setProvisioning(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (bucketReady === false) {
      setShowProvisionPrompt(true);
      return;
    }
    inputRef.current?.click();
  }, [bucketReady]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (uploading) return; // Guard against double invocation

      // Reset file input value so the same file can be re-selected later
      if (inputRef.current) inputRef.current.value = '';

      // Validate all files first
      const { validFiles, errors } = summarizeUploadSelection(Array.from(files));
      setValidationErrors(errors);

      if (validFiles.length === 0) return;

      setUploading(true);
      setFileStatuses(
        validFiles.map((f) => ({
          name: f.name,
          mimeType: f.type || 'application/octet-stream',
          progress: 'pending',
        })),
      );

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const mimeType = file.type || 'application/octet-stream';
        setFileStatuses((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, progress: 'uploading' } : s,
          ),
        );

        try {
          await uploadAssetFile(file, {
            folderId,
            preferServerUpload: isEmbed,
          });

          setFileStatuses((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, progress: 'done' } : s)),
          );
        } catch (err) {
          console.error('Upload failed for', file.name, err);
          setFileStatuses((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? {
                    ...s,
                    progress: 'error',
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : s,
            ),
          );
        }
      }

      setUploading(false);
      // Clear statuses after a short delay
      setTimeout(() => {
        setFileStatuses([]);
        setValidationErrors([]);
      }, 3000);
      onUploadComplete?.();
    },
    [folderId, isEmbed, onUploadComplete, uploading],
  );

  const doneCount = fileStatuses.filter((s) => s.progress === 'done').length;
  const totalCount = fileStatuses.length;
  const progressPercent =
    totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Validation errors toast */}
      {validationErrors.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm space-y-2">
          {validationErrors.map((err, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 shadow-lg dark:border-red-700 dark:bg-red-950"
            >
              <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <span className="text-xs text-red-700 dark:text-red-300">
                {err}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress indicator */}
      {uploading && fileStatuses.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-dash-border bg-dash-surface p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-dash-text">
            <span>
              Uploading {doneCount}/{totalCount} files
            </span>
            <span className="text-xs text-dash-text-muted">
              {progressPercent}%
            </span>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-dash-muted">
            <div
              className="h-full rounded-full bg-[var(--im-primary)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="max-h-32 space-y-1.5 overflow-y-auto">
            {fileStatuses.map((s, i) => {
              const ft = getFileTypeInfo(s.mimeType);
              const FtIcon = ft?.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-dash-text2"
                >
                  {FtIcon ? (
                    <FtIcon
                      className={`h-3.5 w-3.5 shrink-0 ${ft?.color ?? ''}`}
                    />
                  ) : (
                    <div className="h-3.5 w-3.5 shrink-0 rounded-sm bg-dash-muted" />
                  )}
                  <span className="flex-1 truncate">{s.name}</span>
                  {s.progress === 'uploading' && (
                    <div className="h-3 w-3 animate-spin rounded-full border border-transparent border-t-[var(--im-primary)]" />
                  )}
                  {s.progress === 'done' && (
                    <span className="text-emerald-500">✓</span>
                  )}
                  {s.progress === 'error' && (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bucket not provisioned — inline banner */}
      {bucketReady === false && !showProvisionPrompt && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 dark:border-amber-600 dark:bg-amber-900/30">
          <Cloud className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            Storage space is not created yet.
          </span>
          <button
            onClick={() => setShowProvisionPrompt(true)}
            className="ml-auto whitespace-nowrap rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-amber-700"
          >
            Set up storage
          </button>
        </div>
      )}

      {/* Provision consent modal */}
      {showProvisionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-xl border border-dash-border bg-dash-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                <Cloud className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-dash-text">
                Create Storage Space
              </h3>
            </div>
            <p className="mb-6 text-sm text-dash-text2 dark:text-dash-text-muted">
              Your organization needs a storage bucket before you can upload
              files. Click the button below to automatically provision a
              dedicated cloud storage space for your team.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowProvisionPrompt(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-dash-text2 transition hover:bg-dash-surface-hover dark:text-dash-text-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleProvision}
                disabled={provisioning}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {provisioning ? 'Creating…' : 'Create Storage Bucket'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={uploading || bucketReady === null}
        className="rounded-full bg-[var(--im-primary)] px-5 py-2 text-sm font-semibold text-[var(--im-primary-fg)] transition hover:bg-[var(--im-primary)]/90 disabled:opacity-50"
      >
        {bucketReady === null
          ? 'Checking…'
          : uploading
            ? `Uploading… ${progressPercent}%`
            : 'Upload'}
      </button>
    </>
  );
}
