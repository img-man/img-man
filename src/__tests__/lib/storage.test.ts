// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockS3Send = vi.fn();
const mockAwsGetSignedUrl = vi.fn();
const mockOrgFindById = vi.fn();

class MockPutObjectCommand {
  constructor(public input: Record<string, unknown>) {}
}

class MockGetObjectCommand {
  constructor(public input: Record<string, unknown>) {}
}

class MockDeleteObjectCommand {
  constructor(public input: Record<string, unknown>) {}
}

class MockHeadObjectCommand {
  constructor(public input: Record<string, unknown>) {}
}

class MockCopyObjectCommand {
  constructor(public input: Record<string, unknown>) {}
}

const mockGetSignedUrl = vi.fn();
const mockCreateResumableUpload = vi.fn();
const mockDownload = vi.fn();
const mockGetMetadata = vi.fn();
const mockSave = vi.fn();
const mockDelete = vi.fn();
const mockStorageConstructor = vi.fn();
const mockBucket = {
  file: vi.fn(() => ({
    getSignedUrl: mockGetSignedUrl,
    createResumableUpload: mockCreateResumableUpload,
    download: mockDownload,
    getMetadata: mockGetMetadata,
    save: mockSave,
    delete: mockDelete,
  })),
};
const mockStorageBucket = vi.fn(() => mockBucket);

vi.mock('@google-cloud/storage', () => ({
  Storage: class MockStorage {
    constructor(options?: Record<string, unknown>) {
      mockStorageConstructor(options ?? {});
    }

    bucket = mockStorageBucket;
  },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = mockS3Send;
  },
  PutObjectCommand: MockPutObjectCommand,
  GetObjectCommand: MockGetObjectCommand,
  DeleteObjectCommand: MockDeleteObjectCommand,
  HeadObjectCommand: MockHeadObjectCommand,
  CopyObjectCommand: MockCopyObjectCommand,
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockAwsGetSignedUrl,
}));

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('@/models', () => ({
  Organization: {
    findById: mockOrgFindById,
  },
}));

describe('storage fallbacks', () => {
  function mockOrgStorageConfig(storageConfig: Record<string, unknown>) {
    const lean = vi.fn().mockResolvedValue({ storageConfig });
    const select = vi.fn().mockReturnValue({ lean });
    mockOrgFindById.mockReturnValue({ select });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.GCS_BUCKET;
    delete process.env.GCP_APP_CREDENTIALS_PATH;
    delete process.env.GCP_SERVICE_ACCOUNT_PATH;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.GCP_PROJECT_ID = 'test-project';
    process.env.GCP_STORAGE_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    process.env.NEXTAUTH_SECRET = 'test-secret';
    process.env.NEXTAUTH_URL = 'https://im.joinmywed.in';
  });

  it('falls back to app proxy download URLs when GCS signing is unavailable', async () => {
    mockGetSignedUrl.mockRejectedValueOnce(
      new Error("Permission 'iam.serviceAccounts.signBlob' denied on resource"),
    );

    const { getSignedDownloadUrl, verifyStorageProxyToken } =
      await import('@/lib/storage');

    const url = await getSignedDownloadUrl('uploads/acme/test.png', 600);

    expect(url).toContain('/api/storage/download?token=');
    const token = new URL(url).searchParams.get('token');
    expect(token).toBeTruthy();

    const payload = verifyStorageProxyToken(token as string);
    expect(payload.objectPath).toBe('uploads/acme/test.png');
    expect(payload.bucketName).toBeUndefined();
    expect(payload.expiresAt).toBeGreaterThan(Date.now());
  }, 15000);

    it('uses a local dev fallback secret for storage proxy tokens when auth secrets are unset', async () => {
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.ASSET_URL_SIGNING_SECRET;
      process.env.NODE_ENV = 'test';

      const { createStorageProxyToken, verifyStorageProxyToken } =
        await import('@/lib/storage');

      const token = createStorageProxyToken({
        objectPath: 'uploads/acme/dev-only.pdf',
        expiresAt: Date.now() + 60_000,
        fileName: 'dev-only.pdf',
      });

      const payload = verifyStorageProxyToken(token);
      expect(payload.objectPath).toBe('uploads/acme/dev-only.pdf');
      expect(payload.fileName).toBe('dev-only.pdf');
    });
  it('falls back to resumable uploads when GCS upload signing is unavailable', async () => {
    mockGetSignedUrl.mockRejectedValueOnce(
      new Error('SigningError: signBlob denied'),
    );
    mockCreateResumableUpload.mockResolvedValueOnce([
      'https://storage.example.com/resumable',
    ]);

    const { getSignedUploadUrl } = await import('@/lib/storage');

    const url = await getSignedUploadUrl('uploads/acme/test.png', 'image/png');

    expect(url).toBe('https://storage.example.com/resumable');
    expect(mockCreateResumableUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: 'https://im.joinmywed.in',
        metadata: { contentType: 'image/png' },
      }),
    );
  });

  it('uses the legacy GCS_BUCKET env alias when GCP_STORAGE_BUCKET is unset', async () => {
    delete process.env.GCP_STORAGE_BUCKET;
    process.env.GCS_BUCKET = 'legacy-bucket';
    mockGetSignedUrl.mockResolvedValueOnce(['https://signed.example/read']);

    const { getSignedDownloadUrl } = await import('@/lib/storage');

    const url = await getSignedDownloadUrl('uploads/acme/test.png', 600);

    expect(url).toBe('https://signed.example/read');
    expect(mockStorageBucket).toHaveBeenCalledWith('legacy-bucket');
  });

  it('uses the legacy GCP_SERVICE_ACCOUNT_PATH env alias for default credentials', async () => {
    delete process.env.GCP_APP_CREDENTIALS_PATH;
    process.env.GCP_SERVICE_ACCOUNT_PATH = 'C:\\creds\\service-account.json';
    mockGetSignedUrl.mockResolvedValueOnce(['https://signed.example/read']);

    const { getSignedDownloadUrl } = await import('@/lib/storage');

    await getSignedDownloadUrl('uploads/acme/test.png', 600);

    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe(
      'C:\\creds\\service-account.json',
    );
    expect(mockStorageConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'test-project' }),
    );
  });

  it('validates external GCP buckets with an end-to-end upload probe', async () => {
    mockSave.mockResolvedValueOnce(undefined);
    mockGetSignedUrl.mockResolvedValueOnce(['https://signed.example/put']);
    mockDelete.mockResolvedValue(undefined);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const { validateExternalBucket } = await import('@/lib/storage');

    const result = await validateExternalBucket(
      'gcp',
      'customer-bucket',
      JSON.stringify({
        type: 'service_account',
        project_id: 'customer-project',
        client_email: 'customer@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      }),
    );

    expect(result).toEqual({ valid: true });
    expect(mockStorageBucket).toHaveBeenCalledWith('customer-bucket');
    expect(mockSave).toHaveBeenCalledWith(
      'imgman-access-probe',
      expect.objectContaining({
        resumable: false,
        contentType: 'text/plain',
      }),
    );
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'write', version: 'v4' }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://signed.example/put',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
    fetchSpy.mockRestore();
  });

  it('returns a clear upload error when the SA cannot create objects', async () => {
    mockSave.mockRejectedValueOnce(new Error('storage.objects.create denied'));

    const { validateExternalBucket } = await import('@/lib/storage');

    const result = await validateExternalBucket(
      'gcp',
      'customer-bucket',
      JSON.stringify({
        type: 'service_account',
        project_id: 'customer-project',
        client_email: 'customer@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot upload objects');
    expect(result.error).toContain('storage.objects.create denied');
  });

  it('returns a clear signing error when getSignedUrl fails', async () => {
    mockSave.mockResolvedValueOnce(undefined);
    mockGetSignedUrl.mockRejectedValueOnce(
      new Error("Permission 'iam.serviceAccounts.signBlob' denied"),
    );
    mockDelete.mockResolvedValue(undefined);

    const { validateExternalBucket } = await import('@/lib/storage');

    const result = await validateExternalBucket(
      'gcp',
      'customer-bucket',
      JSON.stringify({
        type: 'service_account',
        project_id: 'customer-project',
        client_email: 'customer@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('signed upload URL');
    expect(result.error).toContain('Service Account Token Creator');
  });

  it('returns a clear error when the signed URL PUT fails', async () => {
    mockSave.mockResolvedValueOnce(undefined);
    mockGetSignedUrl.mockResolvedValueOnce(['https://signed.example/put']);
    mockDelete.mockResolvedValue(undefined);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('AccessDenied', { status: 403 }));

    const { validateExternalBucket } = await import('@/lib/storage');

    const result = await validateExternalBucket(
      'gcp',
      'customer-bucket',
      JSON.stringify({
        type: 'service_account',
        project_id: 'customer-project',
        client_email: 'customer@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Signed URL upload failed');
    expect(result.error).toContain('403');
    fetchSpy.mockRestore();
  });

  it('validates external AWS buckets with an upload probe and signed URL check', async () => {
    mockS3Send.mockResolvedValueOnce({});
    mockAwsGetSignedUrl.mockResolvedValueOnce('https://s3.example.com/put');
    mockS3Send.mockResolvedValueOnce({});
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 200 }));

    const { validateExternalBucket } = await import('@/lib/storage');

    const result = await validateExternalBucket(
      'aws',
      'customer-s3-bucket',
      JSON.stringify({
        accessKeyId: 'AKIA_TEST_123',
        secretAccessKey: 'aws-secret-key',
        sessionToken: 'aws-session-token',
      }),
      'us-east-2',
    );

    expect(result).toEqual({ valid: true });
    expect(mockS3Send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'customer-s3-bucket',
          ContentType: 'text/plain',
          Body: 'imgman-access-probe',
        }),
      }),
    );
    expect(mockAwsGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'customer-s3-bucket',
          ContentType: 'text/plain',
        }),
      }),
      expect.objectContaining({ expiresIn: expect.any(Number) }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://s3.example.com/put',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mockS3Send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        input: expect.objectContaining({ Bucket: 'customer-s3-bucket' }),
      }),
    );
    fetchSpy.mockRestore();
  });

  it('clears stale BYOC secrets when switching back to managed storage', async () => {
    const { buildManagedStorageConfigUpdate } = await import('@/lib/storage');

    expect(buildManagedStorageConfigUpdate('gcp', 'managed-bucket')).toMatchObject({
      'storageConfig.provider': 'gcp',
      'storageConfig.bucket': 'managed-bucket',
      'storageConfig.credentials': '',
      'storageConfig.vertexApiKey': '',
      'storageConfig.isByoc': false,
    });
  });

  it('stores Vertex API keys under aiProviderConfig for GCP BYOC', async () => {
    const { buildByocStorageConfigUpdate } = await import('@/lib/storage');

    const update = buildByocStorageConfigUpdate('gcp', {
      bucket: 'customer-gcp-bucket',
      region: 'us-central1',
      credentials: JSON.stringify({
        type: 'service_account',
        project_id: 'customer-project',
        client_email: 'customer@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      }),
      vertexApiKey: 'AIzaSyTestVertexApiKey1234567890',
    });

    expect(update).toMatchObject({
      'storageConfig.provider': 'gcp',
      'storageConfig.bucket': 'customer-gcp-bucket',
      'storageConfig.vertexApiKey': '',
    });
    expect(typeof update['aiProviderConfig.vertexApiKey']).toBe('string');
    expect(update['aiProviderConfig.vertexApiKey']).not.toBe(
      'AIzaSyTestVertexApiKey1234567890',
    );
  });

  it('signs download URLs for orgs using AWS storage', async () => {
    mockOrgStorageConfig({
      provider: 'aws',
      bucket: 'customer-s3-bucket',
      region: 'us-west-2',
      isByoc: true,
      credentials: JSON.stringify({
        accessKeyId: 'AKIA_TEST_123',
        secretAccessKey: 'aws-secret-key',
      }),
    });
    mockAwsGetSignedUrl.mockResolvedValueOnce('https://s3.example.com/read');

    const { getSignedDownloadUrl } = await import('@/lib/storage');

    const url = await getSignedDownloadUrl(
      'uploads/acme/test.png',
      600,
      undefined,
      'org-aws',
    );

    expect(url).toBe('https://s3.example.com/read');
    expect(mockAwsGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: 'customer-s3-bucket',
          Key: 'uploads/acme/test.png',
        }),
      }),
      expect.objectContaining({ expiresIn: expect.any(Number) }),
    );
  });

  it('serves proxy downloads when the token is valid', async () => {
    mockGetMetadata.mockResolvedValueOnce([{ contentType: 'image/png' }]);
    mockDownload.mockResolvedValueOnce([Buffer.from('png-bytes')]);

    const { createStorageProxyToken } = await import('@/lib/storage');
    const { GET } = await import('@/app/api/storage/download/route');

    const token = createStorageProxyToken({
      objectPath: 'uploads/acme/test.png',
      expiresAt: Date.now() + 60_000,
      fileName: 'test.png',
    });

    const req = new NextRequest(
      `http://localhost/api/storage/download?token=${encodeURIComponent(token)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(await res.text()).toBe('png-bytes');
  });

  it('supports HEAD requests for valid proxy download tokens', async () => {
    mockGetMetadata.mockResolvedValueOnce([{ contentType: 'image/png' }]);

    const { createStorageProxyToken } = await import('@/lib/storage');
    const { HEAD } = await import('@/app/api/storage/download/route');

    const token = createStorageProxyToken({
      objectPath: 'uploads/acme/test.png',
      expiresAt: Date.now() + 60_000,
      fileName: 'test.png',
    });

    const req = new NextRequest(
      `http://localhost/api/storage/download?token=${encodeURIComponent(token)}`,
    );
    const res = await HEAD(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(await res.text()).toBe('');
  });

  it('returns 404 when the proxied object is missing', async () => {
    mockGetMetadata.mockRejectedValueOnce(
      Object.assign(new Error('No such object: uploads/acme/missing.png'), {
        code: 404,
      }),
    );

    const { createStorageProxyToken } = await import('@/lib/storage');
    const { GET } = await import('@/app/api/storage/download/route');

    const token = createStorageProxyToken({
      objectPath: 'uploads/acme/missing.png',
      expiresAt: Date.now() + 60_000,
      fileName: 'missing.png',
    });

    const req = new NextRequest(
      `http://localhost/api/storage/download?token=${encodeURIComponent(token)}`,
    );
    const res = await GET(req);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: 'No such object: uploads/acme/missing.png',
    });
  });
});
