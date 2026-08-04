// SPDX-License-Identifier: Apache-2.0
export default function SharesLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="h-7 w-36 rounded-lg bg-dash-muted" />
          <div className="mt-2 h-4 w-56 rounded-md bg-dash-muted/60" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-dash-muted" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-dash-border bg-dash-surface p-5"
          >
            <div className="mb-3 h-4 w-3/4 rounded bg-dash-muted" />
            <div className="h-3 w-1/2 rounded bg-dash-muted/40" />
            <div className="mt-4 flex gap-2">
              <div className="h-7 w-16 rounded bg-dash-muted/30" />
              <div className="h-7 w-16 rounded bg-dash-muted/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
