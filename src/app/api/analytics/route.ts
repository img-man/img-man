// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, Asset, Folder, Design, AiJob, OrgMembership } from '@/models';
import mongoose from 'mongoose';
import { isSectionRestricted } from '@/lib/auth-context';
import type { Role } from '@/lib/permissions';

/**
 * GET /api/analytics
 * Returns aggregated dashboard stats for the authenticated user's org.
 * All queries run in parallel for maximum performance.
 */
export async function GET() {
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
 if (await isSectionRestricted(String(user.orgId), (user.role as Role) ?? 'viewer', 'dashboard')) {
 return NextResponse.json({ error: 'Access to dashboard is restricted for your role' }, { status: 403 });
 }

 const orgId = new mongoose.Types.ObjectId(String(user.orgId));

 // Run all aggregations in parallel — zero waterfalls
 const [
 assetStats,
 mimeBreakdown,
 folderCount,
 designCount,
 aiJobStats,
 aiJobTimeline,
 recentUploads,
 storageGrowth,
 trashCount,
 memberCount,
 ] = await Promise.all([
 // 1. Asset totals: count + total storage bytes (excluding trashed)
 Asset.aggregate([
 { $match: { orgId, isDeleted: { $ne: true } } },
 {
 $group: {
 _id: null,
 totalAssets: { $sum: 1 },
 totalBytes: { $sum: '$sizeBytes' },
 withThumbnails: {
 $sum: { $cond: [{ $ifNull: ['$thumbnailBase64', false] }, 1, 0] },
 },
 withAiTags: {
 $sum: { $cond: ['$aiTagsGenerated', 1, 0] },
 },
 withFaces: {
 $sum: {
 $cond: [{ $gt: [{ $size: { $ifNull: ['$faces', []] } }, 0] }, 1, 0],
 },
 },
 },
 },
 ]),

 // 2. Assets by MIME type (excluding trashed)
 Asset.aggregate([
 { $match: { orgId, isDeleted: { $ne: true } } },
 { $group: { _id: '$mimeType', count: { $sum: 1 } } },
 { $sort: { count: -1 } },
 { $limit: 10 },
 ]),

 // 3. Total folders
 Folder.countDocuments({ orgId }),

 // 4. Total designs
 Design.countDocuments({ orgId }),

 // 5. AI job stats by type + status
 AiJob.aggregate([
 { $match: { orgId } },
 {
 $group: {
 _id: { type: '$type', status: '$status' },
 count: { $sum: 1 },
 },
 },
 ]),

 // 6. AI job timeline (last 30 days — grouped by day)
 AiJob.aggregate([
 {
 $match: {
 orgId,
 createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
 },
 },
 {
 $group: {
 _id: {
 date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
 type: '$type',
 },
 count: { $sum: 1 },
 },
 },
 { $sort: { '_id.date': 1 } },
 ]),

 // 7. Recent uploads (last 5, excluding trashed)
 Asset.find({ orgId, isDeleted: { $ne: true } })
 .sort({ createdAt: -1 })
 .limit(5)
 .select('name mimeType sizeBytes createdAt thumbnailBase64')
 .lean(),

 // 8. Storage growth (last 30 days — excluding trashed)
 Asset.aggregate([
 {
 $match: {
 orgId,
 isDeleted: { $ne: true },
 createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
 },
 },
 {
 $group: {
 _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
 bytes: { $sum: '$sizeBytes' },
 count: { $sum: 1 },
 },
 },
 { $sort: { _id: 1 } },
 ]),

 // 9. Trash count
 Asset.countDocuments({ orgId, isDeleted: true }),

 // 10. Member count (active members in org)
 OrgMembership.countDocuments({ orgId, status: 'active' }),
 ]);

 // Flatten asset stats
 const stats = assetStats[0] ?? {
 totalAssets: 0,
 totalBytes: 0,
 withThumbnails: 0,
 withAiTags: 0,
 withFaces: 0,
 };

 // Transform AI job stats into a structured object
 const aiUsage: Record<string, { completed: number; failed: number; pending: number; total: number }> = {};
 for (const row of aiJobStats) {
 const type = row._id.type as string;
 const status = row._id.status as string;
 if (!aiUsage[type]) {
 aiUsage[type] = { completed: 0, failed: 0, pending: 0, total: 0 };
 }
 aiUsage[type][status as 'completed' | 'failed' | 'pending'] = row.count;
 aiUsage[type].total += row.count;
 }

 return NextResponse.json({
 overview: {
 totalAssets: stats.totalAssets,
 totalStorageBytes: stats.totalBytes,
 totalFolders: folderCount,
 totalDesigns: designCount,
 assetsWithAiTags: stats.withAiTags,
 assetsWithFaces: stats.withFaces,
 assetsWithThumbnails: stats.withThumbnails,
 trashCount,
 memberCount,
 },
 mimeBreakdown: mimeBreakdown.map((r: { _id: string; count: number }) => ({
 mimeType: r._id,
 count: r.count,
 })),
 aiUsage,
 aiTimeline: aiJobTimeline.map((r: { _id: { date: string; type: string }; count: number }) => ({
 date: r._id.date,
 type: r._id.type,
 count: r.count,
 })),
 recentUploads: recentUploads.map((a) => ({
 _id: String(a._id),
 name: a.name,
 mimeType: a.mimeType,
 sizeBytes: a.sizeBytes,
 createdAt: a.createdAt,
 thumbnailBase64: a.thumbnailBase64 ?? null,
 })),
 storageGrowth: storageGrowth.map((r: { _id: string; bytes: number; count: number }) => ({
 date: r._id,
 bytes: r.bytes,
 count: r.count,
 })),
 });
}
