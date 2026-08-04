// SPDX-License-Identifier: Apache-2.0
/**
 * Dashboard-level loading skeleton.
 * Shown while dashboard route segments are loading via React Suspense.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming
 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse p-6">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-48 rounded-lg bg-dash-muted" />
          <div className="h-4 w-72 rounded-md bg-dash-muted/60" />
        </div>
        <div className="flex gap-3">
          <div className="h-9 w-24 rounded-lg bg-dash-muted" />
          <div className="h-9 w-32 rounded-lg bg-dash-muted" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-dash-border bg-dash-surface p-5"
          >
            <div className="mb-3 h-4 w-20 rounded bg-dash-muted/60" />
            <div className="h-8 w-28 rounded-lg bg-dash-muted" />
          </div>
        ))}
      </div>

      {/* Grid skeleton (asset cards) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface"
          >
            <div className="aspect-square bg-dash-muted" />
            <div className="p-3">
              <div className="mb-2 h-3.5 w-3/4 rounded bg-dash-muted/60" />
              <div className="h-3 w-1/2 rounded bg-dash-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
