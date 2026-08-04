// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * GET /api/design-resources/photos
 * Proxies free stock photo search (Unsplash/Pexels).
 * Falls back to placeholder results if no API key is configured.
 *
 * Query params: q, page, per_page
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') ?? 'trending';
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const perPage = Math.min(parseInt(searchParams.get('per_page') ?? '20', 10), 30);

  // Try Unsplash first
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashKey) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&orientation=squarish`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
        next: { revalidate: 300 }, // cache 5 min
      });

      if (res.ok) {
        const data = await res.json();
        const photos = (data.results ?? []).map((p: Record<string, unknown>) => ({
          id: p.id,
          url: (p.urls as Record<string, string>)?.regular ?? (p.urls as Record<string, string>)?.small,
          thumbUrl: (p.urls as Record<string, string>)?.thumb ?? (p.urls as Record<string, string>)?.small,
          width: p.width,
          height: p.height,
          alt: (p.alt_description as string) ?? query,
          author: (p.user as Record<string, string>)?.name ?? 'Unknown',
          authorUrl: (p.user as Record<string, Record<string, string>>)?.links?.html ?? '',
          source: 'unsplash',
          attribution: `Photo by ${(p.user as Record<string, string>)?.name ?? 'Unknown'} on Unsplash`,
        }));

        return NextResponse.json({ photos, total: data.total ?? 0 });
      }
    } catch {
      // Fallback below
    }
  }

  // Try Pexels
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (pexelsKey) {
    try {
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}`;
      const res = await fetch(url, {
        headers: { Authorization: pexelsKey },
        next: { revalidate: 300 },
      });

      if (res.ok) {
        const data = await res.json();
        const photos = (data.photos ?? []).map((p: Record<string, unknown>) => ({
          id: String(p.id),
          url: (p.src as Record<string, string>)?.large ?? (p.src as Record<string, string>)?.medium,
          thumbUrl: (p.src as Record<string, string>)?.small ?? (p.src as Record<string, string>)?.tiny,
          width: p.width,
          height: p.height,
          alt: (p.alt as string) ?? query,
          author: (p.photographer as string) ?? 'Unknown',
          authorUrl: (p.photographer_url as string) ?? '',
          source: 'pexels',
          attribution: `Photo by ${p.photographer ?? 'Unknown'} on Pexels`,
        }));

        return NextResponse.json({ photos, total: data.total_results ?? 0 });
      }
    } catch {
      // Fallback below
    }
  }

  // Placeholder fallback (no API keys)
  const placeholderPhotos = Array.from({ length: perPage }, (_, i) => {
    const idx = (page - 1) * perPage + i;

    return {
      id: `placeholder-${idx}`,
      url: `https://picsum.photos/seed/${query.replace(/\s+/g, '-')}-${idx}/800/600`,
      thumbUrl: `https://picsum.photos/seed/${query.replace(/\s+/g, '-')}-${idx}/200/150`,
      width: 800,
      height: 600,
      alt: `${query} placeholder ${idx + 1}`,
      author: 'Lorem Picsum',
      authorUrl: 'https://picsum.photos',
      source: 'placeholder',
      attribution: 'Photo from Lorem Picsum (placeholder)',
    };
  });

  return NextResponse.json({ photos: placeholderPhotos, total: 100 });
}
