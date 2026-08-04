// SPDX-License-Identifier: Apache-2.0
export default function VaultLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="h-7 w-28 rounded-lg bg-dash-muted" />
          <div className="mt-2 h-4 w-60 rounded-md bg-dash-muted/60" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-dash-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
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
