// SPDX-License-Identifier: Apache-2.0
/**
 * LibraryImagePicker — Browse img-man asset library to insert images
 *
 * Modal dialog that lets users search and select images from their
 * img-man library for insertion into the PDF editor canvas.
 *
 * @see Gap G-3 from Sprint 1–8 Audit (task 6.2)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Image as ImageIcon, Loader2, Check } from 'lucide-react';

export interface LibraryAsset {
  _id: string;
  name: string;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
}

export interface LibraryImagePickerProps {
  /** Whether the picker is visible */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Called when user selects an image — passes the signed URL + dimensions */
  onSelect: (asset: LibraryAsset) => void;
  /** The org ID to fetch assets for */
  orgId: string;
}

export function LibraryImagePicker({
  open,
  onClose,
  onSelect,
  orgId,
}: LibraryImagePickerProps) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch image assets from API
  const fetchAssets = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        orgId,
        fileCategory: 'image',
        limit: '50',
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/assets?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAssets(data.assets ?? data ?? []);
    } catch (err) {
      setError('Failed to load library assets.');
      console.error('[LibraryImagePicker]', err);
    } finally {
      setLoading(false);
    }
  }, [orgId, search]);

  // Fetch on open + search changes (debounced)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(fetchAssets, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, fetchAssets, search]);

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId(null);
      setAssets([]);
    }
  }, [open]);

  const handleConfirm = useCallback(() => {
    const asset = assets.find((a) => a._id === selectedId);
    if (asset) {
      onSelect(asset);
      onClose();
    }
  }, [assets, selectedId, onSelect, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-dash-border bg-dash-surface shadow-2xl"
        role="dialog"
        aria-label="Insert image from library"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-dash-text">
            <ImageIcon className="h-4 w-4" />
            Insert from Library
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-dash-border px-5 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface2 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-dash-text-muted" />
            <input
              type="text"
              placeholder="Search images…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-dash-text outline-none placeholder:text-dash-text-muted"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-dash-text-muted" />
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-xs text-red-500">{error}</div>
          )}

          {!loading && !error && assets.length === 0 && (
            <div className="py-8 text-center text-xs text-dash-text-muted">
              No images found in your library.
            </div>
          )}

          {!loading && assets.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {assets.map((asset) => (
                <button
                  key={asset._id}
                  onClick={() => setSelectedId(asset._id)}
                  className={`group relative overflow-hidden rounded-xl border-2 transition ${
                    selectedId === asset._id
                      ? 'border-blue-500 ring-2 ring-blue-500/30'
                      : 'border-dash-border hover:border-dash-text-muted'
                  }`}
                >
                  <div className="aspect-square bg-dash-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.thumbnailUrl || asset.url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
                    <p className="truncate text-[10px] font-medium text-white">
                      {asset.name}
                    </p>
                  </div>
                  {selectedId === asset._id && (
                    <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-dash-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Insert Image
          </button>
        </div>
      </div>
    </div>
  );
}

export default LibraryImagePicker;
