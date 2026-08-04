// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback } from 'react';
import { Pencil, Loader2, Coins, Lock } from 'lucide-react';
import AiBadge from '@/components/ai-badge';
import { DESIGN_RESOURCE_CREDITS } from '@/lib/ai-credit-costs';
import { EDIT_MODEL } from '@/lib/ai-models';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';
import CreditBadge from '../credit-badge';

interface SelectedImageInfo {
  id: string;
  name: string;
  src: string;
  isPremium?: boolean;
  premiumStatus?: 'watermarked' | 'purchased';
}

interface AiEditPanelProps {
  selectedImage: SelectedImageInfo | null;
  onImageEdited: (elementId: string, newImageUrl: string) => void;
  creditRefreshKey: number;
  onCreditRefresh: () => void;
}

export default function AiEditPanel({
  selectedImage,
  onImageEdited,
  creditRefreshKey,
  onCreditRefresh,
}: AiEditPanelProps) {
  const { isFeatureEnabled } = useAiFeatureAccess();
  const [instruction, setInstruction] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const creditCost =
    EDIT_MODEL?.credits ?? DESIGN_RESOURCE_CREDITS.ai_edit_with_text;
  const isPremiumBlocked =
    selectedImage?.isPremium && selectedImage?.premiumStatus === 'watermarked';
  const editEnabled = isFeatureEnabled('edit');

  const handleEdit = useCallback(async () => {
    if (!editEnabled || !selectedImage || !instruction.trim() || isPremiumBlocked) {
      return;
    }
    setEditing(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: instruction.trim(),
          sourceAssetId: selectedImage.id,
          model: EDIT_MODEL?.id ?? 'imagen3-edit',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Edit failed (${res.status})`);
      }

      const data = await res.json();
      const imageUrl =
        data.asset?.thumbnailBase64 || data.asset?.url || data.imageUrl;
      if (imageUrl) {
        onImageEdited(selectedImage.id, imageUrl);
        onCreditRefresh();
      } else {
        throw new Error('No image returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setEditing(false);
    }
  }, [
    selectedImage,
    instruction,
    editEnabled,
    isPremiumBlocked,
    onImageEdited,
    onCreditRefresh,
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dash-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Pencil size={14} className="text-blue-400" />
            <span className="text-[11px] font-semibold text-dash-text">
              Edit with AI
            </span>
          </div>
          <AiBadge disabled={!editEnabled} />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {!editEnabled && (
          <div className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
            AI editing is disabled in organization settings.
          </div>
        )}

        {!selectedImage ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="rounded-full bg-dash-muted p-3">
              <Pencil size={20} className="text-dash-text-muted" />
            </div>
            <p className="text-[11px] text-dash-text-muted">
              Select an image element on the canvas to edit it with AI
            </p>
          </div>
        ) : (
          <>
            {/* Selected image preview */}
            <div className="rounded-lg border border-dash-border p-2">
              <p className="mb-1.5 text-[10px] font-medium text-dash-text-muted">
                Selected Image
              </p>
              <div className="relative overflow-hidden rounded-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedImage.src}
                  alt={selectedImage.name}
                  className="h-24 w-full object-cover"
                />
                {isPremiumBlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1">
                      <Lock size={10} className="text-white" />
                      <span className="text-[9px] font-bold text-white">
                        Purchase to unlock AI
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-1 truncate text-[10px] text-dash-text2">
                {selectedImage.name}
              </p>
            </div>

            {/* Premium blocked message */}
            {isPremiumBlocked && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
                This is a watermarked premium image. Purchase it first to use AI
                editing features.
              </div>
            )}

            {/* Edit instruction */}
            <div>
              <label className="mb-1 block text-[10px] font-medium text-dash-text-muted">
                Edit Instruction
              </label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Make the sky a golden sunset color..."
                rows={3}
                maxLength={2000}
                disabled={isPremiumBlocked || !editEnabled}
                className="w-full resize-none rounded-lg border border-dash-border bg-dash-muted px-2.5 py-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-blue-400 focus:outline-none disabled:opacity-50"
              />
            </div>

            {/* Cost display */}
            <div className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-muted/50 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Coins size={12} className="text-amber-400" />
                <span className="text-[10px] text-dash-text-muted">Cost:</span>
                <span className="text-[11px] font-semibold text-amber-400">
                  {creditCost} credits
                </span>
              </div>
              <CreditBadge refreshKey={creditRefreshKey} />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[10px] text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Edit button */}
            <button
              onClick={handleEdit}
              disabled={editing || !instruction.trim() || isPremiumBlocked || !editEnabled}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Pencil size={14} />
                  Apply Edit
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
