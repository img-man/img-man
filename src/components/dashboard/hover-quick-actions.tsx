// SPDX-License-Identifier: Apache-2.0
'use client';

/**
 * DS-6.2 — Hover Quick Actions
 *
 * Semi-transparent overlay that appears at the bottom of an asset thumbnail
 * on hover. Shows action buttons: download, edit, share, star, delete.
 */

import { useCallback, useState } from 'react';
import {
  Download,
  Pencil,
  Link2,
  Star,
  Trash2,
  Loader2,
} from 'lucide-react';

export interface HoverQuickActionsProps {
  assetId: string;
  assetUrl?: string;
  assetName: string;
  isStarred: boolean;
  onEdit?: (assetId: string) => void;
  onShare?: (assetId: string) => void;
  onDelete?: (assetId: string) => void;
  onStarToggle?: (assetId: string, newState: boolean) => void;
}

export function HoverQuickActions({
  assetId,
  assetUrl,
  assetName,
  isStarred,
  onEdit,
  onShare,
  onDelete,
  onStarToggle,
}: HoverQuickActionsProps) {
  const [starring, setStarring] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!assetUrl) return;
    setDownloading(true);
    try {
      const res = await fetch(assetUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = assetName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  }, [assetUrl, assetName]);

  const handleStar = useCallback(async () => {
    setStarring(true);
    try {
      const res = await fetch('/api/assets/star', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId }),
      });
      if (res.ok) {
        const data = await res.json();
        const result = data.results?.[0];
        if (result) {
          onStarToggle?.(assetId, result.starred);
        }
      }
    } catch (err) {
      console.error('Star toggle failed:', err);
    } finally {
      setStarring(false);
    }
  }, [assetId, onStarToggle]);

  const btnClass =
    'flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-white/30 focus:outline-none focus:ring-1 focus:ring-white/50';

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2 py-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      data-testid="hover-quick-actions"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Download */}
      <button
        onClick={handleDownload}
        disabled={downloading || !assetUrl}
        title="Download"
        className={btnClass}
        data-testid="action-download"
      >
        {downloading ? (
          <Loader2 size={14} className="animate-spin text-white" />
        ) : (
          <Download size={14} className="text-white" />
        )}
      </button>

      {/* Edit */}
      <button
        onClick={() => onEdit?.(assetId)}
        title="Edit"
        className={btnClass}
        data-testid="action-edit"
      >
        <Pencil size={14} className="text-white" />
      </button>

      {/* Share */}
      <button
        onClick={() => onShare?.(assetId)}
        title="Share link"
        className={btnClass}
        data-testid="action-share"
      >
        <Link2 size={14} className="text-white" />
      </button>

      {/* Star / Favorite */}
      <button
        onClick={handleStar}
        disabled={starring}
        title={isStarred ? 'Unstar' : 'Star'}
        className={btnClass}
        data-testid="action-star"
      >
        {starring ? (
          <Loader2 size={14} className="animate-spin text-white" />
        ) : (
          <Star
            size={14}
            className={
              isStarred
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-white'
            }
          />
        )}
      </button>

      {/* Delete */}
      <button
        onClick={() => onDelete?.(assetId)}
        title="Delete"
        className={`${btnClass} hover:bg-red-500/40`}
        data-testid="action-delete"
      >
        <Trash2 size={14} className="text-white" />
      </button>
    </div>
  );
}

export default HoverQuickActions;
