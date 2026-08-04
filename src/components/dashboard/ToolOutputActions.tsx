// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * ToolOutputActions.tsx
 *
 * Shared dual-action buttons for all PDF/image tool outputs.
 * Provides: Download | Save to Library
 */

import { useState, useCallback } from 'react';
import { Download, Library, Loader2, CheckCircle2 } from 'lucide-react';
import { saveToLibrary } from '@/lib/save-to-library';

export interface ToolOutputActionsProps {
  /** The output blob to download / save */
  blob: Blob;
  /** File name for the download / asset */
  fileName: string;
  /** MIME type */
  mimeType: string;
  /** Optional folder ID for library save */
  folderId?: string;
  /** Variant: 'row' for inline, 'stack' for vertical */
  layout?: 'row' | 'stack';
}

export function ToolOutputActions({
  blob,
  fileName,
  mimeType,
  folderId,
  layout = 'row',
}: ToolOutputActionsProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(() => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [blob, fileName]);

  const handleSaveToLibrary = useCallback(async () => {
    setSaving(true);
    setError(null);
    const result = await saveToLibrary({ blob, fileName, mimeType, folderId });
    setSaving(false);
    if (result.success) {
      setSaved(true);
    } else {
      setError(result.error ?? 'Save failed');
    }
  }, [blob, fileName, mimeType, folderId]);

  const isStack = layout === 'stack';

  return (
    <div className={`flex ${isStack ? 'flex-col' : 'flex-row'} gap-2 w-full`}>
      {/* Download button */}
      <button
        onClick={handleDownload}
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition
          bg-[var(--im-primary)] text-[var(--im-primary-fg)] hover:opacity-90
          ${isStack ? 'w-full' : 'flex-1'}`}
      >
        <Download className="h-4 w-4" />
        Download
      </button>

      {/* Save to Library button */}
      <button
        onClick={handleSaveToLibrary}
        disabled={saving || saved}
        className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition
          border border-dash-border bg-dash-surface text-dash-text hover:bg-dash-surface-hover
          disabled:opacity-60 disabled:cursor-not-allowed
          ${isStack ? 'w-full' : 'flex-1'}`}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Saved to Library
          </>
        ) : (
          <>
            <Library className="h-4 w-4" />
            Save to Library
          </>
        )}
      </button>

      {error && (
        <p className={`text-xs text-red-500 ${isStack ? '' : 'self-center'}`}>
          {error}
        </p>
      )}
    </div>
  );
}
