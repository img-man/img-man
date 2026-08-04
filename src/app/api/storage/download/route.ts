// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import {
  downloadToBuffer,
  getBucketByName,
  getGcsBucket,
  verifyStorageProxyToken,
} from '@/lib/storage';

async function resolveStorageDownloadTarget(token: string) {
  const payload = verifyStorageProxyToken(token);
  const bucket = payload.bucketName
    ? payload.orgId
      ? await getBucketByName(payload.bucketName, payload.orgId)
      : getBucketByName(payload.bucketName)
    : payload.orgId
      ? await getGcsBucket(payload.orgId)
      : getGcsBucket();
  const file = bucket.file(payload.objectPath);
  const [metadata] = await file.getMetadata();
  const fileName = payload.fileName || payload.objectPath.split('/').pop() || 'asset';

  return { payload, metadata, fileName };
}

function buildStorageDownloadHeaders(
  payload: {
    contentType?: string;
  },
  metadata: {
    contentType?: string;
  },
  fileName: string,
  contentLength?: string,
) {
  const headers: Record<string, string> = {
    'Content-Type':
      payload.contentType || metadata.contentType || 'application/octet-stream',
    'Content-Disposition': `inline; filename="${fileName}"`,
    'Cache-Control': 'private, max-age=300',
  };

  if (contentLength) {
    headers['Content-Length'] = contentLength;
  }

  return headers;
}

function getStorageDownloadErrorStatus(error: unknown, message: string) {
  if (message.includes('expired')) {
    return 410;
  }

  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? Number((error as { code?: number | string }).code)
      : NaN;

  if (Number.isFinite(code) && code >= 400 && code < 600) {
    return code;
  }

  if (
    message.includes('No such object') ||
    message.includes('NoSuchKey') ||
    message.includes('not found')
  ) {
    return 404;
  }

  return 401;
}

function getToken(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return null;
  }

  return token;
}

export async function HEAD(req: NextRequest) {
  const token = getToken(req);

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  try {
    const { payload, metadata, fileName } = await resolveStorageDownloadTarget(token);

    return new NextResponse(null, {
      headers: buildStorageDownloadHeaders(payload, metadata, fileName),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    const status = getStorageDownloadErrorStatus(error, message);

    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(req: NextRequest) {
  const token = getToken(req);

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  try {
    const { payload, metadata, fileName } = await resolveStorageDownloadTarget(token);
    const buffer = await downloadToBuffer(
      payload.objectPath,
      payload.bucketName,
      payload.orgId,
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: buildStorageDownloadHeaders(
        payload,
        metadata,
        fileName,
        String(buffer.length),
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid token';
    const status = getStorageDownloadErrorStatus(error, message);

    return NextResponse.json({ error: message }, { status });
  }
}
