// SPDX-License-Identifier: Apache-2.0
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Presentation,
  Search,
} from 'lucide-react';

interface PresentationViewerProps {
  src: string;
  name: string;
  mimeType?: string;
}

interface PresentationSlide {
  index: number;
  title: string;
  text: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_SLIDES = 50;

function parseSlideOrder(path: string) {
  const match = path.match(/slide(\d+)\.xml$/i);
  return Number(match?.[1] ?? '0');
}

function parseSlideText(xml: string) {
  const regexMatches = Array.from(xml.matchAll(/<(?:\w+:)?t>(.*?)<\/(?:\w+:)?t>/g))
    .map((match) => match[1]?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean);

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const textNodes = Array.from(doc.getElementsByTagName('*')).filter(
    (node) => node.localName === 't',
  );
  const xmlLines = textNodes
    .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .filter(Boolean);
  const lines = xmlLines.length > 0 ? xmlLines : regexMatches;

  const title = lines[0] ?? 'Untitled slide';

  return {
    title,
    text: lines.join('\n'),
  };
}

function parseOdpSlides(xml: string): PresentationSlide[] {
  const regexPages = Array.from(
    xml.matchAll(
      /<(?:\w+:)?page\b[^>]*?(?:(?:\w+:)?name="([^"]+)")?[^>]*>([\s\S]*?)<\/(?:\w+:)?page>/gi,
    ),
  ).map((match) => ({
    title: match[1] ?? '',
    text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  }));

  if (regexPages.length > 0) {
    return regexPages.slice(0, MAX_SLIDES).map((page, index) => ({
      index,
      title:
        page.title ||
        page.text.split(/\s+/).slice(0, 6).join(' ') ||
        `Slide ${index + 1}`,
      text: page.text,
    }));
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const pageNodes = Array.from(doc.getElementsByTagName('*')).filter(
    (node) => node.localName === 'page',
  );

  return pageNodes
    .slice(0, MAX_SLIDES)
    .map((page, index) => {
      const namespacedAttr = page
        .getAttributeNames()
        .find((attribute) => attribute === 'draw:name' || attribute.endsWith(':name'));
      const titleAttr =
        page.getAttribute('draw:name') ||
        page.getAttribute('name') ||
        (namespacedAttr ? page.getAttribute(namespacedAttr) : null) ||
        '';
      const text = page.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      const title =
        titleAttr || text.split(/\s+/).slice(0, 6).join(' ') || `Slide ${index + 1}`;

      return {
        index,
        title,
        text,
      };
    })
    .filter((slide) => slide.text || slide.title);
}

export function PresentationViewer({ src, name, mimeType }: PresentationViewerProps) {
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(src);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const contentLength = Number(res.headers.get('content-length') ?? '0');
        if (contentLength > MAX_FILE_SIZE) {
          throw new Error('Presentation is too large to preview inline.');
        }

        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
          throw new Error('Presentation is too large to preview inline.');
        }

        const JSZip = (await import('jszip')).default;
        const archive = await JSZip.loadAsync(arrayBuffer);

        let parsedSlides: PresentationSlide[] = [];
        let wasTruncated = false;

        if (mimeType?.includes('opendocument.presentation')) {
          const contentXml = await archive.file('content.xml')?.async('string');
          if (!contentXml) {
            throw new Error('No presentation slides were found in this file.');
          }

          const allSlides = parseOdpSlides(contentXml);
          wasTruncated = allSlides.length > MAX_SLIDES;
          parsedSlides = allSlides.slice(0, MAX_SLIDES);
        } else {
          const slidePaths = Object.keys(archive.files)
            .filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
            .sort((left, right) => parseSlideOrder(left) - parseSlideOrder(right));

          if (slidePaths.length === 0) {
            throw new Error('No presentation slides were found in this file.');
          }

          wasTruncated = slidePaths.length > MAX_SLIDES;
          parsedSlides = await Promise.all(
            slidePaths.slice(0, MAX_SLIDES).map(async (path, index) => {
              const xml = await archive.file(path)?.async('string');
              const parsed = parseSlideText(xml ?? '');

              return {
                index,
                title: parsed.title,
                text: parsed.text,
              } satisfies PresentationSlide;
            }),
          );
        }

        if (parsedSlides.length === 0) {
          throw new Error('No presentation slides were found in this file.');
        }

        if (!cancelled) {
          setSlides(parsedSlides);
          setTruncated(wasTruncated);
          setActiveIndex(0);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[PresentationViewer] Failed to load presentation:', err);
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load presentation preview.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [mimeType, src]);

  const filteredSlides = useMemo(() => {
    if (!search.trim()) {
      return slides;
    }

    const query = search.toLowerCase();
    return slides.filter(
      (slide) =>
        slide.title.toLowerCase().includes(query) ||
        slide.text.toLowerCase().includes(query),
    );
  }, [search, slides]);

  const activeSlide = filteredSlides[Math.min(activeIndex, filteredSlides.length - 1)] ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  if (loading) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-dash-muted py-10">
        <Loader2 className="h-8 w-8 animate-spin text-dash-text-muted" />
        <p className="text-xs text-dash-text-muted">Extracting slide text…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex w-full flex-col items-center gap-3 rounded-xl bg-red-50 py-8 dark:bg-red-950/30">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-4 py-2 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300"
        >
          <Download className="h-3.5 w-3.5" />
          Download instead
        </a>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-dash-surface2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-600 dark:text-orange-300">
            {mimeType?.includes('opendocument.presentation') ? 'ODP' : 'PPTX'}
          </span>
          <span className="truncate text-[11px] text-dash-text-muted">
            {name}
          </span>
          <span className="text-[10px] text-dash-text-muted">
            {slides.length} slides{truncated ? ' · preview truncated' : ''}
          </span>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1 text-dash-text-muted transition hover:bg-dash-surface-hover hover:text-dash-text"
          title="Download presentation"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dash-text-muted" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search slide text"
          className="w-full rounded-lg border border-dash-border bg-dash-surface px-9 py-2 text-sm text-dash-text outline-none transition focus:border-dash-border-strong"
        />
      </div>

      {filteredSlides.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="max-h-96 overflow-auto rounded-xl border border-dash-border bg-dash-surface p-2">
            <div className="space-y-2">
              {filteredSlides.map((slide, index) => (
                <button
                  key={`${slide.index}-${slide.title}`}
                  onClick={() => setActiveIndex(index)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    activeSlide?.index === slide.index
                      ? 'border-orange-500/40 bg-orange-500/10'
                      : 'border-dash-border bg-dash-surface2 hover:bg-dash-surface-hover'
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dash-text-muted">
                    Slide {slide.index + 1}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-dash-text">
                    {slide.title}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {activeSlide && (
            <div className="rounded-xl border border-dash-border bg-white p-4 dark:bg-dash-code-bg">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-dash-text-muted">
                    Slide {activeSlide.index + 1}
                  </p>
                  <h3 className="truncate text-base font-semibold text-dash-text">
                    {activeSlide.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveIndex((current) => Math.max(current - 1, 0))}
                    disabled={activeIndex === 0}
                    className="rounded p-1 text-dash-text-muted transition enabled:hover:bg-dash-surface-hover enabled:hover:text-dash-text disabled:opacity-40"
                    title="Previous slide"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveIndex((current) =>
                        Math.min(current + 1, filteredSlides.length - 1),
                      )
                    }
                    disabled={activeIndex >= filteredSlides.length - 1}
                    className="rounded p-1 text-dash-text-muted transition enabled:hover:bg-dash-surface-hover enabled:hover:text-dash-text disabled:opacity-40"
                    title="Next slide"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {activeSlide.text ? (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-dash-border/60 bg-dash-surface px-4 py-3 text-sm leading-6 text-dash-text wrap-break-word dark:bg-dash-surface2">
                  {activeSlide.text}
                </pre>
              ) : (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <Presentation className="h-8 w-8 text-dash-text-muted" />
                  <div>
                    <p className="text-sm font-medium text-dash-text">
                      No readable text was extracted from this slide.
                    </p>
                    <p className="mt-1 text-xs text-dash-text-muted">
                      Download the original file to inspect charts or visuals.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dash-border bg-dash-surface py-10 text-center">
          <Presentation className="h-8 w-8 text-dash-text-muted" />
          <div>
            <p className="text-sm font-medium text-dash-text">
              No slides matched this search.
            </p>
            <p className="mt-1 text-xs text-dash-text-muted">
              Clear the search or download the original deck.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default PresentationViewer;
