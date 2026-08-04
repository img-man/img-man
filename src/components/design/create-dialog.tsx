// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useMemo } from 'react';
import {
  DESIGN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  DesignTemplate,
} from '@/lib/templates';
import { X, Search, ArrowRight } from 'lucide-react';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function getAspectRatio(w: number, h: number): string {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

interface CreateDesignDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, width: number, height: number) => void;
  creating: boolean;
}

export function CreateDesignDialog({
  open,
  onClose,
  onCreate,
  creating,
}: CreateDesignDialogProps) {
  const [name, setName] = useState('');
  const [selectedTemplate, setSelectedTemplate] =
    useState<DesignTemplate | null>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);

  const filteredTemplates = useMemo(() => {
    let filtered = DESIGN_TEMPLATES;
    if (category !== 'All') {
      filtered = filtered.filter((t) => t.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [category, search]);

  const handleCreate = () => {
    const designName =
      name.trim() || selectedTemplate?.name || 'Untitled Design';
    const w =
      selectedTemplate?.id === 'custom'
        ? customWidth
        : (selectedTemplate?.width ?? 1080);
    const h =
      selectedTemplate?.id === 'custom'
        ? customHeight
        : (selectedTemplate?.height ?? 1080);
    onCreate(designName, w, h);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-3xl rounded-2xl bg-dash-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <h2 className="text-lg font-semibold text-dash-text">
            Create a design
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-dash-text-muted hover:bg-dash-muted hover:text-dash-text2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Design name */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-medium text-dash-text2">
              Design name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My awesome design"
              className="w-full rounded-xl border border-dash-border bg-dash-muted px-4 py-2.5 text-sm outline-none focus:border-[var(--im-primary)] focus:ring-2 focus:ring-[var(--im-primary)]/20"
            />
          </div>

          {/* Category filter + search */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    category === cat
                      ? 'bg-[var(--im-primary)] text-[var(--im-primary-fg)]'
                      : 'bg-dash-muted text-dash-text2 hover:bg-dash-badge'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-48 rounded-lg border border-dash-border bg-dash-muted py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--im-primary)]"
              />
            </div>
          </div>

          {/* Template grid */}
          <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto rounded-xl border border-dash-border bg-dash-muted p-3 sm:grid-cols-4">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'border-[var(--im-primary)] bg-[var(--im-primary-light)]'
                    : 'border-transparent bg-dash-surface hover:border-dash-border hover:shadow-sm'
                }`}
              >
                <span className="text-2xl">{template.icon}</span>
                <span className="text-xs font-medium text-dash-text2">
                  {template.name}
                </span>
                <span className="text-[10px] text-dash-text-muted">
                  {getAspectRatio(template.width, template.height)}
                </span>
              </button>
            ))}
          </div>

          {/* Custom size inputs */}
          {selectedTemplate?.id === 'custom' && (
            <div className="mt-4 flex items-center gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-dash-text2">
                  Width (px)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value) || 1)}
                  className="w-28 rounded-lg border border-dash-border bg-dash-muted px-3 py-1.5 text-sm outline-none focus:border-[var(--im-primary)]"
                />
              </div>
              <span className="mt-5 text-dash-text-muted">×</span>
              <div>
                <label className="mb-1 block text-xs font-medium text-dash-text2">
                  Height (px)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value) || 1)}
                  className="w-28 rounded-lg border border-dash-border bg-dash-muted px-3 py-1.5 text-sm outline-none focus:border-[var(--im-primary)]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-dash-border px-6 py-4">
          <p className="text-xs text-dash-text-muted">
            {selectedTemplate
              ? `${selectedTemplate.name} · ${getAspectRatio(selectedTemplate.width, selectedTemplate.height)} (${selectedTemplate.width}×${selectedTemplate.height})`
              : 'Select a template to get started'}
          </p>
          <button
            onClick={handleCreate}
            disabled={!selectedTemplate || creating}
            className="flex items-center gap-2 rounded-xl bg-[var(--im-primary)] px-5 py-2.5 text-sm font-medium text-[var(--im-primary-fg)] hover:bg-[var(--im-primary)]/90 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : 'Create design'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
