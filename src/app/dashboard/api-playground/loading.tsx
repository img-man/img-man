// SPDX-License-Identifier: Apache-2.0
export default function ApiPlaygroundLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-8">
        <div className="h-7 w-44 rounded-lg bg-dash-muted" />
        <div className="mt-2 h-4 w-60 rounded-md bg-dash-muted/60" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-dash-border bg-dash-surface p-6">
          <div className="mb-4 h-5 w-24 rounded bg-dash-muted/60" />
          <div className="space-y-3">
            <div className="h-10 rounded-lg bg-dash-muted/40" />
            <div className="h-32 rounded-lg bg-dash-muted/30" />
            <div className="h-10 w-28 rounded-lg bg-dash-muted" />
          </div>
        </div>
        <div className="rounded-xl border border-dash-border bg-dash-surface p-6">
          <div className="mb-4 h-5 w-20 rounded bg-dash-muted/60" />
          <div className="h-48 rounded-lg bg-dash-muted/30" />
        </div>
      </div>
    </div>
  );
}
