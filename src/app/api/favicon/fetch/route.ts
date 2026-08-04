// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import {
  buildDefaultFaviconCandidates,
  dedupeFaviconLinks,
  extractIconLinksFromHtml,
  normalizeWebsiteUrl,
  scoreFaviconLink,
  type FaviconFetchPayload,
  type FetchedFaviconAsset,
} from '@/lib/favicon-analysis';

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function createDataUrl(contentType: string, bytes: ArrayBuffer) {
  return `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`;
}

export async function GET(request: NextRequest) {
  try {
    const targetUrl = request.nextUrl.searchParams.get('url');
    if (!targetUrl) {
      return NextResponse.json(
        { success: false, error: 'URL parameter is required' },
        { status: 400 },
      );
    }

    const normalizedUrl = normalizeWebsiteUrl(targetUrl);
    let html = '';

    try {
      const pageResponse = await fetchWithTimeout(
        normalizedUrl,
        {
          method: 'GET',
          redirect: 'follow',
          cache: 'no-store',
          headers: {
            'User-Agent': 'ImageMan-Favicon-Studio/1.0',
          },
        },
        10_000,
      );

      if (pageResponse.ok) {
        html = await pageResponse.text();
      }
    } catch {
      html = '';
    }

    const candidateLinks = dedupeFaviconLinks([
      ...extractIconLinksFromHtml(html, normalizedUrl),
      ...buildDefaultFaviconCandidates(normalizedUrl),
    ]).sort((left, right) => scoreFaviconLink(right) - scoreFaviconLink(left));

    const favicons = (
      await Promise.all(
        candidateLinks.slice(0, 10).map(async (candidate) => {
          try {
            const response = await fetchWithTimeout(
              candidate.url,
              {
                method: 'GET',
                redirect: 'follow',
                cache: 'no-store',
                headers: {
                  'User-Agent': 'ImageMan-Favicon-Studio/1.0',
                },
              },
              5_000,
            );

            if (!response.ok) {
              return null;
            }

            const contentType = response.headers.get('content-type') ?? candidate.type;
            const bytes = await response.arrayBuffer();
            if (!contentType.includes('image') && !contentType.includes('icon')) {
              return null;
            }

            const favicon: FetchedFaviconAsset = {
              ...candidate,
              type: contentType,
              dataUrl: createDataUrl(contentType, bytes),
              sizeBytes: bytes.byteLength,
            };

            return favicon;
          } catch {
            return null;
          }
        }),
      )
    ).filter((favicon): favicon is FetchedFaviconAsset => favicon !== null);

    if (favicons.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No favicon assets could be fetched from the supplied URL',
        },
        { status: 404 },
      );
    }

    const payload: FaviconFetchPayload = {
      sourceUrl: normalizedUrl,
      domain: new URL(normalizedUrl).hostname,
      favicons,
      totalFound: candidateLinks.length,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch favicons',
      },
      { status: 500 },
    );
  }
}
