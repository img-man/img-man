// SPDX-License-Identifier: Apache-2.0
/**
 * POST /api/tools/pdf-protect
 *
 * Accepts a PDF file + password(s) via FormData and returns
 * an encrypted PDF with standard password protection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { encryptPdf } from '@/lib/pdf-encrypt';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const rawFile = formData.get('file');
    const rawUserPassword = formData.get('userPassword');
    const rawOwnerPassword = formData.get('ownerPassword');

    if (!(rawFile instanceof File)) {
      return NextResponse.json(
        { error: 'Invalid or missing file' },
        { status: 400 },
      );
    }

    if (typeof rawUserPassword !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing userPassword' },
        { status: 400 },
      );
    }

    const file = rawFile;
    const userPassword = rawUserPassword.trim();
    if (userPassword.length === 0) {
      return NextResponse.json(
        { error: 'userPassword cannot be empty or whitespace only' },
        { status: 400 },
      );
    }
    const ownerPassword =
      typeof rawOwnerPassword === 'string' ? rawOwnerPassword : null;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const encrypted = await encryptPdf(bytes, {
      userPassword,
      ownerPassword: ownerPassword || userPassword,
    });

    return new NextResponse(Buffer.from(encrypted), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="protected.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Encryption failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
