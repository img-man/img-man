// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { analyzeWebsiteFavicons, normalizeWebsiteUrl } from '@/lib/favicon-analysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const submittedUrl = typeof body?.url === 'string' ? body.url : '';
    const normalizedUrl = normalizeWebsiteUrl(submittedUrl);
    const result = await analyzeWebsiteFavicons(normalizedUrl);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to analyze favicon setup';
    const status = message.toLowerCase().includes('url') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
