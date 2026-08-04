// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Tools error boundary (PDF editor, AI tools, etc.)
 */
export default function ToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Tools Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-8 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
          <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-300">
          Tool Error
        </h2>
        <p className="text-sm text-red-600 dark:text-red-400">
          {error.message || 'This tool encountered an error.'}
        </p>
        <button
          onClick={reset}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
