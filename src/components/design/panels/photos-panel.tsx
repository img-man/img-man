// SPDX-License-Identifier: Apache-2.0
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import { setDesignDragPayload } from '../drag-payload';

export interface StockPhoto {
  id: string;
  thumbUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  author: string;
  authorUrl: string;
  source: 'unsplash' | 'pexels';
  altText: string;
}

interface PhotosPanelProps {
  onAddImage: (url: string, name: string) => void;
}

export default function PhotosPanel({ onAddImage }: PhotosPanelProps) {
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchPhotos = useCallback(async (q: string, p: number, append = false) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/design-resources/photos?q=${encodeURIComponent(q.trim())}&page=${p}&per_page=20`,
      );
      if (res.ok) {
        const data = await res.json();
        const newPhotos: StockPhoto[] = data.photos ?? [];
        setPhotos(prev => (append ? [...prev, ...newPhotos] : newPhotos));
        setHasMore(newPhotos.length >= 20);
        setSearched(true);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setPage(1);
        fetchPhotos(q, 1);
      }, 400);
    },
    [fetchPhotos],
  );

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPhotos(query, next, true);
  }, [page, query, fetchPhotos]);

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100 && hasMore && !loading) {
        loadMore();
      }
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasMore, loading, loadMore]);

  // Load trending on mount
  useEffect(() => {
    fetchPhotos('trending', 1);
  }, [fetchPhotos]);

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-dash-border p-2">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-dash-text-muted" />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search free photos..."
            className="w-full rounded-lg border border-dash-border bg-dash-muted py-1.5 pl-7 pr-2 text-[11px] text-dash-text placeholder:text-dash-text-muted focus:border-violet-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Results */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
        {!searched && !loading && (
          <p className="py-6 text-center text-[10px] text-dash-text-muted">
            Search Unsplash for free stock photos
          </p>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => onAddImage(photo.fullUrl, photo.altText || 'Stock photo')}
              draggable
              onDragStart={(e) =>
                setDesignDragPayload(e, {
                  kind: 'image',
                  url: photo.fullUrl,
                  name: photo.altText || 'Stock photo',
                })
              }
              title={`By ${photo.author} — drag onto canvas`}
              className="group relative overflow-hidden rounded-lg border border-dash-border transition-all hover:border-violet-400 hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumbUrl}
                alt={photo.altText}
                className="aspect-square w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex items-center gap-1">
                  <p className="truncate text-[8px] text-white/80">{photo.author}</p>
                  <ExternalLink size={7} className="shrink-0 text-white/60" />
                </div>
              </div>
              {/* Free badge */}
              <div className="absolute right-1 top-1 rounded bg-emerald-500/90 px-1 py-0.5 text-[7px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                FREE
              </div>
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={16} className="animate-spin text-violet-400" />
          </div>
        )}

        {searched && photos.length === 0 && !loading && (
          <p className="py-6 text-center text-[10px] text-dash-text-muted">
            No photos found. Try a different search.
          </p>
        )}
      </div>

      {/* Attribution */}
      <div className="border-t border-dash-border px-2 py-1.5">
        <p className="text-[8px] text-dash-text-muted text-center">
          Photos by <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">Unsplash</a>
        </p>
      </div>
    </div>
  );
}
