// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';

/**
 * POST /api/assets/:id/copy
 * Creates a reference copy of an asset.
 * The copy points to the same bucket object (storageKey) — no data duplication.
 * Copies are marked as isCopy: true and are non-editable.
 */
export async function POST(
 req: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 if (!user?.orgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }

 const { id } = await params;

 const original = await Asset.findOne({
 _id: id,
 orgId: user.orgId,
 isDeleted: { $ne: true },
 }).lean();

 if (!original) {
 return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
 }

 // Optional: allow specifying a target folder
 let targetFolderId = original.folderId;
 try {
 const body = await req.json().catch(() => ({}));
 if (body.folderId !== undefined) {
 targetFolderId = body.folderId || null;
 }
 } catch {
 // No body — use same folder
 }

 const copy = await Asset.create({
 orgId: user.orgId,
 folderId: targetFolderId,
 uploadedById: user._id,
 name: `${original.name} (Copy)`,
 originalName: original.originalName,
 storageKey: original.storageKey, // SAME bucket object — no duplication
 thumbnailStorageKey: original.thumbnailStorageKey,
 thumbnailBase64: original.thumbnailBase64,
 mimeType: original.mimeType,
 sizeBytes: original.sizeBytes,
 width: original.width,
 height: original.height,
 blurHash: original.blurHash,
 tags: [...(original.tags || [])],
 userTags: [...(original.userTags || [])],
 originalAiTags: [...(original.originalAiTags || [])],
 aiTagsGenerated: original.aiTagsGenerated,
 faces: [...(original.faces || [])],
 variants: [], // Copies don't inherit variants
 isCopy: true,
 copyOfAssetId: original._id,
 });

 return NextResponse.json({ asset: copy }, { status: 201 });
}
