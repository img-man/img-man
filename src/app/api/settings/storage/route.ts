// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth-context';
import { connectToDatabase } from '@/lib/db';
import { Organization } from '@/models';
import {
 createManagedStorageBucket,
 buildByocStorageConfigUpdate,
 buildManagedStorageConfigUpdate,
 validateExternalBucket,
} from '@/lib/storage';
import { STORAGE_PROVIDERS, type StorageProviderId } from '@/types/providers';

/**
 * POST /api/settings/storage
 * Connect or provision a storage bucket for the organization.
 *
 * Body (auto-provision):
 * { mode: 'auto' }
 * → Creates a dedicated GCS bucket for the org
 *
 * Body (BYOC):
 * { mode: 'byoc', provider: 'gcp'|'aws'|'azure', bucket: string, region?: string, credentials?: string, vertexApiKey?: string }
 * → Validates and connects an external bucket
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requirePermission('manage_settings');
 await connectToDatabase();

 const body = await req.json();
 const { mode } = body as { mode?: string };

 if (mode === 'auto') {
 // Auto-provision: create a dedicated GCS bucket
 const org = await Organization.findById(ctx.orgId).lean();
 if (!org) {
 return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
 }

 // Don't re-create if already provisioned
 if (org.storageConfig?.bucket && !org.storageConfig.isByoc) {
 return NextResponse.json({
 message: 'Bucket already provisioned',
 bucket: org.storageConfig.bucket,
 });
 }

 const slug = org.slug as string;
 const provider: StorageProviderId = 'gcp';
 const bucketName = await createManagedStorageBucket(provider, slug);

 await Organization.updateOne(
 { _id: ctx.orgId },
 {
 $set: buildManagedStorageConfigUpdate(provider, bucketName),
 },
 );

 return NextResponse.json({
 message: 'Dedicated bucket created',
 bucket: bucketName,
 provider: 'gcp',
 }, { status: 201 });
 }

 if (mode === 'byoc') {
 // Bring Your Own Cloud
 const { provider, bucket, region, credentials, vertexApiKey } = body as {
 provider?: string;
 bucket?: string;
 region?: string;
 credentials?: string;
 vertexApiKey?: string;
 };

 if (!provider || !STORAGE_PROVIDERS.includes(provider as StorageProviderId)) {
 return NextResponse.json(
 { error: 'provider must be "gcp", "aws", or "azure"' },
 { status: 400 },
 );
 }
 if (!bucket || !bucket.trim()) {
 return NextResponse.json(
 { error: 'bucket name is required' },
 { status: 400 },
 );
 }
 if (provider === 'aws' && !region?.trim()) {
 return NextResponse.json(
 { error: 'region is required for AWS S3 buckets' },
 { status: 400 },
 );
 }

 // Validate bucket access
 const validation = await validateExternalBucket(
 provider as StorageProviderId,
 bucket.trim(),
 credentials,
 region,
 );

 if (!validation.valid) {
 return NextResponse.json(
 { error: validation.error ?? 'Cannot access bucket' },
 { status: 422 },
 );
 }

 await Organization.updateOne(
 { _id: ctx.orgId },
 {
 $set: buildByocStorageConfigUpdate(provider as StorageProviderId, {
  bucket: bucket.trim(),
  region,
  credentials,
  vertexApiKey,
 }),
 },
 );

 return NextResponse.json({
 message: 'External bucket connected',
 bucket: bucket.trim(),
 provider,
 });
 }

 return NextResponse.json(
 { error: 'mode must be "auto" or "byoc"' },
 { status: 400 },
 );
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
