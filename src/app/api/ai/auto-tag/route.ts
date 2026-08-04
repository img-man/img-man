// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, AiJob, User } from '@/models';
import { analyzeImageTags } from '@/lib/ai-analysis';
import { getSignedDownloadUrl } from '@/lib/storage';
import { canPerform, type Role } from '@/lib/permissions';
import { checkConcurrency } from '@/lib/ai-concurrency';

/**
 * POST /api/ai/auto-tag
 * Body: { assetId, forceRegenerate?: boolean }
 * Uses the active org AI provider to analyze image content and extract tags.
 * - If AI tags already exist and !forceRegenerate, copies original AI tags back (revert).
 * - If not yet tagged, runs AI analysis.
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

 const { assetId, forceRegenerate } = await req.json();
 if (!assetId) {
 return NextResponse.json({ error: 'assetId required' }, { status: 400 });
 }

 const asset = await Asset.findOne({ _id: assetId, orgId: user.orgId });
 if (!asset) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 // If AI tags were already generated and user is not forcing regenerate,
 // revert: restore original AI tags from the snapshot
 if (asset.aiTagsGenerated && !forceRegenerate) {
 asset.tags = [...new Set([...asset.originalAiTags])];
 await asset.save();
 return NextResponse.json({
 tags: asset.tags,
 userTags: asset.userTags,
 reverted: true,
 message: 'AI tags restored from original snapshot.',
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
 type: 'auto_tag',
 status: 'processing',
 startedAt: new Date(),
 });

 try {
 const imageUrl = await getSignedDownloadUrl(asset.storageKey, 60 * 10, undefined, String(user.orgId));
 const { description, parsed, tags } = await analyzeImageTags({
 imageUrl,
 mimeType: asset.mimeType,
 orgId: String(user.orgId),
 });

 // Store AI tags and snapshot for future revert
 asset.tags = tags;
 asset.originalAiTags = [...tags]; // snapshot
 asset.aiTagsGenerated = true;
 await asset.save();

  job.status = 'completed';
 job.result = parsed;
 job.completedAt = new Date();
 await job.save();

 return NextResponse.json({
 tags: asset.tags,
 userTags: asset.userTags,
 description,
 });
 } catch (err) {
 job.status = 'failed';
 job.error = err instanceof Error ? err.message : String(err);
 job.completedAt = new Date();
  await job.save();

  return NextResponse.json(
  { error: 'AI processing failed', details: job.error },
 { status: 500 },
 );
 }
}
