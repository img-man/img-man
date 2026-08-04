// SPDX-License-Identifier: Apache-2.0
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { OrgMembership, User } from '@/models';
import { requireAuthContextOrApiKey } from '@/lib/auth-context';
import { canInviteRole, type Role } from '@/lib/permissions';

/**
 * POST /api/team/invite
 * Body: { name: string, email?: string, phone?: string, role: 'admin' | 'editor' | 'viewer', accessRules?: { path: string, role: string, resourceType: 'folder' | 'asset' }[] }
 * At least one of email or phone is required.
 * Creates an active OrgMembership directly (no pending invite flow).
 */
export async function POST(req: NextRequest) {
 try {
 const ctx = await requireAuthContextOrApiKey(req);
 const body = await req.json();
 const { name, email, phone, role, accessRules, sectionAccess, mergeOnConflict } = body as {
 name?: string;
 email?: string;
 phone?: string;
 role?: string;
 accessRules?: { path: string; role: string; resourceType?: string }[];
 sectionAccess?: Record<string, number>;
 mergeOnConflict?: boolean;
 };

 // Validate name
 if (!name || typeof name !== 'string' || !name.trim()) {
 return NextResponse.json(
 { error: 'Name is required' },
 { status: 400 },
 );
 }

 // Validate at least one contact method
 const normalizedEmail = email?.toLowerCase().trim() || undefined;
 const normalizedPhone = phone?.replace(/[^+\d]/g, '').trim() || undefined;

 if (!normalizedEmail && !normalizedPhone) {
 return NextResponse.json(
 { error: 'At least one of email or phone is required' },
 { status: 400 },
 );
 }

 // Basic email format check if provided
 if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
 return NextResponse.json(
 { error: 'Invalid email format' },
 { status: 400 },
 );
 }

 // Basic phone format check if provided (min 7 digits)
 if (normalizedPhone && normalizedPhone.replace(/\D/g, '').length < 7) {
 return NextResponse.json(
 { error: 'Invalid phone number (minimum 7 digits)' },
 { status: 400 },
 );
 }

 const validRoles: Role[] = ['admin', 'editor', 'viewer'];
 if (!role || !validRoles.includes(role as Role)) {
 return NextResponse.json(
 { error: 'Invalid role. Must be admin, editor, or viewer.' },
 { status: 400 },
 );
 }

 // Check hierarchy: user must be able to invite at this role
 if (!canInviteRole(ctx.role, role as Role)) {
 return NextResponse.json(
 { error: `Your role (${ctx.role}) cannot add ${role}s` },
 { status: 403 },
 );
 }

 // Can't add yourself
 if (normalizedEmail && normalizedEmail === ctx.email.toLowerCase()) {
 return NextResponse.json(
 { error: 'You cannot add yourself' },
 { status: 400 },
 );
 }

 await connectToDatabase();

 // Validate access rules early (needed for both new and merge paths)
 const validatedRules = (accessRules ?? []).map((r) => ({
 path: r.path,
 role: r.role as 'owner' | 'admin' | 'editor' | 'viewer',
 resourceType: (r.resourceType ?? 'folder') as 'folder' | 'asset',
 }));

 // Check for existing active membership by email OR phone
 const existingFilter: Record<string, unknown>[] = [];
 if (normalizedEmail) {
 existingFilter.push({ email: normalizedEmail });
 }
 if (normalizedPhone) {
 existingFilter.push({ phone: normalizedPhone });
 }

 const existing = await OrgMembership.findOne({
 orgId: ctx.orgId,
 $or: existingFilter,
 status: 'active',
 }).lean();

 if (existing) {
 // When mergeOnConflict is true, merge new access rules and sectionAccess
 // into the existing membership instead of rejecting with 409.
 if (mergeOnConflict) {
 const updateDoc: Record<string, unknown> = {};

 // Merge accessRules: add new rules that don't already exist (by path)
 if (validatedRules.length > 0) {
 const existingRules = (existing as unknown as { accessRules?: { path: string; role: string; resourceType?: string }[] }).accessRules ?? [];
 const existingPaths = new Set(existingRules.map((r) => r.path));
 const newRules = validatedRules.filter((r) => !existingPaths.has(r.path));
 if (newRules.length > 0) {
 updateDoc.accessRules = [...existingRules, ...newRules];
 }
 }

 // Merge sectionAccess: add new keys or keep lower (more permissive) value
 if (sectionAccess && Object.keys(sectionAccess).length > 0) {
 const existingSA = (existing as unknown as { sectionAccess?: Map<string, number> | Record<string, number> }).sectionAccess;
 const existingSAObj: Record<string, number> = existingSA instanceof Map
 ? Object.fromEntries(existingSA)
 : existingSA ?? {};
 const mergedSA = { ...existingSAObj };
 for (const [key, value] of Object.entries(sectionAccess)) {
 // Keep the more permissive (lower number) value
 if (mergedSA[key] === undefined || value < mergedSA[key]) {
 mergedSA[key] = value;
 }
 }
 updateDoc.sectionAccess = new Map(Object.entries(mergedSA));
 }

 if (Object.keys(updateDoc).length > 0) {
 await OrgMembership.findByIdAndUpdate(existing._id, { $set: updateDoc });
 }

 return NextResponse.json(
 {
 membership: {
 id: (existing._id as unknown as string).toString(),
 name: (existing as unknown as { inviteName?: string }).inviteName ?? name?.trim() ?? '',
 email: existing.email ?? null,
 role: existing.role,
 status: existing.status,
 merged: true,
 },
 },
 { status: 200 },
 );
 }

 const identifier = normalizedEmail || normalizedPhone!;
 return NextResponse.json(
 { error: `${identifier} is already a member of this organization` },
 { status: 409 },
 );
 }

 // Remove any previous revoked/pending records for this email
 if (normalizedEmail) {
 await OrgMembership.deleteMany({
 orgId: ctx.orgId,
 email: normalizedEmail,
 status: { $in: ['pending', 'revoked'] },
 });
 }

 // Check if user already exists in the system (by email)
 const existingUser = normalizedEmail
 ? await User.findOne({ email: normalizedEmail }).lean()
 : null;

 // API key auth uses synthetic userId like "apikey:..." which isn't a valid ObjectId.
 // Store null for invitedBy when the invite comes from an API key.
 const invitedByUserId = ctx.userId.startsWith('apikey:') ? null : ctx.userId;

 const membership = await OrgMembership.create({
 orgId: ctx.orgId,
 userId: existingUser?._id ?? null,
 email: normalizedEmail || null,
 phone: normalizedPhone || null,
 inviteName: name.trim(),
 role: role as Role,
 invitedBy: invitedByUserId,
 status: 'active',
 accessRules: validatedRules,
 ...(sectionAccess && Object.keys(sectionAccess).length > 0
 ? { sectionAccess }
 : {}),
 });

 return NextResponse.json(
 {
 membership: {
 id: (membership._id as unknown as string).toString(),
 name: name.trim(),
 email: normalizedEmail || null,
 phone: normalizedPhone || null,
 role,
 status: 'active',
 accessRules: validatedRules,
 },
 },
 { status: 201 },
 );
 } catch (err: unknown) {
 const e = err as { status?: number; error?: string; message?: string };
 return NextResponse.json(
 { error: e.error ?? e.message ?? 'Server error' },
 { status: e.status ?? 500 },
 );
 }
}
