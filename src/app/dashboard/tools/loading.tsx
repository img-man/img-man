// SPDX-License-Identifier: Apache-2.0
/**
 * Tools loading skeleton.
 */
export default function ToolsLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-6 h-7 w-36 rounded-lg bg-dash-muted" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-dash-border bg-dash-surface p-6"
          >
            <div className="mb-4 h-10 w-10 rounded-lg bg-dash-muted" />
            <div className="mb-2 h-5 w-2/3 rounded bg-dash-muted/60" />
            <div className="h-3 w-full rounded bg-dash-muted/40" />
            <div className="mt-1 h-3 w-3/4 rounded bg-dash-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
