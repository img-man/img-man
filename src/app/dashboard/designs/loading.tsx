// SPDX-License-Identifier: Apache-2.0
/**
 * Designs loading skeleton.
 */
export default function DesignsLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-40 rounded-lg bg-dash-muted" />
        <div className="h-9 w-36 rounded-lg bg-dash-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-dash-border bg-dash-surface"
          >
            <div className="aspect-[4/3] bg-dash-muted" />
            <div className="p-4">
              <div className="mb-2 h-4 w-2/3 rounded bg-dash-muted/60" />
              <div className="h-3 w-1/3 rounded bg-dash-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
