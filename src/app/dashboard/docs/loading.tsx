// SPDX-License-Identifier: Apache-2.0
export default function DocsLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-8">
        <div className="h-7 w-48 rounded-lg bg-dash-muted" />
        <div className="mt-2 h-4 w-64 rounded-md bg-dash-muted/60" />
      </div>
      <div className="flex gap-6">
        <div className="hidden w-56 shrink-0 space-y-2 lg:block">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-dash-muted/40" />
          ))}
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-6 w-3/4 rounded bg-dash-muted" />
          <div className="h-4 w-full rounded bg-dash-muted/40" />
          <div className="h-4 w-5/6 rounded bg-dash-muted/40" />
          <div className="h-4 w-2/3 rounded bg-dash-muted/40" />
          <div className="mt-6 h-40 rounded-xl bg-dash-muted/20" />
        </div>
      </div>
    </div>
  );
}
