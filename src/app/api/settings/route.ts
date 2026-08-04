// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { connectToDatabase } from '@/lib/db';
import { User, Organization } from '@/models';
import { encryptStoredOpenAiApiKey } from '@/lib/ai-provider-config';
import { getSignedDownloadUrl } from '@/lib/storage';
import { isSectionRestricted } from '@/lib/auth-context';
import type { Role } from '@/lib/permissions';
import { bulkSetFolderAccessMode } from '@/lib/folder-access';
import { AI_PROVIDERS, type AiProviderId } from '@/types/providers';

const DEFAULT_EMBED_CONFIG = {
 showLogo: true,
 showName: true,
 defaultNewUserRole: 'editor' as const,
 allowedEmailDomains: [] as string[],
};

type OrganizationSettingsSnapshot = {
 name?: string;
 slug?: string;
 plan?: string;
 trashRetentionDays?: number;
 usage?: {
  storageBytes?: number;
  bandwidth?: number;
  aiCredits?: number;
 };
 logoUrl?: string | null;
 storageConfig?: {
  provider?: string;
  bucket?: string;
  isByoc?: boolean;
  vertexApiKey?: string;
 };
 aiProviderConfig?: {
  provider?: string;
  vertexApiKey?: string;
  openAiApiKey?: string;
 };
 aiFeatureConfig?: Record<string, unknown>;
 sectionAccess?: Record<string, number>;
 themeColor?: string;
 embedConfig?: {
  showLogo?: boolean;
  showName?: boolean;
  defaultNewUserRole?: 'editor' | 'viewer';
  allowedEmailDomains?: string[];
 };
 defaultFolderAccessMode?: 'restricted' | 'flexible';
 analyticsConfig?: {
  enabled?: boolean;
  rawRetentionDays?: number;
  maxRawRecordsPerAsset?: number;
 };
};

function normalizeAllowedEmailDomain(value: string): string | null {
 const normalized = value.trim().toLowerCase().replace(/^@+/, '');
 if (!normalized) return null;
 if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized)) return null;
 return normalized;
}

function normalizeAllowedEmailDomains(values: unknown): string[] {
 if (!Array.isArray(values)) return [];
 const unique = new Set<string>();
 for (const value of values) {
 const normalized = typeof value === 'string'
 ? normalizeAllowedEmailDomain(value)
 : null;
 if (normalized) unique.add(normalized);
 }
 return Array.from(unique);
}

/**
 * GET /api/settings
 * Returns organization settings for the current user.
 */
export async function GET() {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 const sessionUser = session.user as Record<string, unknown>;
 const sessionOrgId =
    typeof sessionUser.orgId === 'string' && sessionUser.orgId.trim()
     ? sessionUser.orgId
     : null;
 const sessionRole =
    typeof sessionUser.role === 'string' && sessionUser.role.trim()
     ? (sessionUser.role as Role)
     : 'viewer';

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 const effectiveOrgId = user?.orgId
    ? String(user.orgId)
    : sessionOrgId;
 if (!effectiveOrgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }
 const effectiveRole = ((user?.role as Role) ?? sessionRole) as Role;

 // Section access enforcement
 if (await isSectionRestricted(effectiveOrgId, effectiveRole, 'settings')) {
 return NextResponse.json({ error: 'Access to settings is restricted for your role' }, { status: 403 });
 }

 const org = await Organization.findById(effectiveOrgId)
 .select('name slug plan trashRetentionDays usage logoUrl storageConfig aiProviderConfig aiFeatureConfig sectionAccess themeColor embedConfig defaultFolderAccessMode analyticsConfig')
 .lean();

 if (!org) {
 return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
 }

 const orgSettings = org as OrganizationSettingsSnapshot;

 // Generate a signed URL for the logo if one exists
 let logoSignedUrl: string | null = null;
 if (orgSettings.logoUrl) {
 try {
 const bucketOverride = orgSettings.storageConfig?.bucket || undefined;
 logoSignedUrl = await getSignedDownloadUrl(
 orgSettings.logoUrl,
 7 * 24 * 60 * 60,
 bucketOverride as string | undefined,
 effectiveOrgId,
 );
 } catch {
 // Logo not accessible — skip
 }
 }

 return NextResponse.json({
 settings: {
 orgName: orgSettings.name,
 orgSlug: orgSettings.slug,
 plan: orgSettings.plan,
 trashRetentionDays: orgSettings.trashRetentionDays ?? 30,
 usage: orgSettings.usage,
 logoUrl: logoSignedUrl,
 storageConfig: {
 provider: orgSettings.storageConfig?.provider ?? 'gcp',
 bucket: orgSettings.storageConfig?.bucket ?? '',
 isByoc: orgSettings.storageConfig?.isByoc ?? false,
 hasVertexApiKey: !!orgSettings.aiProviderConfig?.vertexApiKey || !!orgSettings.storageConfig?.vertexApiKey,
 },
 aiProviderConfig: {
 provider: orgSettings.aiProviderConfig?.provider ?? 'vertex',
 hasVertexApiKey: !!orgSettings.aiProviderConfig?.vertexApiKey || !!orgSettings.storageConfig?.vertexApiKey,
 hasOpenAiApiKey: !!orgSettings.aiProviderConfig?.openAiApiKey,
 },
 aiFeatureConfig: orgSettings.aiFeatureConfig ?? {},
 sectionAccess: orgSettings.sectionAccess ?? {},
 themeColor: orgSettings.themeColor ?? 'violet',
 embedConfig: {
 ...DEFAULT_EMBED_CONFIG,
 ...(orgSettings.embedConfig ?? {}),
 },
 defaultFolderAccessMode: orgSettings.defaultFolderAccessMode ?? 'flexible',
 analyticsConfig: orgSettings.analyticsConfig ?? {
 enabled: false,
 rawRetentionDays: 35,
 maxRawRecordsPerAsset: 500,
 },
 },
 });
}

/**
 * PATCH /api/settings
 * Body: { trashRetentionDays?, orgName?, defaultFolderAccessMode?, bulkFolderAccessMode? }
 * Updates organization settings. Validates unique org name.
 */
export async function PATCH(req: NextRequest) {
 const session = await getSession();
 if (!session?.user?.email) {
 return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 }

 const sessionUser = session.user as Record<string, unknown>;
 const sessionOrgId =
    typeof sessionUser.orgId === 'string' && sessionUser.orgId.trim()
     ? sessionUser.orgId
     : null;
 const sessionRole =
    typeof sessionUser.role === 'string' && sessionUser.role.trim()
     ? (sessionUser.role as Role)
     : 'viewer';

 await connectToDatabase();
 const user = await User.findOne({ email: session.user.email }).lean();
 const effectiveOrgId = user?.orgId
    ? String(user.orgId)
    : sessionOrgId;
 if (!effectiveOrgId) {
 return NextResponse.json({ error: 'No organization' }, { status: 400 });
 }
 const effectiveRole = ((user?.role as Role) ?? sessionRole) as Role;

 // Section access enforcement
 if (await isSectionRestricted(effectiveOrgId, effectiveRole, 'settings')) {
 return NextResponse.json({ error: 'Access to settings is restricted for your role' }, { status: 403 });
 }

 // Only owners/admins can change settings
 if (!['owner', 'admin'].includes(effectiveRole)) {
 return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 }

 const body = await req.json();
 const update: Record<string, unknown> = {};

 if (typeof body.trashRetentionDays === 'number') {
 const days = Math.round(body.trashRetentionDays);
 if (days < 30 || days > 90) {
 return NextResponse.json(
 { error: 'trashRetentionDays must be between 30 and 90' },
 { status: 400 },
 );
 }
 update.trashRetentionDays = days;
 }

 if (typeof body.orgName === 'string' && body.orgName.trim()) {
 const newName = body.orgName.trim();

 // Check uniqueness (case-insensitive)
 const existing = await Organization.findOne({
 name: { $regex: new RegExp(`^${newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
 _id: { $ne: effectiveOrgId },
 }).lean();

 if (existing) {
 // Suggest alternatives
 const suggestions = [`${newName}-2`, `${newName}-team`, `${newName}-org`];
 return NextResponse.json(
 {
 error: 'Organization name is already taken',
 suggestions,
 },
 { status: 409 },
 );
 }

 update.name = newName;
 }

 // AI Feature Config
 if (body.aiFeatureConfig && typeof body.aiFeatureConfig === 'object') {
 const validModes = ['enabled', 'disabled', 'auto'];
 for (const [key, val] of Object.entries(body.aiFeatureConfig)) {
 const v = val as { mode?: string; minRole?: number };
 if (v.mode && !validModes.includes(v.mode)) continue;
 if (v.minRole !== undefined && (v.minRole < 1 || v.minRole > 4)) continue;
 update[`aiFeatureConfig.${key}`] = {
 mode: v.mode ?? 'enabled',
 minRole: v.minRole ?? 1,
 };
 }
 }

 // Section Access
 if (body.sectionAccess && typeof body.sectionAccess === 'object') {
 for (const [section, minRole] of Object.entries(body.sectionAccess)) {
 const role = Number(minRole);
 if (role >= 1 && role <= 4) {
 update[`sectionAccess.${section}`] = role;
 }
 }
 }

 // Theme Color
 if (typeof body.themeColor === 'string') {
 const validColors = ['violet', 'blue', 'emerald', 'rose', 'orange', 'amber', 'cyan', 'indigo'];
 if (validColors.includes(body.themeColor)) {
 update.themeColor = body.themeColor;
 }
 }

 if (body.aiProviderConfig && typeof body.aiProviderConfig === 'object') {
 const providerConfig = body.aiProviderConfig as {
 provider?: string;
 openAiApiKey?: string;
 };

 if (
 typeof providerConfig.provider === 'string'
 && AI_PROVIDERS.includes(providerConfig.provider as AiProviderId)
 ) {
 update['aiProviderConfig.provider'] = providerConfig.provider;
 }

 if (typeof providerConfig.openAiApiKey === 'string') {
 update['aiProviderConfig.openAiApiKey'] =
 encryptStoredOpenAiApiKey(providerConfig.openAiApiKey) ?? '';
 }
 }

 // Embed Config
 if (body.embedConfig && typeof body.embedConfig === 'object') {
 if (typeof body.embedConfig.showLogo === 'boolean') {
 update['embedConfig.showLogo'] = body.embedConfig.showLogo;
 }
 if (typeof body.embedConfig.showName === 'boolean') {
 update['embedConfig.showName'] = body.embedConfig.showName;
 }
 if (['editor', 'viewer'].includes(body.embedConfig.defaultNewUserRole)) {
 update['embedConfig.defaultNewUserRole'] = body.embedConfig.defaultNewUserRole;
 }
 if (Array.isArray(body.embedConfig.allowedEmailDomains)) {
 update['embedConfig.allowedEmailDomains'] = normalizeAllowedEmailDomains(body.embedConfig.allowedEmailDomains);
 }
 }

 // Default Folder Access Mode
 if (typeof body.defaultFolderAccessMode === 'string') {
 if (['restricted', 'flexible'].includes(body.defaultFolderAccessMode)) {
 update.defaultFolderAccessMode = body.defaultFolderAccessMode;
 }
 }

 // Asset access analytics
 if (body.analyticsConfig && typeof body.analyticsConfig === 'object') {
 const cfg = body.analyticsConfig as { enabled?: boolean; rawRetentionDays?: number; maxRawRecordsPerAsset?: number };
 if (typeof cfg.enabled === 'boolean') {
 update['analyticsConfig.enabled'] = cfg.enabled;
 }
 if (typeof cfg.rawRetentionDays === 'number') {
 const d = Math.round(cfg.rawRetentionDays);
 if (d >= 7 && d <= 180) update['analyticsConfig.rawRetentionDays'] = d;
 }
 if (typeof cfg.maxRawRecordsPerAsset === 'number') {
 const m = Math.round(cfg.maxRawRecordsPerAsset);
 if (m >= 50 && m <= 5000) update['analyticsConfig.maxRawRecordsPerAsset'] = m;
 }
 }

 // Allow bulk convert without other updates
 const hasBulkConvert = body.bulkFolderAccessMode && ['restricted', 'flexible'].includes(body.bulkFolderAccessMode);

 if (Object.keys(update).length === 0 && !hasBulkConvert) {
 return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
 }

 let org;
 if (Object.keys(update).length > 0) {
 org = await Organization.findByIdAndUpdate(
 effectiveOrgId,
 { $set: update },
 { new: true },
 )
 .select('name slug plan trashRetentionDays usage storageConfig aiProviderConfig aiFeatureConfig sectionAccess themeColor embedConfig defaultFolderAccessMode analyticsConfig')
 .lean();
 } else {
 org = await Organization.findById(effectiveOrgId)
 .select('name slug plan trashRetentionDays usage storageConfig aiProviderConfig aiFeatureConfig sectionAccess themeColor embedConfig defaultFolderAccessMode analyticsConfig')
 .lean();
 }

 const orgSettings = org as OrganizationSettingsSnapshot | null;

 // Handle bulk folder access mode conversion
 let bulkConvertResult: { converted: number } | undefined;
 if (body.bulkFolderAccessMode && ['restricted', 'flexible'].includes(body.bulkFolderAccessMode)) {
 const count = await bulkSetFolderAccessMode(effectiveOrgId, body.bulkFolderAccessMode);
 bulkConvertResult = { converted: count };
 }

 return NextResponse.json({
 settings: {
 orgName: orgSettings?.name,
 orgSlug: orgSettings?.slug,
 plan: orgSettings?.plan,
 trashRetentionDays: orgSettings?.trashRetentionDays ?? 30,
 usage: orgSettings?.usage,
 storageConfig: {
 provider: orgSettings?.storageConfig?.provider ?? 'gcp',
 bucket: orgSettings?.storageConfig?.bucket ?? '',
 isByoc: orgSettings?.storageConfig?.isByoc ?? false,
 hasVertexApiKey:
 !!orgSettings?.aiProviderConfig?.vertexApiKey
 || !!orgSettings?.storageConfig?.vertexApiKey,
 },
 aiProviderConfig: {
 provider: orgSettings?.aiProviderConfig?.provider ?? 'vertex',
 hasVertexApiKey:
 !!orgSettings?.aiProviderConfig?.vertexApiKey
 || !!orgSettings?.storageConfig?.vertexApiKey,
 hasOpenAiApiKey:
 !!orgSettings?.aiProviderConfig?.openAiApiKey,
 },
 aiFeatureConfig: orgSettings?.aiFeatureConfig ?? {},
 sectionAccess: orgSettings?.sectionAccess ?? {},
 themeColor: orgSettings?.themeColor ?? 'violet',
 embedConfig: {
 ...DEFAULT_EMBED_CONFIG,
 ...(orgSettings?.embedConfig ?? {}),
 },
 defaultFolderAccessMode: orgSettings?.defaultFolderAccessMode ?? 'flexible',
 analyticsConfig: orgSettings?.analyticsConfig ?? {
 enabled: false,
 rawRetentionDays: 35,
 maxRawRecordsPerAsset: 500,
 },
 },
 ...(bulkConvertResult && { bulkConvertResult }),
 });
}
