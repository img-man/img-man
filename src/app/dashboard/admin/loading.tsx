// SPDX-License-Identifier: Apache-2.0
export default function AdminLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-48 rounded-lg bg-dash-muted" />
          <div className="h-4 w-72 rounded-md bg-dash-muted/60" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-dash-muted" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-dash-muted/40" />
        ))}
      </div>
    </div>
  );
}
