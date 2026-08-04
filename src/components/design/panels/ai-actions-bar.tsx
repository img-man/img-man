// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback } from 'react';
import {
  Wand2,
  Expand,
  Palette,
  Pencil,
  Lock,
  Loader2,
  Coins,
} from 'lucide-react';
import AiBadge from '@/components/ai-badge';
import { DESIGN_RESOURCE_CREDITS } from '@/lib/ai-credit-costs';
import { useAiFeatureAccess } from '@/lib/use-ai-feature-access';
import CreditBadge from '../credit-badge';

interface SelectedImageInfo {
  id: string;
  name: string;
  src: string;
  isPremium?: boolean;
  premiumStatus?: 'watermarked' | 'purchased';
}

interface AiActionsBarProps {
  selectedImage: SelectedImageInfo;
  onActionComplete: (elementId: string, newImageUrl: string) => void;
  onSwitchToEditPanel: () => void;
  creditRefreshKey: number;
  onCreditRefresh: () => void;
}

interface ActionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  credits: number;
  apiPath: string;
  body: (img: SelectedImageInfo) => Record<string, unknown>;
  featureKeys?: readonly string[];
}

const ACTIONS: ActionDef[] = [
  {
    id: 'bg-remove',
    label: 'Remove BG',
    icon: <Wand2 size={10} />,
    credits: DESIGN_RESOURCE_CREDITS.ai_bg_remove_studio,
    apiPath: '/api/ai/bg-remove',
    body: (img) => ({ assetId: img.id, sourceUrl: img.src }),
    featureKeys: ['bg_remove'],
  },
  {
    id: 'expand',
    label: 'Expand',
    icon: <Expand size={10} />,
    credits: DESIGN_RESOURCE_CREDITS.ai_expand_studio,
    apiPath: '/api/ai/expand',
    body: (img) => ({
      assetId: img.id,
      sourceUrl: img.src,
      direction: 'all',
      factor: 1.5,
    }),
    featureKeys: ['expand'],
  },
  {
    id: 'style-transfer',
    label: 'Style',
    icon: <Palette size={10} />,
    credits: DESIGN_RESOURCE_CREDITS.ai_style_transfer,
    apiPath: '/api/ai/generate',
    body: (img) => ({
      sourceAssetId: img.id,
      prompt: 'Apply an artistic style transformation',
      model: 'imagen3-edit',
    }),
    featureKeys: ['edit'],
  },
];

export default function AiActionsBar({
  selectedImage,
  onActionComplete,
  onSwitchToEditPanel,
  creditRefreshKey,
  onCreditRefresh,
}: AiActionsBarProps) {
  const { areFeaturesEnabled } = useAiFeatureAccess();
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPremiumBlocked =
    selectedImage.isPremium && selectedImage.premiumStatus === 'watermarked';
  const aiEditEnabled = areFeaturesEnabled(['edit']);
  const anyAiActionEnabled =
    aiEditEnabled || ACTIONS.some((action) => areFeaturesEnabled(action.featureKeys));

  const handleAction = useCallback(
    async (action: ActionDef) => {
      if (!areFeaturesEnabled(action.featureKeys)) {
        setError('This AI action is disabled in settings.');
        return;
      }

      if (isPremiumBlocked || runningAction) return;
      setRunningAction(action.id);
      setError(null);

      try {
        const res = await fetch(action.apiPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.body(selectedImage)),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 402) {
            throw new Error('Insufficient credits');
          }
          throw new Error(data.error || `Action failed (${res.status})`);
        }

        const data = await res.json();
        const imageUrl =
          data.asset?.thumbnailBase64 ||
          data.asset?.url ||
          data.imageUrl ||
          data.resultUrl;

        if (imageUrl) {
          onActionComplete(selectedImage.id, imageUrl);
          onCreditRefresh();
        } else {
          throw new Error('No image returned');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setRunningAction(null);
      }
    },
    [
      selectedImage,
      areFeaturesEnabled,
      isPremiumBlocked,
      runningAction,
      onActionComplete,
      onCreditRefresh,
    ],
  );

  return (
    <div className="space-y-2 border-t border-dash-border pt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-dash-text-muted">
          <Wand2 size={10} />
          AI Actions
        </p>
        <AiBadge disabled={!anyAiActionEnabled} />
      </div>

      {isPremiumBlocked && (
        <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[10px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <Lock size={10} />
          Purchase to unlock AI
        </div>
      )}

      {!anyAiActionEnabled && (
        <div className="rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          AI actions are disabled in organization settings.
        </div>
      )}

      <div className="grid grid-cols-2 gap-1">
        {ACTIONS.map((action) => {
          const isRunning = runningAction === action.id;
          const actionEnabled = areFeaturesEnabled(action.featureKeys);
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action)}
              disabled={!!isPremiumBlocked || !!runningAction || !actionEnabled}
              className="flex items-center justify-center gap-1 rounded-lg border border-dash-border px-2 py-1.5 text-[10px] font-medium text-dash-text2 transition-colors hover:bg-dash-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRunning ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                action.icon
              )}
              <span>{action.label}</span>
              <span className="ml-auto flex items-center gap-0.5 text-[9px] text-dash-text-muted">
                <Coins size={8} />
                {action.credits}
              </span>
            </button>
          );
        })}

        {/* Edit with AI — opens the full AI Edit panel */}
        <button
          onClick={onSwitchToEditPanel}
          disabled={!!isPremiumBlocked || !aiEditEnabled}
          className="flex items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-[10px] font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
        >
          <Pencil size={10} />
          <span>AI Edit</span>
          <span className="ml-auto flex items-center gap-0.5 text-[9px] opacity-75">
            <Coins size={8} />
            {DESIGN_RESOURCE_CREDITS.ai_edit_with_text}
          </span>
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-2 py-1 text-[10px] text-red-600 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Balance display */}
      <CreditBadge refreshKey={creditRefreshKey} className="justify-center" />
    </div>
  );
}
