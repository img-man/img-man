// SPDX-License-Identifier: Apache-2.0
export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-8">
        <div className="h-7 w-40 rounded-lg bg-dash-muted" />
        <div className="mt-2 h-4 w-64 rounded-md bg-dash-muted/60" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-dash-border bg-dash-surface p-5"
          >
            <div className="mb-3 h-4 w-24 rounded bg-dash-muted/60" />
            <div className="h-8 w-28 rounded-lg bg-dash-muted" />
          </div>
        ))}
      </div>
      <div className="h-64 rounded-xl bg-dash-muted/30" />
    </div>
  );
}
