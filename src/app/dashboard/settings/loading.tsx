// SPDX-License-Identifier: Apache-2.0
export default function SettingsLoading() {
  return (
    <div className="animate-pulse p-6">
      <div className="mb-8">
        <div className="h-7 w-32 rounded-lg bg-dash-muted" />
        <div className="mt-2 h-4 w-52 rounded-md bg-dash-muted/60" />
      </div>
      <div className="flex gap-6">
        <div className="hidden w-48 shrink-0 space-y-2 md:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-dash-muted/40" />
          ))}
        </div>
        <div className="flex-1 space-y-6">
          <div className="rounded-xl border border-dash-border bg-dash-surface p-6">
            <div className="mb-4 h-5 w-36 rounded bg-dash-muted" />
            <div className="space-y-4">
              <div className="h-10 rounded-lg bg-dash-muted/30" />
              <div className="h-10 rounded-lg bg-dash-muted/30" />
              <div className="h-10 w-32 rounded-lg bg-dash-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
