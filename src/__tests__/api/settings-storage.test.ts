// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────
const {
 mockRequirePerm,
 mockOrgFindById,
 mockOrgUpdateOne,
 mockCreateManagedStorageBucket,
 mockBuildManagedStorageConfigUpdate,
 mockBuildByocStorageConfigUpdate,
 mockValidateExternalBucket,
} = vi.hoisted(() => ({
 mockRequirePerm: vi.fn(),
 mockOrgFindById: vi.fn(),
 mockOrgUpdateOne: vi.fn(),
 mockCreateManagedStorageBucket: vi.fn(),
 mockBuildManagedStorageConfigUpdate: vi.fn(),
 mockBuildByocStorageConfigUpdate: vi.fn(),
 mockValidateExternalBucket: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
 connectToDatabase: vi.fn(),
}));

vi.mock('@/lib/auth-context', () => ({
 requirePermission: mockRequirePerm,
}));

vi.mock('@/models', () => ({
 Organization: {
 findById: mockOrgFindById,
 updateOne: mockOrgUpdateOne,
 },
}));

vi.mock('@/lib/storage', () => ({
 createManagedStorageBucket: mockCreateManagedStorageBucket,
 buildManagedStorageConfigUpdate: mockBuildManagedStorageConfigUpdate,
 buildByocStorageConfigUpdate: mockBuildByocStorageConfigUpdate,
 validateExternalBucket: mockValidateExternalBucket,
}));

import { POST } from '@/app/api/settings/storage/route';
import { NextRequest } from 'next/server';

function makeReq(body: Record<string, unknown>) {
 return new NextRequest('http://localhost/api/settings/storage', {
 method: 'POST',
 body: JSON.stringify(body),
 headers: { 'Content-Type': 'application/json' },
 });
}

describe('POST /api/settings/storage', () => {
 const ctx = { userId: 'u1', orgId: 'org1', role: 'owner', email: 'a@b.com', name: 'A' };

 beforeEach(() => {
 vi.clearAllMocks();
 mockRequirePerm.mockResolvedValue(ctx);
 mockOrgUpdateOne.mockResolvedValue({ modifiedCount: 1 });
 mockBuildManagedStorageConfigUpdate.mockImplementation((provider: string, bucket: string) => ({
  'storageConfig.provider': provider,
  'storageConfig.bucket': bucket,
  'storageConfig.credentials': '',
  'storageConfig.vertexApiKey': '',
  'storageConfig.isByoc': false,
 }));
 mockBuildByocStorageConfigUpdate.mockImplementation((provider: string, input: {
  bucket: string;
  region?: string;
  credentials?: string;
  vertexApiKey?: string;
 }) => ({
  'storageConfig.provider': provider,
  'storageConfig.bucket': input.bucket,
  'storageConfig.region': input.region ?? '',
  'storageConfig.credentials': input.credentials ? `enc:${input.credentials}` : '',
    'storageConfig.vertexApiKey': '',
   ...(provider === 'gcp'
    ? {
      'aiProviderConfig.vertexApiKey': input.vertexApiKey ? `enc:${input.vertexApiKey}` : '',
    }
    : {}),
  'storageConfig.isByoc': true,
 }));
 });

 /* ─── auto mode ────────────────────────────────────── */

 it('should provision a dedicated GCS bucket (auto mode)', async () => {
 mockOrgFindById.mockReturnValue({
 lean: vi.fn().mockResolvedValue({ _id: 'org1', slug: 'acme', storageConfig: {} }),
 });
 mockCreateManagedStorageBucket.mockResolvedValue('im-acme-abc123');

 const res = await POST(makeReq({ mode: 'auto' }));
 const data = await res.json();

 expect(res.status).toBe(201);
 expect(data.bucket).toBe('im-acme-abc123');
 expect(mockCreateManagedStorageBucket).toHaveBeenCalledWith('gcp', 'acme');
 expect(mockOrgUpdateOne).toHaveBeenCalled();
 const updateArg = mockOrgUpdateOne.mock.calls[0]?.[1] as {
 $set?: Record<string, unknown>;
 };
 expect(updateArg.$set).toMatchObject({
  'storageConfig.provider': 'gcp',
  'storageConfig.bucket': 'im-acme-abc123',
  'storageConfig.credentials': '',
  'storageConfig.vertexApiKey': '',
  'storageConfig.isByoc': false,
 });
 });

 it('should skip if bucket already exists (auto mode)', async () => {
 mockOrgFindById.mockReturnValue({
 lean: vi.fn().mockResolvedValue({
 _id: 'org1',
 slug: 'acme',
 storageConfig: { bucket: 'existing-bucket', isByoc: false },
 }),
 });

 const res = await POST(makeReq({ mode: 'auto' }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.message).toContain('already provisioned');
 expect(mockCreateManagedStorageBucket).not.toHaveBeenCalled();
 });

 /* ─── byoc mode ────────────────────────────────────── */

 it('should connect an external GCP bucket (byoc mode)', async () => {
 mockValidateExternalBucket.mockResolvedValue({ valid: true });
 const credentials = JSON.stringify({
 type: 'service_account',
 project_id: 'byoc-project',
 client_email: 'byoc@example.iam.gserviceaccount.com',
 private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
 });
 const vertexApiKey = 'AIzaSyTestVertexApiKey1234567890';

 const res = await POST(makeReq({
 mode: 'byoc',
 provider: 'gcp',
 bucket: 'my-external-bucket',
 region: 'us-east1',
 credentials,
 vertexApiKey,
 }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.bucket).toBe('my-external-bucket');
 expect(mockValidateExternalBucket).toHaveBeenCalledWith('gcp', 'my-external-bucket', credentials, 'us-east1');
 expect(mockBuildByocStorageConfigUpdate).toHaveBeenCalledWith('gcp', {
  bucket: 'my-external-bucket',
  region: 'us-east1',
  credentials,
  vertexApiKey,
 });
 expect(mockOrgUpdateOne).toHaveBeenCalled();
 const updateArg = mockOrgUpdateOne.mock.calls[0]?.[1] as {
 $set?: Record<string, unknown>;
 };
 expect(updateArg.$set).toMatchObject({
 'storageConfig.provider': 'gcp',
 'storageConfig.bucket': 'my-external-bucket',
 'storageConfig.isByoc': true,
 });
 expect(typeof updateArg.$set?.['storageConfig.credentials']).toBe('string');
 expect(updateArg.$set?.['storageConfig.credentials']).not.toBe(credentials);
 expect(updateArg.$set?.['storageConfig.vertexApiKey']).toBe('');
 expect(typeof updateArg.$set?.['aiProviderConfig.vertexApiKey']).toBe('string');
 expect(updateArg.$set?.['aiProviderConfig.vertexApiKey']).not.toBe(vertexApiKey);
 });

 it('should connect an external AWS bucket (byoc mode)', async () => {
 mockValidateExternalBucket.mockResolvedValue({ valid: true });
 const credentials = JSON.stringify({
  accessKeyId: 'AKIA_TEST_123',
  secretAccessKey: 'aws-secret-key',
  sessionToken: 'aws-session-token',
 });

 const res = await POST(makeReq({
  mode: 'byoc',
  provider: 'aws',
  bucket: 'customer-s3-bucket',
  region: 'us-east-2',
  credentials,
 }));
 const data = await res.json();

 expect(res.status).toBe(200);
 expect(data.bucket).toBe('customer-s3-bucket');
 expect(mockValidateExternalBucket).toHaveBeenCalledWith(
  'aws',
  'customer-s3-bucket',
  credentials,
  'us-east-2',
 );
 expect(mockBuildByocStorageConfigUpdate).toHaveBeenCalledWith('aws', {
  bucket: 'customer-s3-bucket',
  region: 'us-east-2',
  credentials,
  vertexApiKey: undefined,
 });
 const updateArg = mockOrgUpdateOne.mock.calls[0]?.[1] as {
 $set?: Record<string, unknown>;
 };
 expect(updateArg.$set).toMatchObject({
  'storageConfig.provider': 'aws',
  'storageConfig.bucket': 'customer-s3-bucket',
  'storageConfig.region': 'us-east-2',
  'storageConfig.vertexApiKey': '',
  'storageConfig.isByoc': true,
 });
 expect(typeof updateArg.$set?.['storageConfig.credentials']).toBe('string');
 expect(updateArg.$set?.['storageConfig.credentials']).not.toBe(credentials);
 });

 it('should reject invalid bucket access (byoc mode)', async () => {
 mockValidateExternalBucket.mockResolvedValue({
 valid: false,
 error: 'Access denied',
 });

 const res = await POST(makeReq({
 mode: 'byoc',
 provider: 'gcp',
 bucket: 'bad-bucket',
 }));
 const data = await res.json();

 expect(res.status).toBe(422);
 expect(data.error).toContain('Access denied');
 });

 it('should reject missing AWS region (byoc mode)', async () => {
 const res = await POST(makeReq({
  mode: 'byoc',
  provider: 'aws',
  bucket: 'customer-s3-bucket',
 }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('region');
 });

 it('should reject missing provider (byoc mode)', async () => {
 const res = await POST(makeReq({
 mode: 'byoc',
 bucket: 'some-bucket',
 }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('provider');
 });

 it('should reject missing bucket name (byoc mode)', async () => {
 const res = await POST(makeReq({
 mode: 'byoc',
 provider: 'gcp',
 }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('bucket');
 });

 /* ─── invalid mode ─────────────────────────────────── */

 it('should reject invalid mode', async () => {
 const res = await POST(makeReq({ mode: 'invalid' }));
 const data = await res.json();

 expect(res.status).toBe(400);
 expect(data.error).toContain('mode');
 });

 it('should return 401 for unauthenticated requests', async () => {
 mockRequirePerm.mockRejectedValue({ status: 401, error: 'Unauthorized' });

 const res = await POST(makeReq({ mode: 'auto' }));
 expect(res.status).toBe(401);
 });
});
