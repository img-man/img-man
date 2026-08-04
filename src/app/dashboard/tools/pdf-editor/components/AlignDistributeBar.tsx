// SPDX-License-Identifier: Apache-2.0
/**
 * AlignDistributeBar Component — Phase 3, Week 11
 *
 * Toolbar section for alignment and distribution tools.
 * Works on selected annotations within the current page.
 */

'use client';

import {
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Group,
  Ungroup,
  Copy,
  Clipboard,
} from 'lucide-react';
import type { AlignDirection, DistributeDirection } from '../types';

/* ──────────────────────── Props ──────────────────────── */

interface AlignDistributeBarProps {
  /** Number of currently selected annotations */
  selectionCount: number;
  /** Whether there's content in the clipboard */
  hasClipboard: boolean;
  onAlign: (direction: AlignDirection) => void;
  onDistribute: (direction: DistributeDirection) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onCopy: () => void;
  onPaste: () => void;
}

/* ──────────────────────── Component ──────────────────────── */

export default function AlignDistributeBar({
  selectionCount,
  hasClipboard,
  onAlign,
  onDistribute,
  onGroup,
  onUngroup,
  onCopy,
  onPaste,
}: AlignDistributeBarProps) {
  const hasSelection = selectionCount > 0;
  const hasMultiple = selectionCount > 1;
  const hasThreeOrMore = selectionCount >= 3;

  const iconSize = 'h-3.5 w-3.5';

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-dash-border bg-dash-surface">
      {/* ─── Alignment ─── */}
      <span className="text-[9px] text-dash-text-muted mr-1 uppercase tracking-wider">
        Align
      </span>

      <AlignButton
        icon={<AlignHorizontalJustifyStart className={iconSize} />}
        label="Align Left"
        disabled={!hasSelection}
        onClick={() => onAlign('left')}
      />
      <AlignButton
        icon={<AlignHorizontalJustifyCenter className={iconSize} />}
        label="Align Center"
        disabled={!hasSelection}
        onClick={() => onAlign('center')}
      />
      <AlignButton
        icon={<AlignHorizontalJustifyEnd className={iconSize} />}
        label="Align Right"
        disabled={!hasSelection}
        onClick={() => onAlign('right')}
      />
      <AlignButton
        icon={<AlignVerticalJustifyStart className={iconSize} />}
        label="Align Top"
        disabled={!hasSelection}
        onClick={() => onAlign('top')}
      />
      <AlignButton
        icon={<AlignVerticalJustifyCenter className={iconSize} />}
        label="Align Middle"
        disabled={!hasSelection}
        onClick={() => onAlign('middle')}
      />
      <AlignButton
        icon={<AlignVerticalJustifyEnd className={iconSize} />}
        label="Align Bottom"
        disabled={!hasSelection}
        onClick={() => onAlign('bottom')}
      />

      <div className="w-px h-5 bg-dash-border mx-1" />

      {/* ─── Distribution ─── */}
      <span className="text-[9px] text-dash-text-muted mr-1 uppercase tracking-wider">
        Dist
      </span>

      <AlignButton
        icon={<AlignHorizontalSpaceAround className={iconSize} />}
        label="Distribute Horizontal"
        disabled={!hasThreeOrMore}
        onClick={() => onDistribute('horizontal')}
      />
      <AlignButton
        icon={<AlignVerticalSpaceAround className={iconSize} />}
        label="Distribute Vertical"
        disabled={!hasThreeOrMore}
        onClick={() => onDistribute('vertical')}
      />

      <div className="w-px h-5 bg-dash-border mx-1" />

      {/* ─── Group / Ungroup ─── */}
      <AlignButton
        icon={<Group className={iconSize} />}
        label="Group (Ctrl+G)"
        disabled={!hasMultiple}
        onClick={onGroup}
      />
      <AlignButton
        icon={<Ungroup className={iconSize} />}
        label="Ungroup"
        disabled={!hasSelection}
        onClick={onUngroup}
      />

      <div className="w-px h-5 bg-dash-border mx-1" />

      {/* ─── Copy / Paste ─── */}
      <AlignButton
        icon={<Copy className={iconSize} />}
        label="Copy (Ctrl+C)"
        disabled={!hasSelection}
        onClick={onCopy}
      />
      <AlignButton
        icon={<Clipboard className={iconSize} />}
        label="Paste (Ctrl+V)"
        disabled={!hasClipboard}
        onClick={onPaste}
      />
    </div>
  );
}

/* ──────────────────────── AlignButton ──────────────────────── */

function AlignButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded p-1.5 text-dash-text-muted hover:bg-dash-surface-hover hover:text-dash-text disabled:opacity-30 disabled:cursor-not-allowed transition"
    >
      {icon}
    </button>
  );
}
