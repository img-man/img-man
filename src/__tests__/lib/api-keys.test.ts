// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── Mock external deps ──────────────────────────────────────── */

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/models', () => {
 const mockApiKey = {
 create: vi.fn(),
 find: vi.fn(),
 findOne: vi.fn(),
 updateOne: vi.fn(),
 };
 return { ApiKey: mockApiKey };
});

vi.mock('bcryptjs', () => ({
 default: {
 hash: vi.fn().mockResolvedValue('hashed_key'),
 compare: vi.fn(),
 },
}));

import { createApiKey, verifyApiKey, revokeApiKey, listApiKeys } from '@/lib/api-keys';
import { ApiKey } from '@/models';
import bcrypt from 'bcryptjs';

const mockCreate = vi.mocked(ApiKey.create) as unknown as ReturnType<typeof vi.fn>;
const mockFind = vi.mocked(ApiKey.find) as unknown as ReturnType<typeof vi.fn>;
const mockUpdateOne = vi.mocked(ApiKey.updateOne) as unknown as ReturnType<typeof vi.fn>;
const mockBcryptHash = vi.mocked(bcrypt.hash) as unknown as ReturnType<typeof vi.fn>;
const mockBcryptCompare = vi.mocked(bcrypt.compare) as unknown as ReturnType<typeof vi.fn>;

describe('API Keys Library', () => {
 beforeEach(() => {
 vi.clearAllMocks();
 mockBcryptHash.mockResolvedValue('hashed_key');
 });

 // ─── createApiKey ────────────────────────────────────────────
 describe('createApiKey', () => {
 it('generates a key with img_ prefix and stores hash', async () => {
 mockCreate.mockResolvedValue({
 _id: 'key1',
 name: 'Test Key',
 keyPrefix: 'img_abcd1234',
 permissions: ['read'],
 allowedDomains: [],
 rateLimit: 60,
 expiresAt: undefined,
 createdAt: new Date(),
 });

 const result = await createApiKey({
 orgId: 'org1',
 name: 'Test Key',
 permissions: ['read'],
 createdById: 'user1',
 });

 expect(result.plaintext).toMatch(/^img_[a-f0-9]{64}$/);
 expect(result.apiKey.name).toBe('Test Key');
 expect(mockBcryptHash).toHaveBeenCalledOnce();
 expect(mockCreate).toHaveBeenCalledWith(
 expect.objectContaining({
 orgId: 'org1',
 name: 'Test Key',
 keyHash: 'hashed_key',
 permissions: ['read'],
 }),
 );
 });

 it('respects custom rate limit and expiration', async () => {
 const expiresAt = new Date('2027-01-01');
 mockCreate.mockResolvedValue({
 _id: 'key2',
 name: 'Custom Key',
 keyPrefix: 'img_abcd1234',
 permissions: ['read', 'write'],
 allowedDomains: ['example.com'],
 rateLimit: 200,
 expiresAt,
 createdAt: new Date(),
 });

 const result = await createApiKey({
 orgId: 'org1',
 name: 'Custom Key',
 permissions: ['read', 'write'],
 allowedDomains: ['example.com'],
 rateLimit: 200,
 expiresAt,
 createdById: 'user1',
 });

 expect(result.apiKey.rateLimit).toBe(200);
 expect(result.apiKey.allowedDomains).toEqual(['example.com']);
 });
 });

 // ─── verifyApiKey ────────────────────────────────────────────
 describe('verifyApiKey', () => {
 it('returns null for non-img_ prefixed keys', async () => {
 const result = await verifyApiKey('invalid_key_123');
 expect(result).toBeNull();
 });

 it('returns null when no matching key found', async () => {
 mockFind.mockReturnValue({
 lean: vi.fn().mockResolvedValue([]),
 });

 const result = await verifyApiKey('img_abcdef123456789012345678901234567890abcdef123456789012345678901234');
 expect(result).toBeNull();
 });

 it('verifies key against stored hash', async () => {
 const candidate = {
 _id: 'key1',
 orgId: 'org1',
 name: 'Test',
 keyPrefix: 'img_abcdef12',
 keyHash: 'hashed_key',
 permissions: ['read', 'write'],
 allowedDomains: [],
 rateLimit: 60,
 };
 mockFind.mockReturnValue({
 lean: vi.fn().mockResolvedValue([candidate]),
 });
 mockBcryptCompare.mockResolvedValue(true);
 mockUpdateOne.mockReturnValue({
 exec: vi.fn(),
 });

 const result = await verifyApiKey('img_abcdef12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
 expect(result).not.toBeNull();
 expect(result!.orgId).toBe('org1');
 expect(result!.permissions).toEqual(['read', 'write']);
 });

 it('returns null when hash does not match', async () => {
 mockFind.mockReturnValue({
 lean: vi.fn().mockResolvedValue([{
 _id: 'key1',
 keyHash: 'hashed_key',
 permissions: ['read'],
 }]),
 });
 mockBcryptCompare.mockResolvedValue(false);

 const result = await verifyApiKey('img_abcdef12xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
 expect(result).toBeNull();
 });
 });

 // ─── revokeApiKey ────────────────────────────────────────────
 describe('revokeApiKey', () => {
 it('revokes an active key', async () => {
 mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });

 const result = await revokeApiKey('key1', 'org1');
 expect(result).toBe(true);
 expect(mockUpdateOne).toHaveBeenCalledWith(
 { _id: 'key1', orgId: 'org1' },
 { $set: { isRevoked: true } },
 );
 });

 it('returns false for non-existent key', async () => {
 mockUpdateOne.mockResolvedValue({ modifiedCount: 0 });

 const result = await revokeApiKey('nope', 'org1');
 expect(result).toBe(false);
 });
 });

 // ─── listApiKeys ─────────────────────────────────────────────
 describe('listApiKeys', () => {
 it('lists keys for an org without keyHash', async () => {
 const keys = [{ _id: 'key1', name: 'Prod' }];
 mockFind.mockReturnValue({
 select: vi.fn().mockReturnValue({
 sort: vi.fn().mockReturnValue({
 lean: vi.fn().mockResolvedValue(keys),
 }),
 }),
 });

 const result = await listApiKeys('org1');
 expect(result).toEqual(keys);
 expect(mockFind).toHaveBeenCalledWith({ orgId: 'org1' });
 });
 });
});
