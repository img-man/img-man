// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import { Organization } from '@/models';
import { uploadBuffer, getSignedDownloadUrl } from '@/lib/storage';
import { trackBandwidth } from '@/lib/bandwidth';

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

/**
 * POST /api/settings/logo
 * Upload an organization logo. Accepts multipart/form-data with a "file" field.
 * Requires admin+ permission (manage_settings).
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requirePermission('manage_settings');
 await connectToDatabase();

 const formData = await req.formData();
 const file = formData.get('file') as File | null;

 if (!file) {
 return NextResponse.json({ error: 'No file provided' }, { status: 400 });
 }

 if (!ALLOWED_TYPES.includes(file.type)) {
 return NextResponse.json(
 { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
 { status: 400 },
 );
 }

 if (file.size > MAX_LOGO_SIZE) {
 return NextResponse.json(
 { error: 'File too large. Maximum size is 2MB' },
 { status: 400 },
 );
 }

 // Read file into buffer
 const arrayBuffer = await file.arrayBuffer();
 const buffer = Buffer.from(arrayBuffer);

 // Double-check actual buffer length (file.size may be unreliable in some envs)
 if (buffer.length > MAX_LOGO_SIZE) {
 return NextResponse.json(
 { error: 'File too large. Maximum size is 2MB' },
 { status: 400 },
 );
 }

 // Determine extension
 const ext = file.type.split('/')[1]?.replace('svg+xml', 'svg') ?? 'png';
 const storagePath = `branding/${ctx.orgId}/logo.${ext}`;

 // Get org's bucket (if per-org isolation is enabled)
 const org = await Organization.findById(ctx.orgId).lean();
 const bucketOverride = org?.storageConfig?.bucket || undefined;

 // Upload to the org's configured storage provider
 await uploadBuffer(storagePath, buffer, file.type, undefined, bucketOverride, String(ctx.orgId));

 // Also get a signed URL as fallback for immediate display
 const signedUrl = await getSignedDownloadUrl(
 storagePath,
 7 * 24 * 60 * 60,
 bucketOverride,
 String(ctx.orgId),
 );

 // Persist the storage path so downstream routes can mint provider-specific URLs.
 const logoUrlToStore = storagePath;

 // Update org with the storage path.
 await Organization.updateOne(
 { _id: ctx.orgId },
 { $set: { logoUrl: logoUrlToStore } },
 );

 // Track upload bandwidth
 await trackBandwidth(ctx.orgId, 'upload', buffer.length);

 return NextResponse.json({
 logoUrl: signedUrl,
 publicUrl: signedUrl,
 storagePath,
 size: buffer.length,
 });
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
