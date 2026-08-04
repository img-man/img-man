// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import shapesData from '../data/shapes.json';

interface ShapeItem {
  id: string;
  label: string;
  viewBox: string;
  path: string;
  isLine?: boolean;
  strokeDasharray?: string;
}

interface ShapeCategory {
  name: string;
  shapes: ShapeItem[];
}

interface ShapesPanelProps {
  onAddSvg: (svgContent: string, viewBox: string, label: string) => void;
}

export default function ShapesPanel({ onAddSvg }: ShapesPanelProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [shapeColor, setShapeColor] = useState('#6366f1');

  const categories: ShapeCategory[] = shapesData.categories as ShapeCategory[];

  const filtered = useMemo(() => {
    let cats = categories;
    if (activeCategory) {
      cats = cats.filter(c => c.name === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      cats = cats.map(c => ({
        ...c,
        shapes: c.shapes.filter(s => s.label.toLowerCase().includes(q) || s.id.includes(q)),
      })).filter(c => c.shapes.length > 0);
    }
    return cats;
  }, [categories, search, activeCategory]);

  const handleInsertShape = (shape: ShapeItem) => {
    const isLine = shape.isLine;
    const strokeAttr = isLine ? `stroke="${shapeColor}" stroke-width="3" fill="none"` : `fill="${shapeColor}" stroke="none"`;
    const dashAttr = shape.strokeDasharray ? ` stroke-dasharray="${shape.strokeDasharray}"` : '';

    const svgStr =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${shape.viewBox}" ${strokeAttr}${dashAttr}>` +
      `<path d="${shape.path}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `</svg>`;

    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    onAddSvg(url, shape.viewBox, shape.label);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Search + color */}
      <div className="space-y-2 border-b border-dash-border p-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dash-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shapes..."
            className="w-full rounded-lg border border-dash-border bg-dash-muted py-1.5 pl-7 pr-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-violet-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-dash-text-muted">Color:</span>
          <input
            type="color"
            value={shapeColor}
            onChange={e => setShapeColor(e.target.value)}
            className="h-5 w-8 cursor-pointer rounded border border-dash-border"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-1 border-b border-dash-border p-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
            !activeCategory ? 'bg-violet-500 text-white' : 'bg-dash-muted text-dash-text2 hover:bg-dash-border'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-colors ${
              activeCategory === cat.name ? 'bg-violet-500 text-white' : 'bg-dash-muted text-dash-text2 hover:bg-dash-border'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Shapes grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.map(cat => (
          <div key={cat.name} className="mb-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-dash-text-muted">
              {cat.name}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {cat.shapes.map(shape => (
                <button
                  key={shape.id}
                  onClick={() => handleInsertShape(shape)}
                  title={shape.label}
                  className="flex aspect-square items-center justify-center rounded-lg border border-dash-border p-2 transition-all hover:border-violet-400 hover:shadow-md"
                >
                  <svg
                    viewBox={shape.viewBox}
                    className="h-full w-full"
                    fill={shape.isLine ? 'none' : shapeColor}
                    stroke={shape.isLine ? shapeColor : 'none'}
                    strokeWidth={shape.isLine ? 3 : 0}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={shape.strokeDasharray}
                  >
                    <path d={shape.path} />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-[10px] text-dash-text-muted">
            No shapes found
          </p>
        )}
      </div>

      <div className="border-t border-dash-border px-2 py-1.5">
        <p className="text-center text-[8px] text-dash-text-muted">
          {categories.reduce((sum, c) => sum + c.shapes.length, 0)} shapes available
        </p>
      </div>
    </div>
  );
}
