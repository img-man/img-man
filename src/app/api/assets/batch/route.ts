// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { Asset, User } from '@/models';
import { canPerform, type Role } from '@/lib/permissions';

/**
 * POST /api/assets/batch
 * Body: { action: 'delete' | 'move' | 'tag', ids: string[], folderId?, tags? }
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

 // RBAC: require edit permission for batch operations (editor+)
 if (!canPerform((user.role as Role) ?? 'viewer', 'edit')) {
 return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 }

 const body = await req.json();
 const { action, ids } = body;

 if (!Array.isArray(ids) || ids.length === 0) {
 return NextResponse.json(
 { error: 'No asset IDs provided' },
 { status: 400 },
 );
 }

 if (ids.length > 100) {
 return NextResponse.json(
 { error: 'Maximum 100 assets per batch' },
 { status: 400 },
 );
 }

 const orgFilter = { orgId: user.orgId, _id: { $in: ids }, isDeleted: { $ne: true } };

 switch (action) {
 case 'delete': {
 // Soft-delete: move to trash instead of permanent deletion
 const result = await Asset.updateMany(orgFilter, {
 $set: { isDeleted: true, deletedAt: new Date() },
 });

 console.log(`[Batch] Soft-deleted ${result.modifiedCount} assets (moved to trash)`);
 return NextResponse.json({ success: true, deleted: result.modifiedCount });
 }

 case 'move': {
 const { folderId } = body;
 const result = await Asset.updateMany(orgFilter, {
 $set: { folderId: folderId || null },
 });
 return NextResponse.json({
 success: true,
 modified: result.modifiedCount,
 });
 }

 case 'tag': {
 const { tags, mode } = body; // mode: 'add' | 'remove' | 'set'
 if (!Array.isArray(tags)) {
 return NextResponse.json(
 { error: 'Tags must be an array' },
 { status: 400 },
 );
 }

 const cleanTags = tags.map((t: string) => t.trim()).filter(Boolean);

 if (mode === 'remove') {
 const result = await Asset.updateMany(orgFilter, {
 $pullAll: { tags: cleanTags },
 });
 return NextResponse.json({
 success: true,
 modified: result.modifiedCount,
 });
 } else if (mode === 'set') {
 const result = await Asset.updateMany(orgFilter, {
 $set: { tags: cleanTags },
 });
 return NextResponse.json({
 success: true,
 modified: result.modifiedCount,
 });
 } else {
 // default: add
 const result = await Asset.updateMany(orgFilter, {
 $addToSet: { tags: { $each: cleanTags } },
 });
 return NextResponse.json({
 success: true,
 modified: result.modifiedCount,
 });
 }
 }

 default:
 return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
 }
}
