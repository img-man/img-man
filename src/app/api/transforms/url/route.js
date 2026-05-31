import { NextResponse } from 'next/server.js';
import { buildTransformUrl } from '../../../../lib/transform-url.js';

export function parseTransformParams(searchParams) {
  return {
    assetId: searchParams.get('assetId') ?? '',
    width: parseOptionalInteger(searchParams.get('width')),
    height: parseOptionalInteger(searchParams.get('height')),
    format: searchParams.get('format') ?? undefined,
    quality: parseOptionalInteger(searchParams.get('quality')),
    fit: searchParams.get('fit') ?? undefined,
    version: searchParams.get('version') ?? undefined,
  };
}

export async function GET(request) {
  const url = new URL(request.url);

  try {
    const params = parseTransformParams(url.searchParams);
    const result = buildTransformUrl(params, {
      baseUrl: `${url.protocol}//${url.host}`,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      params,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 400 },
    );
  }
}

function parseOptionalInteger(value) {
  if (value === null || value === '') {
    return undefined;
  }

  if (!/^-?\d+$/.test(value)) {
    return Number.NaN;
  }

  return Number.parseInt(value, 10);
}
