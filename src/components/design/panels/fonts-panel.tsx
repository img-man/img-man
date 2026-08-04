// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface FontItem {
  family: string;
  category: string;
  variants: string[];
}

interface FontsPanelProps {
  onApplyFont: (fontFamily: string) => void;
}

// Popular Google Fonts built-in (fallback if API unavailable)
const FALLBACK_FONTS: FontItem[] = [
  { family: 'Roboto', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Open Sans', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Lato', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Montserrat', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Poppins', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Inter', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Nunito', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Raleway', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Ubuntu', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Oswald', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Playfair Display', category: 'serif', variants: ['regular', '700'] },
  { family: 'Merriweather', category: 'serif', variants: ['regular', '700'] },
  { family: 'Lora', category: 'serif', variants: ['regular', '700'] },
  { family: 'PT Serif', category: 'serif', variants: ['regular', '700'] },
  { family: 'Noto Serif', category: 'serif', variants: ['regular', '700'] },
  { family: 'Libre Baskerville', category: 'serif', variants: ['regular', '700'] },
  { family: 'EB Garamond', category: 'serif', variants: ['regular', '700'] },
  { family: 'Pacifico', category: 'handwriting', variants: ['regular'] },
  { family: 'Dancing Script', category: 'handwriting', variants: ['regular', '700'] },
  { family: 'Caveat', category: 'handwriting', variants: ['regular', '700'] },
  { family: 'Satisfy', category: 'handwriting', variants: ['regular'] },
  { family: 'Great Vibes', category: 'handwriting', variants: ['regular'] },
  { family: 'Sacramento', category: 'handwriting', variants: ['regular'] },
  { family: 'Permanent Marker', category: 'display', variants: ['regular'] },
  { family: 'Abril Fatface', category: 'display', variants: ['regular'] },
  { family: 'Righteous', category: 'display', variants: ['regular'] },
  { family: 'Lobster', category: 'display', variants: ['regular'] },
  { family: 'Bebas Neue', category: 'display', variants: ['regular'] },
  { family: 'Anton', category: 'display', variants: ['regular'] },
  { family: 'Fira Code', category: 'monospace', variants: ['regular', '700'] },
  { family: 'Source Code Pro', category: 'monospace', variants: ['regular', '700'] },
  { family: 'JetBrains Mono', category: 'monospace', variants: ['regular', '700'] },
  { family: 'Space Mono', category: 'monospace', variants: ['regular', '700'] },
  { family: 'Inconsolata', category: 'monospace', variants: ['regular', '700'] },
];

const CATEGORIES = ['all', 'sans-serif', 'serif', 'display', 'handwriting', 'monospace'];

// Track which fonts have been loaded
const loadedFonts = new Set<string>();

function loadGoogleFont(family: string) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

export default function FontsPanel({ onApplyFont }: FontsPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [fonts, setFonts] = useState<FontItem[]>(FALLBACK_FONTS);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // We compute a filter key to reset visible count when filters change
  const filterKey = `${search}|${category}`;
  const [visibleCount, setVisibleCount] = useState(20);
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setVisibleCount(20);
  }

  // Fetch fonts from API on mount
  const fetchFonts = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch('/api/design-resources/fonts');
      if (res.ok) {
        const data = await res.json();
        if (data?.fonts?.length) setFonts(data.fonts);
      }
    } catch {
      // Use fallback fonts
    } finally {
      setFetched(true);
      setLoading(false);
    }
  }, [fetched]);

  useEffect(() => {
    fetchFonts();
  }, [fetchFonts]);

  const filtered = useMemo(() => {
    let list = fonts;
    if (category !== 'all') {
      list = list.filter(f => f.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(f => f.family.toLowerCase().includes(q));
    }
    return list;
  }, [fonts, category, search]);

  const visible = filtered.slice(0, visibleCount);

  // Load font CSS for visible items
  useEffect(() => {
    visible.forEach(f => loadGoogleFont(f.family));
  }, [visible]);

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) {
        setVisibleCount(prev => Math.min(prev + 20, filtered.length));
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [filtered.length]);

  const handleSelect = useCallback(
    (family: string) => {
      loadGoogleFont(family);
      onApplyFont(family);
    },
    [onApplyFont],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-dash-border p-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dash-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search fonts..."
            className="w-full rounded-lg border border-dash-border bg-dash-muted py-1.5 pl-7 pr-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-violet-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 border-b border-dash-border p-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-full px-2 py-0.5 text-[9px] font-medium capitalize transition-colors ${
              category === cat ? 'bg-violet-500 text-white' : 'bg-dash-muted text-dash-text2 hover:bg-dash-border'
            }`}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Font list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={16} className="animate-spin text-violet-400" />
          </div>
        )}

        {visible.map(font => (
          <button
            key={font.family}
            onClick={() => handleSelect(font.family)}
            className="flex w-full flex-col gap-0.5 border-b border-dash-border px-3 py-2 text-left transition-colors hover:bg-dash-muted"
          >
            <span className="text-[10px] text-dash-text-muted">{font.family}</span>
            <span
              style={{ fontFamily: `'${font.family}', ${font.category}` }}
              className="text-base text-dash-text leading-tight"
            >
              The quick brown fox
            </span>
          </button>
        ))}

        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-[10px] text-dash-text-muted">
            No fonts found
          </p>
        )}
      </div>

      <div className="border-t border-dash-border px-2 py-1.5">
        <p className="text-center text-[8px] text-dash-text-muted">
          {filtered.length} fonts • Powered by Google Fonts
        </p>
      </div>
    </div>
  );
}
