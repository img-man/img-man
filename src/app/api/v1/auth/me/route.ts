// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { AccessToken, ApiKey, OrgMembership, MemberGroup, Organization, User } from '@/models';
import { getSignedDownloadUrl } from '@/lib/storage';
import type { Role } from '@/lib/permissions';

/**
 * GET /api/v1/auth/me
 *
 * Returns the current user's context when authenticated via Access Token (imgt_...).
 * Used by the embedded dashboard to bootstrap role/section/org info without session auth.
 *
 * Headers:
 * Authorization: Bearer imgt_...
 */
export async function GET(req: NextRequest) {
 try {
 const authHeader = req.headers.get('authorization');
 if (!authHeader?.startsWith('Bearer imgt_')) {
 return NextResponse.json(
 { error: 'Access token required (imgt_...)' },
 { status: 401 },
 );
 }

 const token = authHeader.slice(7).trim();

 await connectToDatabase();

 // Find the access token
 const accessToken = await AccessToken.findOne({ token, isActive: true });
 if (!accessToken) {
 return NextResponse.json(
 { error: 'Invalid or expired access token' },
 { status: 401 },
 );
 }

 // Check expiry
 if (accessToken.expiresAt && accessToken.expiresAt < new Date()) {
 return NextResponse.json(
 { error: 'Access token has expired' },
 { status: 401 },
 );
 }

 // Update last used
 await AccessToken.findByIdAndUpdate(accessToken._id, { lastUsedAt: new Date() });

 // Get organization info
 const org = await Organization.findById(accessToken.orgId)
 .select('name slug logoUrl storageConfig sectionAccess themeColor embedConfig aiFeatureConfig')
 .lean();

 if (!org) {
 return NextResponse.json(
 { error: 'Organization not found' },
 { status: 404 },
 );
 }

 // Get membership for section access and detailed role info
 const membership = await OrgMembership.findOne({
 orgId: accessToken.orgId,
 $or: [
 ...(accessToken.email ? [{ email: accessToken.email }] : []),
 ...(accessToken.userId ? [{ userId: accessToken.userId }] : []),
 ],
 status: 'active',
 }).lean();

 const orgDetails = org as
 | {
  name?: string;
  slug?: string;
  logoUrl?: string | null;
  themeColor?: string | null;
  storageConfig?: { bucket?: string };
  sectionAccess?: Map<string, number> | Record<string, number>;
  embedConfig?: {
   showLogo?: boolean;
   showName?: boolean;
   defaultNewUserRole?: 'editor' | 'viewer';
   allowedEmailDomains?: string[];
  };
  aiFeatureConfig?: Map<string, unknown> | Record<string, unknown>;
 }
 | null;

 // Merge org-level sectionAccess with member-level sectionAccess
 const orgSectionAccess = orgDetails?.sectionAccess;
 const orgSections: Record<string, number> = orgSectionAccess instanceof Map
 ? Object.fromEntries(orgSectionAccess)
 : orgSectionAccess ?? {};

 const memberSectionAccess = (membership as unknown as { sectionAccess?: Map<string, number> | Record<string, number> })?.sectionAccess;
 const memberSections: Record<string, number> = memberSectionAccess instanceof Map
 ? Object.fromEntries(memberSectionAccess)
 : memberSectionAccess ?? {};

 // Member-level restrictions override (more restrictive)
 const sectionAccess = { ...orgSections, ...memberSections };

 // Collect access rules from membership + groups
 let accessRules = [...(membership?.accessRules ?? [])];
 if (membership?._id) {
 const groups = await MemberGroup.find({
 orgId: accessToken.orgId,
 memberIds: membership._id,
 }).select('accessRules').lean();

 for (const g of groups) {
 if (g.accessRules) {
 accessRules = accessRules.concat(g.accessRules as typeof accessRules);
 }
 }
 }

 // Get user info if userId is linked
 let userName: string | null = null;
 let userImage: string | null = null;
 if (accessToken.userId) {
 const user = await User.findById(accessToken.userId).select('name image').lean();
 if (user) {
 userName = user.name;
 userImage = (user as Record<string, unknown>).image as string | null;
 }
 }

 // Get API key folder scope
 let folderScope: string | null = null;
 if (accessToken.apiKeyId) {
 const apiKey = await ApiKey.findById(accessToken.apiKeyId).select('folderScope').lean();
 folderScope = (apiKey as Record<string, unknown>)?.folderScope as string | null ?? null;
 }

 const role: Role = (accessToken.role as Role) ?? 'viewer';

 // Resolve logo URL: if it's a storage path, generate a signed URL
 let resolvedLogoUrl: string | null = orgDetails?.logoUrl ?? null;
 if (resolvedLogoUrl && !resolvedLogoUrl.startsWith('http')) {
 try {
 const bucketOverride = orgDetails?.storageConfig;
 resolvedLogoUrl = await getSignedDownloadUrl(
 resolvedLogoUrl,
 7 * 24 * 60 * 60, // 7 days
 bucketOverride?.bucket || undefined,
				String(accessToken.orgId),
 );
 } catch {
 resolvedLogoUrl = null;
 }
 }

 // Resolve aiFeatureConfig
 const rawAiConfig = orgDetails?.aiFeatureConfig;
 const aiFeatureConfig: Record<string, unknown> = rawAiConfig instanceof Map
 ? Object.fromEntries(rawAiConfig)
 : (rawAiConfig as Record<string, unknown>) ?? {};

 return NextResponse.json({
 userId: accessToken.userId?.toString() ?? null,
 email: accessToken.email ?? null,
 name: userName ?? (membership as unknown as { inviteName?: string })?.inviteName ?? null,
 image: userImage,
 orgId: accessToken.orgId.toString(),
 orgSlug: orgDetails?.slug ?? '',
 orgName: orgDetails?.name ?? '',
 logoUrl: resolvedLogoUrl,
 themeColor: orgDetails?.themeColor ?? 'violet',
 embedConfig: orgDetails?.embedConfig ?? { showLogo: true, showName: true },
 role,
 sectionAccess,
 accessRules,
 folderScope,
 aiFeatureConfig,
 });
 } catch (err) {
 console.error('[/api/v1/auth/me] Error:', err);
 return NextResponse.json({ error: 'Server error' }, { status: 500 });
 }
}
