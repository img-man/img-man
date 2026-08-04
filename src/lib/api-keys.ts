// SPDX-License-Identifier: Apache-2.0
/**
 * API Key generation and verification utilities.
 *
 * Keys follow format: img_{32 random hex chars}
 * Only the bcrypt hash is stored; plaintext is returned exactly once at creation.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/db';
import { ApiKey, type ApiKeyPermission } from '@/models';

const KEY_PREFIX_TAG = 'img_';
const KEY_RANDOM_BYTES = 32; // 32 bytes → 64 hex chars
const BCRYPT_ROUNDS = 10;

export interface CreateApiKeyInput {
 orgId: string;
 name: string;
 permissions: ApiKeyPermission[];
 allowedDomains?: string[];
 rateLimit?: number;
 folderScope?: string; // Folder ID — restricts operations to this subtree
 expiresAt?: Date;
 createdById: string;
}

export interface CreateApiKeyResult {
 /** The plaintext key — shown only once. */
 plaintext: string;
 /** The persisted document (no plaintext). */
 apiKey: {
 id: string;
 name: string;
 keyPrefix: string;
 permissions: ApiKeyPermission[];
 allowedDomains: string[];
 rateLimit: number;
 folderScope?: string;
 expiresAt?: Date;
 createdAt: Date;
 };
}

/**
 * Generate a new API key, hash it, persist the hash, return plaintext once.
 */
export async function createApiKey(
 input: CreateApiKeyInput,
): Promise<CreateApiKeyResult> {
 await connectToDatabase();

 const randomPart = crypto.randomBytes(KEY_RANDOM_BYTES).toString('hex');
 const plaintext = `${KEY_PREFIX_TAG}${randomPart}`;
 const keyPrefix = plaintext.slice(0, 12); // "img_" + 8 hex chars
 const keyHash = await bcrypt.hash(plaintext, BCRYPT_ROUNDS);

 const doc = await ApiKey.create({
 orgId: input.orgId,
 name: input.name,
 keyHash,
 keyPrefix,
 permissions: input.permissions,
 allowedDomains: input.allowedDomains ?? [],
 rateLimit: input.rateLimit ?? 60,
 folderScope: input.folderScope ?? null,
 expiresAt: input.expiresAt,
 createdById: input.createdById,
 });

 return {
 plaintext,
 apiKey: {
 id: String(doc._id),
 name: doc.name,
 keyPrefix: doc.keyPrefix,
 permissions: doc.permissions,
 allowedDomains: doc.allowedDomains,
 rateLimit: doc.rateLimit,
 folderScope: doc.folderScope ?? undefined,
 expiresAt: doc.expiresAt,
 createdAt: doc.createdAt,
 },
 };
}

/**
 * Verify a plaintext API key against stored hashes.
 * Returns the matching ApiKey doc (without keyHash), or null.
 */
export async function verifyApiKey(plaintext: string) {
 if (!plaintext.startsWith(KEY_PREFIX_TAG)) return null;

 await connectToDatabase();

 const keyPrefix = plaintext.slice(0, 12);

 // Find all non-revoked, non-expired keys with this prefix
 const candidates = await ApiKey.find({
 keyPrefix,
 isRevoked: false,
 $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
 }).lean();

 for (const candidate of candidates) {
 const match = await bcrypt.compare(plaintext, candidate.keyHash);
 if (match) {
 // Update lastUsedAt in background (fire & forget)
 ApiKey.updateOne(
 { _id: candidate._id },
 { $set: { lastUsedAt: new Date() } },
 ).exec();

 return {
 id: String(candidate._id),
 orgId: String(candidate.orgId),
 name: candidate.name,
 keyPrefix: candidate.keyPrefix,
 permissions: candidate.permissions as ApiKeyPermission[],
 allowedDomains: candidate.allowedDomains as string[],
 rateLimit: candidate.rateLimit,
 folderScope: candidate.folderScope ?? undefined,
 };
 }
 }

 return null;
}

/**
 * Revoke an API key (soft-delete).
 */
export async function revokeApiKey(keyId: string, orgId: string) {
 await connectToDatabase();
 const result = await ApiKey.updateOne(
 { _id: keyId, orgId },
 { $set: { isRevoked: true } },
 );
 return result.modifiedCount > 0;
}

/**
 * List all API keys for an org (never includes keyHash).
 */
export async function listApiKeys(orgId: string) {
 await connectToDatabase();
 return ApiKey.find({ orgId })
 .select('-keyHash')
 .sort({ createdAt: -1 })
 .lean();
}
