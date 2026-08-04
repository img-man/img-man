// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/**
 * GET /api/design-resources/fonts
 * Returns a curated list of Google Fonts for the design editor.
 * If the Google Fonts API key is available, fetches live data;
 * otherwise returns a well-known fallback list.
 *
 * Query params: sort (alpha|trending|popular), category
 */

// Fallback list of well-known Google Fonts
const FALLBACK_FONTS = [
  { family: 'Inter', category: 'sans-serif', variants: ['regular', '500', '600', '700'] },
  { family: 'Roboto', category: 'sans-serif', variants: ['regular', '500', '700'] },
  { family: 'Open Sans', category: 'sans-serif', variants: ['regular', '600', '700'] },
  { family: 'Lato', category: 'sans-serif', variants: ['regular', '700'] },
  { family: 'Montserrat', category: 'sans-serif', variants: ['regular', '500', '600', '700'] },
  { family: 'Poppins', category: 'sans-serif', variants: ['regular', '500', '600', '700'] },
  { family: 'Nunito', category: 'sans-serif', variants: ['regular', '600', '700'] },
  { family: 'Source Sans Pro', category: 'sans-serif', variants: ['regular', '600', '700'] },
  { family: 'Raleway', category: 'sans-serif', variants: ['regular', '500', '700'] },
  { family: 'Work Sans', category: 'sans-serif', variants: ['regular', '500', '700'] },
  { family: 'DM Sans', category: 'sans-serif', variants: ['regular', '500', '700'] },
  { family: 'Roboto Slab', category: 'serif', variants: ['regular', '500', '700'] },
  { family: 'Playfair Display', category: 'serif', variants: ['regular', '700'] },
  { family: 'Lora', category: 'serif', variants: ['regular', '500', '700'] },
  { family: 'Merriweather', category: 'serif', variants: ['regular', '700'] },
  { family: 'PT Serif', category: 'serif', variants: ['regular', '700'] },
  { family: 'Libre Baskerville', category: 'serif', variants: ['regular', '700'] },
  { family: 'Crimson Text', category: 'serif', variants: ['regular', '600', '700'] },
  { family: 'Bitter', category: 'serif', variants: ['regular', '700'] },
  { family: 'Roboto Mono', category: 'monospace', variants: ['regular', '500', '700'] },
  { family: 'Fira Code', category: 'monospace', variants: ['regular', '500', '700'] },
  { family: 'JetBrains Mono', category: 'monospace', variants: ['regular', '700'] },
  { family: 'Source Code Pro', category: 'monospace', variants: ['regular', '500', '700'] },
  { family: 'Space Mono', category: 'monospace', variants: ['regular', '700'] },
  { family: 'Dancing Script', category: 'handwriting', variants: ['regular', '700'] },
  { family: 'Pacifico', category: 'handwriting', variants: ['regular'] },
  { family: 'Great Vibes', category: 'handwriting', variants: ['regular'] },
  { family: 'Caveat', category: 'handwriting', variants: ['regular', '700'] },
  { family: 'Satisfy', category: 'handwriting', variants: ['regular'] },
  { family: 'Lobster', category: 'display', variants: ['regular'] },
  { family: 'Bebas Neue', category: 'display', variants: ['regular'] },
  { family: 'Oswald', category: 'display', variants: ['regular', '500', '700'] },
  { family: 'Bangers', category: 'display', variants: ['regular'] },
  { family: 'Righteous', category: 'display', variants: ['regular'] },
  { family: 'Press Start 2P', category: 'display', variants: ['regular'] },
];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') ?? 'popular';

  // Try Google Fonts API
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=${sort === 'alpha' ? 'alpha' : 'popularity'}`;
      const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hour

      if (res.ok) {
        const data = await res.json();
        let fonts = (data.items ?? []).slice(0, 200).map((f: Record<string, unknown>) => ({
          family: f.family,
          category: f.category,
          variants: f.variants,
        }));

        if (category) {
          fonts = fonts.filter((f: { category: string }) => f.category === category);
        }

        return NextResponse.json({ fonts });
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback
  let fonts = [...FALLBACK_FONTS];
  if (category) {
    fonts = fonts.filter(f => f.category === category);
  }

  return NextResponse.json({ fonts });
}
