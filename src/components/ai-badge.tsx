// SPDX-License-Identifier: Apache-2.0

import { Sparkles } from 'lucide-react';

interface AiBadgeProps {
  disabled?: boolean;
  label?: string;
  className?: string;
}

export default function AiBadge({
  disabled = false,
  label = 'AI',
  className = '',
}: AiBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        disabled
          ? 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400'
          : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300'
      } ${className}`.trim()}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  );
}