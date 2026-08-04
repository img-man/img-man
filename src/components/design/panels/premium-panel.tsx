// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, Crown, Lock } from 'lucide-react';
import { DESIGN_RESOURCE_CREDITS } from '@/lib/ai-credit-costs';
import CreditBadge from '../credit-badge';

export interface PremiumPhoto {
  id: string;
  thumbUrl: string; // watermarked thumbnail
  previewUrl: string; // watermarked preview (larger)
  width: number;
  height: number;
  author: string;
  source: string;
  creditCost: number;
  resolution: 'sd' | 'hd' | 'editorial';
}

interface PremiumPanelProps {
  onPurchaseAndAdd: (photo: PremiumPhoto) => void;
  creditRefreshKey: number;
}

export default function PremiumPanel({
  onPurchaseAndAdd,
  creditRefreshKey,
}: PremiumPanelProps) {
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<PremiumPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [purchaseTarget, setPurchaseTarget] = useState<PremiumPhoto | null>(
    null,
  );
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchPhotos = useCallback(
    async (q: string, p: number, append = false) => {
      if (!q.trim()) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/design-resources/premium?q=${encodeURIComponent(q.trim())}&page=${p}&per_page=20`,
        );
        if (res.ok) {
          const data = await res.json();
          const newPhotos: PremiumPhoto[] = data.photos ?? [];
          setPhotos((prev) => (append ? [...prev, ...newPhotos] : newPhotos));
          setHasMore(newPhotos.length >= 20);
          setSearched(true);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setPage(1);
        fetchPhotos(q, 1);
      }, 400);
    },
    [fetchPhotos],
  );

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (
        el.scrollTop + el.clientHeight >= el.scrollHeight - 100 &&
        hasMore &&
        !loading
      ) {
        const next = page + 1;
        setPage(next);
        fetchPhotos(query, next, true);
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, loading, page, query, fetchPhotos]);

  const getCreditCost = (resolution: string) => {
    switch (resolution) {
      case 'hd':
        return DESIGN_RESOURCE_CREDITS.premium_image_hd;
      case 'editorial':
        return DESIGN_RESOURCE_CREDITS.premium_image_editorial;
      default:
        return DESIGN_RESOURCE_CREDITS.premium_image_sd;
    }
  };

  const handlePurchaseConfirm = useCallback(async () => {
    if (!purchaseTarget) return;
    setPurchasing(true);
    setPurchaseError(null);

    try {
      const res = await fetch('/api/design-resources/premium/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premiumImageId: purchaseTarget.id,
          provider: purchaseTarget.source,
          resolution: purchaseTarget.resolution,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Purchase failed (${res.status})`);
      }

      // Add the watermarked image first (will be replaced after purchase)
      onPurchaseAndAdd(purchaseTarget);
      setPurchaseTarget(null);
    } catch (err) {
      setPurchaseError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  }, [purchaseTarget, onPurchaseAndAdd]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-dash-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Crown size={14} className="text-amber-400" />
          <span className="text-[11px] font-semibold text-dash-text">
            Premium Images
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-dash-border p-2">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-dash-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search premium photos..."
            className="w-full rounded-lg border border-dash-border bg-dash-muted py-1.5 pl-7 pr-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-amber-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Results */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
        {!searched && !loading && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Crown size={24} className="text-amber-400/50" />
            <p className="text-[10px] text-dash-text-muted">
              Search for premium stock photos.
              <br />
              Credits will be deducted on purchase.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setPurchaseTarget(photo)}
              title={`${photo.author} • ${getCreditCost(photo.resolution)} credits`}
              className="group relative overflow-hidden rounded-lg border border-dash-border transition-all hover:border-amber-400 hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt="Premium"
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              {/* Watermark overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rotate-[-30deg] text-[16px] font-bold text-white/30 select-none">
                  PREVIEW
                </div>
              </div>
              {/* Price badge */}
              <div className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-amber-500/90 px-1.5 py-0.5">
                <Crown size={8} className="text-white" />
                <span className="text-[8px] font-bold text-white">
                  {getCreditCost(photo.resolution)} cr
                </span>
              </div>
              {/* Author */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-[8px] text-white/80">
                  {photo.author}
                </p>
              </div>
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-amber-400" />
          </div>
        )}

        {searched && photos.length === 0 && !loading && (
          <p className="py-6 text-center text-[10px] text-dash-text-muted">
            No premium photos found.
          </p>
        )}
      </div>

      {/* Purchase Confirmation Dialog */}
      {purchaseTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xs rounded-xl border border-dash-border bg-dash-surface p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={16} className="text-amber-400" />
              <h3 className="text-sm font-semibold text-dash-text">
                Purchase Premium Image
              </h3>
            </div>

            {/* Preview */}
            <div className="relative mb-3 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={purchaseTarget.previewUrl || purchaseTarget.thumbUrl}
                alt="Preview"
                className="h-32 w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rotate-[-30deg] text-xl font-bold text-white/25 select-none">
                  PREVIEW
                </div>
              </div>
            </div>

            {/* Cost info */}
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-amber-700 dark:text-amber-400">
                  Cost
                </span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {getCreditCost(purchaseTarget.resolution)} credits
                </span>
              </div>
              <p className="mt-1 text-[9px] text-amber-600/80 dark:text-amber-500/80">
                Will be added to your next bill. The image will first appear
                with a watermark, then unlock to full quality once purchased.
              </p>
            </div>

            <CreditBadge refreshKey={creditRefreshKey} className="mb-3" />

            {purchaseError && (
              <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[10px] text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                {purchaseError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPurchaseTarget(null);
                  setPurchaseError(null);
                }}
                className="flex-1 rounded-lg border border-dash-border px-3 py-2 text-xs font-medium text-dash-text2 hover:bg-dash-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePurchaseConfirm}
                disabled={purchasing}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {purchasing ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Lock size={12} />
                )}
                {purchasing ? 'Processing...' : 'Accept & Use'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
