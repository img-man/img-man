// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User, Organization } from '@/models';
import { getSignedDownloadUrl, getGcsBucket } from '@/lib/storage';
import { isSectionRestricted } from '@/lib/auth-context';
import type { Role } from '@/lib/permissions';

/**
 * GET /api/trash
 * Returns paginated soft-deleted assets for the user's org.
 * Each item includes daysRemaining before auto-purge.
 */
export async function GET(req: NextRequest) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 // Section access enforcement
 if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'trash')) {
 return NextResponse.json({ error: 'Access to trash is restricted for your role' }, { status: 403 });
 }

 // Get retention setting
 const org = await Organization.findById(user.orgId).select('trashRetentionDays').lean();
 const retentionDays = (org as { trashRetentionDays?: number })?.trashRetentionDays ?? 30;

 const { searchParams } = req.nextUrl;
 const page = Math.max(1, Number(searchParams.get('page')) || 1);
 const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 30));
 const skip = (page - 1) * limit;

 const filter = { orgId: user.orgId, isDeleted: true };

 const [assets, total] = await Promise.all([
 Asset.find(filter)
 .sort({ deletedAt: -1 })
 .skip(skip)
 .limit(limit)
 .lean(),
 Asset.countDocuments(filter),
 ]);

 // Generate signed thumbnail URLs for display (legacy fallback)
 const enriched = await Promise.all(
 assets.map(async (a) => {
 let thumbnailUrl: string | null = null;
 if (!a.thumbnailBase64) {
 const key = a.thumbnailStorageKey || a.storageKey;
 try {
				thumbnailUrl = await getSignedDownloadUrl(key, 60 * 60, undefined, String(user.orgId));
 } catch {
 /* GCS file may already be gone */
 }
 }

 // Compute days remaining
 const deletedAt = a.deletedAt ? new Date(a.deletedAt).getTime() : Date.now();
 const expiresAt = deletedAt + retentionDays * 24 * 60 * 60 * 1000;
 const daysRemaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));

 return {
 ...a,
 thumbnailUrl: a.thumbnailBase64 ? null : thumbnailUrl,
 daysRemaining,
 retentionDays,
 };
 }),
 );

 return NextResponse.json({
 assets: enriched,
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 retentionDays,
 });
}

/**
 * POST /api/trash
 * Body: { action: 'restore' | 'purge' | 'empty', ids?: string[] }
 * - restore: sets isDeleted=false, deletedAt=null for given IDs
 * - purge: permanently deletes given IDs + GCS files
 * - empty: permanently deletes ALL trashed assets for the org
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

 // Section access enforcement
 if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'trash')) {
 return NextResponse.json({ error: 'Access to trash is restricted for your role' }, { status: 403 });
 }

 const body = await req.json();
 const { action, ids } = body;

 switch (action) {
 case 'restore': {
 if (!Array.isArray(ids) || ids.length === 0) {
 return NextResponse.json({ error: 'No asset IDs provided' }, { status: 400 });
 }
 const result = await Asset.updateMany(
 { _id: { $in: ids }, orgId: user.orgId, isDeleted: true },
 { $set: { isDeleted: false, deletedAt: null } },
 );
 console.log(`[Trash] Restored ${result.modifiedCount} assets`);
 return NextResponse.json({ success: true, restored: result.modifiedCount });
 }

 case 'purge': {
 if (!Array.isArray(ids) || ids.length === 0) {
 return NextResponse.json({ error: 'No asset IDs provided' }, { status: 400 });
 }
 const assets = await Asset.find({
 _id: { $in: ids },
 orgId: user.orgId,
 isDeleted: true,
 })
 .select('storageKey thumbnailStorageKey variants')
 .lean();

 const result = await Asset.deleteMany({
 _id: { $in: ids },
 orgId: user.orgId,
 isDeleted: true,
 });

 // Delete from GCS in background
		deleteGcsFiles(assets, String(user.orgId)).catch(console.error);

 console.log(`[Trash] Permanently purged ${result.deletedCount} assets`);
 return NextResponse.json({ success: true, purged: result.deletedCount });
 }

 case 'empty': {
 const assets = await Asset.find({ orgId: user.orgId, isDeleted: true })
 .select('storageKey thumbnailStorageKey variants')
 .lean();

 const result = await Asset.deleteMany({ orgId: user.orgId, isDeleted: true });

 // Delete from GCS in background
		deleteGcsFiles(assets, String(user.orgId)).catch(console.error);

 console.log(`[Trash] Emptied trash — permanently purged ${result.deletedCount} assets`);
 return NextResponse.json({ success: true, purged: result.deletedCount });
 }

 default:
 return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
 }
}

/* ─── Helper: Delete GCS files for permanently purged assets ──── */
async function deleteGcsFiles(
 assets: Array<{
 storageKey: string;
 thumbnailStorageKey?: string;
 variants?: Array<{ storageKey: string }>;
 }>,
 orgId: string,
) {
 const bucket = await getGcsBucket(orgId);
 const deletePromises = assets.flatMap((asset) => {
 const keys = [asset.storageKey];
 if (asset.thumbnailStorageKey) keys.push(asset.thumbnailStorageKey);
 if (asset.variants?.length) {
 keys.push(...asset.variants.map((v) => v.storageKey));
 }
 return keys.map((key) =>
 bucket.file(key).delete({ ignoreNotFound: true }),
 );
 });
 Promise.allSettled(deletePromises).catch(console.error);
}
