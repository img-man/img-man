// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback } from 'react';
import {
  Crown,
  Coins,
  Loader2,
  X,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { DESIGN_RESOURCE_CREDITS } from '@/lib/ai-credit-costs';

export interface PremiumPurchaseTarget {
  premiumImageId: string;
  thumbUrl: string;
  previewUrl: string;
  resolution: 'sd' | 'hd' | 'editorial';
  creditCost: number;
  author: string;
  source: string;
}

export interface PurchaseResult {
  fullImageUrl: string;
  creditsDeducted: number;
  remainingCredits: number;
}

interface PurchaseDialogProps {
  target: PremiumPurchaseTarget | null;
  onClose: () => void;
  onPurchased: (result: PurchaseResult) => void;
}

export default function PurchaseDialog({
  target,
  onClose,
  onPurchased,
}: PurchaseDialogProps) {
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = useCallback(async () => {
    if (!target) return;
    setPurchasing(true);
    setError(null);

    try {
      const res = await fetch('/api/design-resources/premium/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          premiumImageId: target.premiumImageId,
          provider: target.source,
          resolution: target.resolution,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 402) {
          throw new Error(
            `Insufficient credits. Need ${target.creditCost}, have ${data.available ?? 0}.`,
          );
        }
        throw new Error(data.error || `Purchase failed (${res.status})`);
      }

      const data = await res.json();
      onPurchased({
        fullImageUrl: data.fullImageUrl ?? data.cleanUrl,
        creditsDeducted: data.creditsDeducted ?? target.creditCost,
        remainingCredits: data.remainingCredits ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  }, [target, onPurchased]);

  if (!target) return null;

  const resolutionLabel =
    target.resolution === 'editorial'
      ? 'Editorial / Exclusive'
      : target.resolution === 'hd'
        ? 'High Resolution (4K+)'
        : 'Standard Resolution';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-dash-border bg-dash-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
              <Crown size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-dash-text">
                Purchase Premium Image
              </h3>
              <p className="text-[11px] text-dash-text-muted">
                {resolutionLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-dash-text-muted hover:bg-dash-muted transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 pt-4">
          <div className="relative overflow-hidden rounded-xl border border-dash-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={target.previewUrl || target.thumbUrl}
              alt="Premium preview"
              className="aspect-video w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-lg bg-black/40 px-3 py-1 text-sm font-bold text-white/60 uppercase tracking-widest rotate-[-20deg]">
                Preview
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-[10px] text-dash-text-muted">
            By {target.author} • {target.source}
          </p>
        </div>

        {/* Cost breakdown */}
        <div className="mx-5 mt-4 rounded-xl border border-dash-border bg-dash-muted/50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-dash-text-muted">Image cost</span>
            <span className="flex items-center gap-1 text-xs font-semibold text-dash-text">
              <Coins size={12} className="text-amber-500" />
              {target.creditCost} credits
            </span>
          </div>
          <div className="mt-2 border-t border-dash-border pt-2">
            <p className="text-[10px] text-dash-text-muted">
              Credits will be deducted from your organization balance. The
              unwatermarked image will replace the preview on your canvas.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/30">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-[11px] text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 px-5 py-4">
          <button
            onClick={onClose}
            disabled={purchasing}
            className="flex-1 rounded-xl border border-dash-border px-4 py-2.5 text-xs font-medium text-dash-text2 hover:bg-dash-muted transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handlePurchase}
            disabled={purchasing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-60"
          >
            {purchasing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Purchasing…
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                Purchase ({target.creditCost} cr)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
