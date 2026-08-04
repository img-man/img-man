// SPDX-License-Identifier: Apache-2.0
/**
 * StatusBar Component
 *
 * Bottom bar showing page info, file size, zoom level, and save status.
 */

'use client';

import { FileText, Save, CheckCircle } from 'lucide-react';

interface StatusBarProps {
  currentPage: number;
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
  fileSize: number;
  fileName: string;
  isDirty: boolean;
  lastSaved: Date | null;
  zoomLabel: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function StatusBar({
  currentPage,
  totalPages,
  pageWidth,
  pageHeight,
  fileSize,
  fileName,
  isDirty,
  lastSaved,
  zoomLabel,
}: StatusBarProps) {
  return (
    <div className="flex h-7 items-center justify-between border-t border-dash-border bg-dash-surface px-3 text-[11px] text-dash-text-muted select-none shrink-0">
      {/* Left side: page info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3" />
          <span>
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <span className="text-dash-border">|</span>

        <span>
          {Math.round(pageWidth)} × {Math.round(pageHeight)} pt
        </span>

        <span className="text-dash-border">|</span>

        <span>{formatBytes(fileSize)}</span>
      </div>

      {/* Center: file name */}
      <div className="flex-1 text-center truncate px-4 max-w-xs">
        <span className="opacity-60">{fileName}</span>
      </div>

      {/* Right side: zoom + save status */}
      <div className="flex items-center gap-3">
        <span className="font-mono">{zoomLabel}</span>

        <span className="text-dash-border">|</span>

        {isDirty ? (
          <span className="flex items-center gap-1 text-amber-500">
            <Save className="h-3 w-3" />
            Unsaved
          </span>
        ) : lastSaved ? (
          <span className="flex items-center gap-1 text-emerald-500">
            <CheckCircle className="h-3 w-3" />
            Saved
          </span>
        ) : (
          <span className="opacity-40">—</span>
        )}
      </div>
    </div>
  );
}
