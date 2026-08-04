// SPDX-License-Identifier: Apache-2.0
/**
 * AI features loading skeleton.
 */
export default function AiLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-6 h-7 w-32 rounded-lg bg-dash-muted" />
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-dash-border bg-dash-surface p-5"
          >
            <div className="mb-3 h-4 w-24 rounded bg-dash-muted/60" />
            <div className="h-8 w-20 rounded-lg bg-dash-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dash-border bg-dash-surface p-6">
        <div className="mb-4 h-5 w-48 rounded bg-dash-muted/60" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 w-full rounded bg-dash-muted/40" />
          ))}
        </div>
      </div>
    </div>
  );
}
