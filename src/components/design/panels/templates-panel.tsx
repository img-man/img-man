// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useMemo } from 'react';
import { Search, LayoutTemplate, Sparkles } from 'lucide-react';
import { DESIGN_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/templates';
import type { DesignTemplate } from '@/lib/templates';
import { SEED_TEMPLATES, type SeedTemplate } from '@/lib/template-seed';

export interface TemplatesPanelProps {
  onLoadTemplate: (template: DesignTemplate) => void;
  /** D37 — load a fully designed seed template (canvas + content). */
  onLoadSeedTemplate?: (template: SeedTemplate) => void;
}

export default function TemplatesPanel({
  onLoadTemplate,
  onLoadSeedTemplate,
}: TemplatesPanelProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  const filtered = useMemo(() => {
    return DESIGN_TEMPLATES.filter((t) => {
      if (category !== 'All' && t.category !== category) return false;
      if (query && !t.name.toLowerCase().includes(query.toLowerCase()))
        return false;
      // Don't show "Custom" in browse mode
      if (t.id === 'custom') return false;
      return true;
    });
  }, [query, category]);

  const grouped = useMemo(() => {
    const map = new Map<string, DesignTemplate[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dash-border px-3 py-2">
        <span className="text-[11px] font-semibold text-dash-text">
          Templates
        </span>
        <p className="text-[10px] text-dash-text-muted">
          Start with a preset canvas size
        </p>
      </div>

      {/* Search */}
      <div className="border-b border-dash-border px-2 py-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-dash-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full rounded-md border border-dash-border bg-dash-muted pl-7 pr-2 py-1.5 text-[11px] text-dash-text placeholder:text-dash-text-muted outline-none focus:border-[var(--im-primary)]"
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1 border-b border-dash-border px-2 py-1.5">
        {TEMPLATE_CATEGORIES.filter((c) => c !== 'Custom').map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
              category === cat
                ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                : 'bg-dash-muted text-dash-text2 hover:bg-dash-muted/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto p-2">
        {onLoadSeedTemplate && SEED_TEMPLATES.length > 0 && (
          <div className="mb-3">
            <h4 className="mb-1.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-dash-text-muted">
              <Sparkles className="h-3 w-3 text-[var(--im-primary)]" />
              Featured starters
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              {SEED_TEMPLATES.map((seed) => (
                <button
                  key={seed.id}
                  onClick={() => onLoadSeedTemplate(seed)}
                  title={seed.description}
                  className="group flex flex-col items-center gap-1 rounded-lg border border-dash-border p-2 text-center transition-all hover:border-[var(--im-primary)] hover:shadow-sm"
                >
                  <div
                    className="flex items-center justify-center rounded"
                    style={{
                      width: 56,
                      height: 56,
                      backgroundColor: `${seed.accentColor}15`,
                    }}
                  >
                    <div
                      className="rounded-sm border border-dash-border"
                      style={{
                        width:
                          seed.width > seed.height
                            ? 36
                            : Math.round(36 * (seed.width / seed.height)),
                        height:
                          seed.height > seed.width
                            ? 36
                            : Math.round(36 * (seed.height / seed.width)),
                        backgroundColor: seed.accentColor,
                      }}
                    />
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="truncate text-[10px] font-medium text-dash-text">
                      {seed.name}
                    </p>
                    <p className="text-[8px] text-dash-text-muted">
                      {seed.width}×{seed.height}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-[10px] text-dash-text-muted">
            No templates match your search
          </p>
        ) : (
          Array.from(grouped.entries()).map(([cat, templates]) => (
            <div key={cat} className="mb-3">
              <h4 className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-dash-text-muted">
                {cat}
              </h4>
              <div className="grid grid-cols-2 gap-1.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onLoadTemplate(t)}
                    className="group flex flex-col items-center gap-1 rounded-lg border border-dash-border p-2 text-center transition-all hover:border-[var(--im-primary)] hover:shadow-sm"
                  >
                    {/* Aspect ratio preview box */}
                    <div
                      className="flex items-center justify-center rounded bg-dash-muted transition-colors group-hover:bg-[var(--im-primary)]/10"
                      style={{
                        width: 56,
                        height: 56,
                      }}
                    >
                      <div
                        className="rounded-sm border border-dash-border bg-white dark:bg-dash-surface"
                        style={{
                          width:
                            t.width > t.height
                              ? 36
                              : Math.round(36 * (t.width / t.height)),
                          height:
                            t.height > t.width
                              ? 36
                              : Math.round(36 * (t.height / t.width)),
                        }}
                      >
                        <LayoutTemplate className="h-full w-full p-1 text-dash-text-muted" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-medium text-dash-text">
                        {t.name}
                      </p>
                      <p className="text-[8px] text-dash-text-muted">
                        {t.width}×{t.height}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
