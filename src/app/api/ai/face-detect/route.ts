// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, AiJob, User } from '@/models';
import { detectImageFaces } from '@/lib/ai-analysis';
import { getSignedDownloadUrl } from '@/lib/storage';
import { canPerform, type Role } from '@/lib/permissions';
import { checkConcurrency } from '@/lib/ai-concurrency';

/**
 * POST /api/ai/face-detect
 * Body: { assetId }
 * Uses the active org AI provider to detect faces and store bounding boxes + emotions.
 */
export async function POST(req: NextRequest) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 // RBAC: require AI permission (editor+)
 if (!canPerform((user.role as Role) ?? 'viewer', 'ai')) {
 return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 }

 const { assetId } = await req.json();
 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 const asset = await Asset.findOne({ _id: assetId, orgId: user.orgId });
 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 if (!asset.mimeType.startsWith('image/')) {
 return NextResponse.json(
 { error: 'Face detection only for images' },
 { status: 400 },
 );
 }

 // If faces already detected, return existing
 if (asset.faces && asset.faces.length > 0) {
 return NextResponse.json({
 faces: asset.faces,
 alreadyDetected: true,
 });
 }

  // Concurrency check
  const concurrency = await checkConcurrency(user.orgId.toString());
 if (!concurrency.allowed) {
 return NextResponse.json(
 { error: `Too many active AI jobs (${concurrency.active}/${concurrency.limit}). Please wait.` },
 { status: 429 },
 );
 }

 // Create AI job record
 const job = await AiJob.create({
 orgId: user.orgId,
 assetId: asset._id,
 userId: user._id,
 type: 'face_detect',
 status: 'processing',
 startedAt: new Date(),
 });

 try {
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, String(user.orgId));
 const { faces } = await detectImageFaces({
 imageUrl,
 imageHeight: asset.height ?? 1000,
 imageWidth: asset.width ?? 1000,
 mimeType: asset.mimeType,
 orgId: String(user.orgId),
 });

 // Update asset
 asset.faces = faces;
 await asset.save();

  job.status = 'completed';
 job.result = { facesDetected: faces.length, faces };
 job.completedAt = new Date();
 await job.save();

 return NextResponse.json({ faces, totalFaces: faces.length });
 } catch (err) {
 job.status = 'failed';
 job.error = err instanceof Error ? err.message : String(err);
 job.completedAt = new Date();
  await job.save();

  return NextResponse.json(
  { error: 'Face detection failed', details: job.error },
 { status: 500 },
 );
 }
}
