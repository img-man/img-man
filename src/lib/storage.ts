// SPDX-License-Identifier: Apache-2.0
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl as getAwsSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Storage } from '@google-cloud/storage';
import crypto from 'crypto';
import {
  encryptStoredGcpCredentials,
  encryptStoredVertexApiKey,
  getOrgGcpConfig,
  resolveServiceAccountAuth,
} from './gcp-config';
import { connectToDatabase } from './db';
import { decryptStoredSecret, encryptStoredSecret } from './secret-crypto';
import { Organization } from '@/models';
import { STORAGE_PROVIDERS, type StorageProviderId } from '@/types/providers';

let defaultStorage: Storage | null = null;
const storageClients = new Map<string, Storage>();
const awsStorageClients = new Map<string, S3Client>();

type StorageProxyTokenPayload = {
  objectPath: string;
  bucketName?: string;
  orgId?: string;
  expiresAt: number;
  fileName?: string;
  contentType?: string;
};

type StorageValidationResult = {
  valid: boolean;
  error?: string;
};

type StorageProviderConfigUpdateInput = {
  bucket: string;
  region?: string;
  credentials?: string;
  vertexApiKey?: string;
};

type StorageProviderAdapter = {
  id: StorageProviderId;
  createManagedBucket?: (slug: string, region?: string) => Promise<string>;
  validateExternalBucket: (
    bucket: string,
    credentials?: string,
    region?: string,
  ) => Promise<StorageValidationResult>;
  buildManagedStorageConfigUpdate: (bucket: string) => Record<string, unknown>;
  buildByocStorageConfigUpdate: (
    input: StorageProviderConfigUpdateInput,
  ) => Record<string, unknown>;
};

type AwsStorageCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

type PersistedOrgStorageConfig = {
  provider: StorageProviderId;
  bucket?: string;
  region?: string;
  credentials?: string;
  isByoc: boolean;
};

type StorageFileSaveOptions = {
  resumable?: boolean;
  contentType?: string;
  metadata?: Record<string, unknown>;
};

type StorageSignedUrlOptions = {
  version?: 'v2' | 'v4';
  action: 'read' | 'write';
  expires: number;
  contentType?: string;
};

type StorageResumableUploadOptions = {
  origin?: string;
  metadata?: Record<string, unknown>;
};

type StorageFileMetadata = {
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
};

export type StorageFileHandle = {
  provider: StorageProviderId;
  bucketName: string;
  objectPath: string;
  download: () => Promise<[Buffer]>;
  save: (data: Buffer | string, options?: StorageFileSaveOptions) => Promise<void>;
  delete: (options?: { ignoreNotFound?: boolean }) => Promise<void>;
  getSignedUrl: (options: StorageSignedUrlOptions) => Promise<[string]>;
  getMetadata: () => Promise<[StorageFileMetadata]>;
  copy: (destination: StorageFileHandle) => Promise<void>;
  createResumableUpload: (options?: StorageResumableUploadOptions) => Promise<[string]>;
};

export type StorageBucketHandle = {
  provider: StorageProviderId;
  name: string;
  file: (objectPath: string) => StorageFileHandle;
};

type GcpBucketHandle = ReturnType<Storage['bucket']>;
type GcpFileHandle = ReturnType<GcpBucketHandle['file']>;

const ENCRYPTED_AWS_CREDENTIALS_PREFIX = 'enc:aws:v1:';

function getProjectId() {
  const projectId = process.env.GCP_PROJECT_ID ?? '';

  if (!projectId) {
    throw new Error('Missing GCP_PROJECT_ID in environment variables');
  }

  return projectId;
}

function getDefaultBucketName() {
  const defaultBucketName =
    process.env.GCP_STORAGE_BUCKET ?? process.env.GCS_BUCKET ?? '';

  if (!defaultBucketName) {
    throw new Error(
      'Missing GCP_STORAGE_BUCKET (or legacy GCS_BUCKET) in environment variables',
    );
  }

  return defaultBucketName;
}

function getDefaultStorageClient() {
  if (defaultStorage) {
    return defaultStorage;
  }

  const inlineServiceAccountJson =
    process.env.GCP_SERVICE_ACCOUNT_JSON?.trim() ||
    buildServiceAccountJsonFromEnv();

  const credentialsPath =
    process.env.GCP_APP_CREDENTIALS_PATH ??
    process.env.GCP_SERVICE_ACCOUNT_PATH;
  if (credentialsPath && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  }

  if (inlineServiceAccountJson) {
    const auth = resolveServiceAccountAuth(inlineServiceAccountJson);
    defaultStorage = new Storage({
      projectId: auth.projectId,
      credentials: auth.credentials,
    });
    return defaultStorage;
  }

  defaultStorage = new Storage({ projectId: getProjectId() });
  return defaultStorage;
}

function buildServiceAccountJsonFromEnv() {
  const clientEmail = (process.env.GCP_CLIENT_EMAIL || '').trim();
  const privateKeyRaw = process.env.GCP_PRIVATE_KEY || '';

  if (!clientEmail || !privateKeyRaw) {
    return '';
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim();
  const projectId = (process.env.GCP_PROJECT_ID || '').trim();

  const payload = {
    type: 'service_account',
    project_id: projectId || undefined,
    private_key: privateKey,
    client_email: clientEmail,
    private_key_id: (process.env.GCP_PRIVATE_KEY_ID || '').trim() || undefined,
    client_id: (process.env.GCP_CLIENT_ID || '').trim() || undefined,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: clientEmail
      ? `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
      : undefined,
  };

  return JSON.stringify(payload);
}

function getStorageClientFromCredentials(credentialsJson?: string) {
  if (!credentialsJson?.trim()) {
    return getDefaultStorageClient();
  }

  const auth = resolveServiceAccountAuth(credentialsJson);
  const cacheKey = crypto
    .createHash('sha256')
    .update(credentialsJson.trim())
    .digest('hex');

  const cached = storageClients.get(cacheKey);
  if (cached) {
    return cached;
  }

  const client = new Storage({
    projectId: auth.projectId,
    credentials: auth.credentials,
  });
  storageClients.set(cacheKey, client);
  return client;
}

async function getStorageClient(orgId?: string) {
  if (!orgId) {
    return getDefaultStorageClient();
  }

  const orgConfig = await getOrgGcpConfig(orgId);
  return getStorageClientFromCredentials(orgConfig.credentialsJson);
}

function encryptStoredAwsCredentials(credentialsJson?: string) {
  if (!credentialsJson?.trim()) {
    return undefined;
  }

  if (credentialsJson.startsWith(ENCRYPTED_AWS_CREDENTIALS_PREFIX)) {
    return credentialsJson;
  }

  return encryptStoredSecret(credentialsJson.trim(), ENCRYPTED_AWS_CREDENTIALS_PREFIX);
}

function decryptStoredAwsCredentials(credentialsValue?: string) {
  if (!credentialsValue?.trim()) {
    return undefined;
  }

  if (!credentialsValue.startsWith(ENCRYPTED_AWS_CREDENTIALS_PREFIX)) {
    return credentialsValue;
  }

  try {
    return decryptStoredSecret(credentialsValue, ENCRYPTED_AWS_CREDENTIALS_PREFIX);
  } catch {
    throw new Error('Unable to decrypt stored AWS credentials');
  }
}

function parseAwsStorageCredentials(credentialsJson?: string): AwsStorageCredentials {
  const normalizedCredentials = decryptStoredAwsCredentials(credentialsJson);

  if (!normalizedCredentials?.trim()) {
    throw new Error('Missing AWS credential JSON');
  }

  try {
    const parsed = JSON.parse(normalizedCredentials) as Record<string, unknown>;
    const accessKeyId =
      typeof parsed.accessKeyId === 'string'
        ? parsed.accessKeyId.trim()
        : typeof parsed.access_key_id === 'string'
          ? parsed.access_key_id.trim()
          : '';
    const secretAccessKey =
      typeof parsed.secretAccessKey === 'string'
        ? parsed.secretAccessKey.trim()
        : typeof parsed.secret_access_key === 'string'
          ? parsed.secret_access_key.trim()
          : '';
    const sessionToken =
      typeof parsed.sessionToken === 'string'
        ? parsed.sessionToken.trim()
        : typeof parsed.session_token === 'string'
          ? parsed.session_token.trim()
          : undefined;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('Invalid AWS access key payload');
    }

    return {
      accessKeyId,
      secretAccessKey,
      sessionToken: sessionToken || undefined,
    };
  } catch {
    throw new Error('Invalid AWS credential JSON');
  }
}

function getAwsRegion(region?: string) {
  return region?.trim() || process.env.AWS_REGION || 'us-east-1';
}

function getAwsStorageClient(region?: string, credentialsJson?: string) {
  const resolvedRegion = getAwsRegion(region);
  const normalizedCredentials = decryptStoredAwsCredentials(credentialsJson)?.trim() ?? '';
  const cacheKey = crypto
    .createHash('sha256')
    .update(`${resolvedRegion}:${normalizedCredentials}`)
    .digest('hex');

  const cached = awsStorageClients.get(cacheKey);
  if (cached) {
    return cached;
  }

  const credentials = normalizedCredentials
    ? parseAwsStorageCredentials(normalizedCredentials)
    : undefined;

  const client = new S3Client({
    region: resolvedRegion,
    credentials,
  });
  awsStorageClients.set(cacheKey, client);
  return client;
}

function getStorageProviderId(value: unknown): StorageProviderId {
  return typeof value === 'string' && STORAGE_PROVIDERS.includes(value as StorageProviderId)
    ? (value as StorageProviderId)
    : 'gcp';
}

async function getOrgStorageConfig(orgId: string): Promise<PersistedOrgStorageConfig> {
  await connectToDatabase();

  const org = await Organization.findById(orgId).select('storageConfig').lean();
  const storageConfig = org?.storageConfig as
    | {
        provider?: string;
        bucket?: string;
        region?: string;
        credentials?: string;
        isByoc?: boolean;
      }
    | undefined;

  return {
    provider: getStorageProviderId(storageConfig?.provider),
    bucket: storageConfig?.bucket?.trim() || undefined,
    region: storageConfig?.region?.trim() || undefined,
    credentials: storageConfig?.credentials?.trim() || undefined,
    isByoc: !!storageConfig?.isByoc,
  };
}

function getStorageFileContentType(
  options?: StorageFileSaveOptions | StorageResumableUploadOptions,
) {
  if (!options) {
    return undefined;
  }

  const directContentType = 'contentType' in options ? options.contentType : undefined;
  if (typeof directContentType === 'string' && directContentType.trim()) {
    return directContentType.trim();
  }

  const metadata = options.metadata as Record<string, unknown> | undefined;
  const nestedContentType = metadata?.contentType;
  return typeof nestedContentType === 'string' && nestedContentType.trim()
    ? nestedContentType.trim()
    : undefined;
}

function getStorageFileCacheControl(options?: StorageFileSaveOptions) {
  const cacheControl = options?.metadata?.cacheControl;
  return typeof cacheControl === 'string' && cacheControl.trim()
    ? cacheControl.trim()
    : undefined;
}

function getStorageFileUserMetadata(options?: StorageFileSaveOptions) {
  const metadata = options?.metadata;
  if (!metadata) {
    return undefined;
  }

  if (
    typeof metadata.metadata === 'object' &&
    metadata.metadata &&
    !Array.isArray(metadata.metadata)
  ) {
    return Object.fromEntries(
      Object.entries(metadata.metadata as Record<string, unknown>).filter(
        ([, value]) => typeof value === 'string',
      ),
    ) as Record<string, string>;
  }

  const customEntries = Object.entries(metadata).filter(([key, value]) => {
    return !['contentType', 'cacheControl'].includes(key) && typeof value === 'string';
  });

  return customEntries.length > 0
    ? Object.fromEntries(customEntries) as Record<string, string>
    : undefined;
}

function getSignedUrlExpirySeconds(expiresAt: number) {
  const remainingSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
  return Math.max(1, Math.min(7 * 24 * 60 * 60, remainingSeconds));
}

async function streamBodyToBuffer(body: GetObjectCommandOutput['Body']) {
  if (!body) {
    return Buffer.alloc(0);
  }

  if (typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

function formatAwsCopySource(bucketName: string, objectPath: string) {
  return `${bucketName}/${encodeURIComponent(objectPath).replace(/%2F/g, '/')}`;
}

class GcpStorageFile implements StorageFileHandle {
  readonly provider = 'gcp' as const;

  constructor(
    public readonly bucketName: string,
    public readonly objectPath: string,
    private readonly fileHandle: GcpFileHandle,
  ) {}

  download() {
    return this.fileHandle.download() as Promise<[Buffer]>;
  }

  async save(data: Buffer | string, options?: StorageFileSaveOptions) {
    await this.fileHandle.save(data, options);
  }

  async delete(options?: { ignoreNotFound?: boolean }) {
    await this.fileHandle.delete(options);
  }

  async getSignedUrl(options: StorageSignedUrlOptions) {
    return this.fileHandle.getSignedUrl(options) as Promise<[string]>;
  }

  async getMetadata() {
    const [metadata] = await this.fileHandle.getMetadata();
    return [metadata as StorageFileMetadata] as [StorageFileMetadata];
  }

  async copy(destination: StorageFileHandle) {
    if (!(destination instanceof GcpStorageFile)) {
      throw new Error('Cross-provider copy is not supported');
    }

    await this.fileHandle.copy(destination.fileHandle);
  }

  async createResumableUpload(options?: StorageResumableUploadOptions) {
    return this.fileHandle.createResumableUpload(options) as Promise<[string]>;
  }
}

class GcpStorageBucket implements StorageBucketHandle {
  readonly provider = 'gcp' as const;

  constructor(private readonly bucketHandle: GcpBucketHandle) {}

  get name() {
    return this.bucketHandle.name;
  }

  file(objectPath: string) {
    return new GcpStorageFile(this.bucketHandle.name, objectPath, this.bucketHandle.file(objectPath));
  }
}

class AwsStorageFile implements StorageFileHandle {
  readonly provider = 'aws' as const;

  constructor(
    private readonly client: S3Client,
    public readonly bucketName: string,
    public readonly objectPath: string,
  ) {}

  async download() {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectPath,
      }),
    );

    return [await streamBodyToBuffer(response.Body)] as [Buffer];
  }

  async save(data: Buffer | string, options?: StorageFileSaveOptions) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectPath,
        Body: data,
        ContentType: getStorageFileContentType(options),
        CacheControl: getStorageFileCacheControl(options),
        Metadata: getStorageFileUserMetadata(options),
      }),
    );
  }

  async delete(options?: { ignoreNotFound?: boolean }) {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: this.objectPath,
        }),
      );
    } catch (error) {
      if (!options?.ignoreNotFound) {
        throw error;
      }
    }
  }

  async getSignedUrl(options: StorageSignedUrlOptions) {
    const command =
      options.action === 'read'
        ? new GetObjectCommand({
            Bucket: this.bucketName,
            Key: this.objectPath,
          })
        : new PutObjectCommand({
            Bucket: this.bucketName,
            Key: this.objectPath,
            ContentType: options.contentType,
          });

    const url = await getAwsSignedUrl(this.client, command, {
      expiresIn: getSignedUrlExpirySeconds(options.expires),
    });
    return [url] as [string];
  }

  async getMetadata() {
    const response = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: this.objectPath,
      }),
    );

    return [
      {
        contentType: response.ContentType,
        cacheControl: response.CacheControl,
        metadata: response.Metadata,
      },
    ] as [StorageFileMetadata];
  }

  async copy(destination: StorageFileHandle) {
    if (!(destination instanceof AwsStorageFile)) {
      throw new Error('Cross-provider copy is not supported');
    }

    await this.client.send(
      new CopyObjectCommand({
        Bucket: destination.bucketName,
        Key: destination.objectPath,
        CopySource: formatAwsCopySource(this.bucketName, this.objectPath),
      }),
    );
  }

  async createResumableUpload(options?: StorageResumableUploadOptions) {
    return this.getSignedUrl({
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: getStorageFileContentType(options),
    });
  }
}

class AwsStorageBucket implements StorageBucketHandle {
  readonly provider = 'aws' as const;

  constructor(
    public readonly name: string,
    private readonly client: S3Client,
  ) {}

  file(objectPath: string) {
    return new AwsStorageFile(this.client, this.name, objectPath);
  }
}

function createGcpBucketHandle(bucketName: string, credentialsJson?: string) {
  return new GcpStorageBucket(
    getStorageClientFromCredentials(credentialsJson).bucket(bucketName),
  );
}

function createAwsBucketHandle(
  bucketName: string,
  region?: string,
  credentialsJson?: string,
) {
  return new AwsStorageBucket(
    bucketName,
    getAwsStorageClient(region, credentialsJson),
  );
}

function getAwsBucketName(bucketName?: string) {
  if (!bucketName?.trim()) {
    throw new Error('AWS storage bucket is not configured');
  }

  return bucketName.trim();
}

async function getOrgStorageBucketHandle(
  orgId: string,
  bucketOverride?: string,
): Promise<StorageBucketHandle> {
  const storageConfig = await getOrgStorageConfig(orgId);

  if (storageConfig.provider === 'aws') {
    if (storageConfig.isByoc && !storageConfig.credentials?.trim()) {
      throw new Error(
        `BYOC is enabled for org "${orgId}" but no AWS credentials are stored. ` +
          `Re-save the bucket connection in Settings → Storage to upload AWS access keys.`,
      );
    }

    return createAwsBucketHandle(
      bucketOverride || getAwsBucketName(storageConfig.bucket),
      storageConfig.region,
      storageConfig.credentials,
    );
  }

  const orgConfig = await getOrgGcpConfig(orgId);
  return createGcpBucketHandle(
    bucketOverride || orgConfig.bucket || getDefaultBucketName(),
    orgConfig.credentialsJson,
  );
}

function isSigningPermissionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('iam.serviceAccounts.signBlob') ||
    error.message.includes('SigningError')
  );
}

let didWarnMissingStorageProxySecret = false;

function getStorageProxySecret() {
  const secret =
    process.env.ASSET_URL_SIGNING_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV !== 'production') {
    if (!didWarnMissingStorageProxySecret) {
      console.warn(
        '[storage] Missing ASSET_URL_SIGNING_SECRET / NEXTAUTH_SECRET; using local dev fallback for storage proxy tokens.',
      );
      didWarnMissingStorageProxySecret = true;
    }

    return 'imgman-local-storage-proxy-dev-secret';
  }

  throw new Error(
    'Missing ASSET_URL_SIGNING_SECRET or NEXTAUTH_SECRET for storage proxy fallback',
  );
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    ''
  ).replace(/\/$/, '');
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function createStorageProxyToken(payload: StorageProxyTokenPayload) {
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getStorageProxySecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifyStorageProxyToken(
  token: string,
): StorageProxyTokenPayload {
  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature) {
    throw new Error('Invalid storage proxy token');
  }

  const expectedSignature = crypto
    .createHmac('sha256', getStorageProxySecret())
    .update(encodedPayload)
    .digest('base64url');

  const provided = Buffer.from(signature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    throw new Error('Invalid storage proxy token signature');
  }

  const payload = JSON.parse(
    decodeBase64Url(encodedPayload),
  ) as StorageProxyTokenPayload;

  if (!payload.objectPath || !payload.expiresAt) {
    throw new Error('Invalid storage proxy token payload');
  }

  if (payload.expiresAt <= Date.now()) {
    throw new Error('Storage proxy token expired');
  }

  return payload;
}

function getStorageProxyUrl(
  objectPath: string,
  expiresInSeconds: number,
  bucketOverride?: string,
  orgId?: string,
) {
  const token = createStorageProxyToken({
    objectPath,
    bucketName: bucketOverride,
    orgId,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    fileName: objectPath.split('/').pop(),
  });
  const baseUrl = getAppBaseUrl();
  const path = `/api/storage/download?token=${encodeURIComponent(token)}`;

  return baseUrl ? `${baseUrl}${path}` : path;
}

/* ─── Bucket Helpers ──────────────────────────────────────── */

/** Get the default shared storage bucket, or the org-specific provider bucket. */
export function getGcsBucket(): StorageBucketHandle;
export function getGcsBucket(orgId: string): Promise<StorageBucketHandle>;
export function getGcsBucket(
  orgId?: string,
): StorageBucketHandle | Promise<StorageBucketHandle> {
  if (!orgId) {
    return createGcpBucketHandle(getDefaultBucketName());
  }

  return getOrgStorageBucketHandle(orgId);
}

/** Get a specific bucket by name using the org's configured storage provider. */
export function getBucketByName(bucket: string): StorageBucketHandle;
export function getBucketByName(
  bucket: string,
  orgId: string,
): Promise<StorageBucketHandle>;
export function getBucketByName(
  bucket: string,
  orgId?: string,
): StorageBucketHandle | Promise<StorageBucketHandle> {
  if (!orgId) {
    return createGcpBucketHandle(bucket);
  }

  return getOrgStorageBucketHandle(orgId, bucket);
}

/** Resolve the correct bucket: org-specific if configured, else default */
export function resolveOrgBucket(orgStorageBucket?: string): StorageBucketHandle;
export function resolveOrgBucket(
  orgStorageBucket: string | undefined,
  orgId: string,
): Promise<StorageBucketHandle>;
export function resolveOrgBucket(
  orgStorageBucket?: string,
  orgId?: string,
): StorageBucketHandle | Promise<StorageBucketHandle> {
  if (!orgId) {
    const name =
      orgStorageBucket && orgStorageBucket.trim()
        ? orgStorageBucket.trim()
        : getDefaultBucketName();
    return createGcpBucketHandle(name);
  }

  return getOrgStorageBucketHandle(orgId, orgStorageBucket);
}

/**
 * Generate a unique bucket name for a new organization.
 * Format: im-{slug}-{random6}
 */
export function generateOrgBucketName(slug: string): string {
  const rand = crypto.randomBytes(3).toString('hex'); // 6 hex chars
  return `im-${slug}-${rand}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * Create a new GCS bucket for an organization.
 * Returns the bucket name.
 */
export async function createOrgBucket(
  slug: string,
  region = 'us-central1',
): Promise<string> {
  const bucketName = generateOrgBucketName(slug);
  const [bucket] = await getDefaultStorageClient().createBucket(bucketName, {
    location: region,
    storageClass: 'STANDARD',
    uniformBucketLevelAccess: { enabled: true },
  });
  // Set lifecycle: auto-delete tmp objects after 1 day
  await bucket.setMetadata({
    lifecycle: {
      rule: [
        {
          action: { type: 'Delete' },
          condition: { age: 1, matchesPrefix: ['tmp/'] },
        },
      ],
    },
  });
  return bucketName;
}

function buildBaseStorageConfigUpdate(
  provider: StorageProviderId,
  bucket: string,
  region: string | undefined,
  isByoc: boolean,
) {
  return {
    'storageConfig.provider': provider,
    'storageConfig.bucket': bucket,
    'storageConfig.region': region ?? '',
    'storageConfig.isByoc': isByoc,
  } satisfies Record<string, unknown>;
}

function buildManagedStorageConfigResetFields(
  provider: StorageProviderId,
  bucket: string,
) {
  return {
    ...buildBaseStorageConfigUpdate(provider, bucket, undefined, false),
    'storageConfig.credentials': '',
    'storageConfig.vertexApiKey': '',
  } satisfies Record<string, unknown>;
}

async function validateGcpExternalBucket(
  bucket: string,
  credentials?: string,
): Promise<StorageValidationResult> {
  const probePath = `tmp/imgman-access-check/${Date.now()}-${crypto.randomUUID()}.txt`;
  const probeFile = createGcpBucketHandle(bucket, credentials).file(probePath);
  const probeContentType = 'text/plain';
  const probePayload = 'imgman-access-probe';

  try {
    await probeFile.save(probePayload, {
      resumable: false,
      contentType: probeContentType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `Service account cannot upload objects to bucket "${bucket}". Grant Storage Object Admin (or storage.objects.create + delete). Details: ${msg}`,
    };
  }

  let signedUploadUrl: string;
  try {
    const [url] = await probeFile.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 5 * 60 * 1000,
      contentType: probeContentType,
    });
    signedUploadUrl = url;
  } catch (err) {
    await probeFile.delete({ ignoreNotFound: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `Cannot generate a signed upload URL with this service account. If the JSON has no private_key, grant the SA the "Service Account Token Creator" role on itself. Details: ${msg}`,
    };
  }

  try {
    const putRes = await fetch(signedUploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': probeContentType },
      body: probePayload,
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      await probeFile.delete({ ignoreNotFound: true }).catch(() => {});
      return {
        valid: false,
        error: `Signed URL upload failed (HTTP ${putRes.status}). ${text.slice(0, 300)}`,
      };
    }
  } catch (err) {
    await probeFile.delete({ ignoreNotFound: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `Signed URL upload request failed: ${msg}`,
    };
  }

  try {
    await probeFile.delete({ ignoreNotFound: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `Service account cannot delete objects from bucket "${bucket}". Grant storage.objects.delete. Details: ${msg}`,
    };
  }

  return { valid: true };
}

async function validateAwsExternalBucket(
  bucket: string,
  credentials?: string,
  region?: string,
): Promise<StorageValidationResult> {
  if (!region?.trim()) {
    return {
      valid: false,
      error: 'AWS S3 region is required to validate an external bucket',
    };
  }

  let probeFile: StorageFileHandle;
  try {
    const probePath = `tmp/imgman-access-check/${Date.now()}-${crypto.randomUUID()}.txt`;
    probeFile = createAwsBucketHandle(bucket, region, credentials).file(probePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `Unable to initialize AWS credentials. Details: ${msg}`,
    };
  }

  const probePayload = 'imgman-access-probe';
  const probeContentType = 'text/plain';

  try {
    await probeFile.save(probePayload, {
      resumable: false,
      contentType: probeContentType,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `AWS credentials cannot upload objects to bucket "${bucket}". Details: ${msg}`,
    };
  }

  try {
    const [signedUrl] = await probeFile.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 5 * 60 * 1000,
      contentType: probeContentType,
    });

    const putRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': probeContentType },
      body: probePayload,
    });

    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      await probeFile.delete({ ignoreNotFound: true }).catch(() => {});
      return {
        valid: false,
        error: `AWS signed URL upload failed (HTTP ${putRes.status}). ${text.slice(0, 300)}`,
      };
    }
  } catch (err) {
    await probeFile.delete({ ignoreNotFound: true }).catch(() => {});
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `AWS signed URL validation failed. Details: ${msg}`,
    };
  }

  try {
    await probeFile.delete({ ignoreNotFound: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      valid: false,
      error: `AWS credentials cannot delete objects from bucket "${bucket}". Details: ${msg}`,
    };
  }

  return { valid: true };
}

function createUnsupportedStorageProviderAdapter(
  provider: Exclude<StorageProviderId, 'gcp' | 'aws'>,
): StorageProviderAdapter {
  return {
    id: provider,
    validateExternalBucket: async () => ({
      valid: false,
      error: `Provider "${provider}" BYOC not yet supported`,
    }),
    buildManagedStorageConfigUpdate: (bucket) =>
      buildManagedStorageConfigResetFields(provider, bucket),
    buildByocStorageConfigUpdate: ({ bucket, region }) => ({
      ...buildBaseStorageConfigUpdate(provider, bucket.trim(), region, true),
      'storageConfig.credentials': '',
      'storageConfig.vertexApiKey': '',
    }),
  };
}

const gcpStorageProviderAdapter: StorageProviderAdapter = {
  id: 'gcp',
  createManagedBucket: (slug, region) => createOrgBucket(slug, region),
  validateExternalBucket: validateGcpExternalBucket,
  buildManagedStorageConfigUpdate: (bucket) =>
    buildManagedStorageConfigResetFields('gcp', bucket),
  buildByocStorageConfigUpdate: ({ bucket, region, credentials, vertexApiKey }) => ({
    ...buildBaseStorageConfigUpdate('gcp', bucket.trim(), region, true),
    'storageConfig.credentials': encryptStoredGcpCredentials(credentials) ?? '',
    'storageConfig.vertexApiKey': '',
    'aiProviderConfig.vertexApiKey': encryptStoredVertexApiKey(vertexApiKey) ?? '',
  }),
};

const awsStorageProviderAdapter: StorageProviderAdapter = {
  id: 'aws',
  validateExternalBucket: validateAwsExternalBucket,
  buildManagedStorageConfigUpdate: (bucket) =>
    buildManagedStorageConfigResetFields('aws', bucket),
  buildByocStorageConfigUpdate: ({ bucket, region, credentials }) => ({
    ...buildBaseStorageConfigUpdate('aws', bucket.trim(), getAwsRegion(region), true),
    'storageConfig.credentials': encryptStoredAwsCredentials(credentials) ?? '',
    'storageConfig.vertexApiKey': '',
  }),
};

const STORAGE_PROVIDER_ADAPTERS: Record<StorageProviderId, StorageProviderAdapter> = {
  gcp: gcpStorageProviderAdapter,
  aws: awsStorageProviderAdapter,
  azure: createUnsupportedStorageProviderAdapter('azure'),
};

export function getStorageProviderAdapter(provider: StorageProviderId) {
  return STORAGE_PROVIDER_ADAPTERS[provider];
}

export async function createManagedStorageBucket(
  provider: StorageProviderId,
  slug: string,
  region = 'us-central1',
) {
  const adapter = getStorageProviderAdapter(provider);

  if (!adapter.createManagedBucket) {
    throw new Error(`Provider "${provider}" does not support managed bucket provisioning`);
  }

  return adapter.createManagedBucket(slug, region);
}

export function buildManagedStorageConfigUpdate(
  provider: StorageProviderId,
  bucket: string,
) {
  return getStorageProviderAdapter(provider).buildManagedStorageConfigUpdate(
    bucket.trim(),
  );
}

export function buildByocStorageConfigUpdate(
  provider: StorageProviderId,
  input: StorageProviderConfigUpdateInput,
) {
  return getStorageProviderAdapter(provider).buildByocStorageConfigUpdate(input);
}

/**
 * Validate that a BYOC bucket is accessible (can list objects).
 * Returns true if access is valid.
 */
export async function validateExternalBucket(
  provider: StorageProviderId,
  bucket: string,
  credentials?: string,
  region?: string,
): Promise<{ valid: boolean; error?: string }> {
  return getStorageProviderAdapter(provider).validateExternalBucket(
    bucket,
    credentials,
    region,
  );
}

/* ─── Signed URL Helpers ──────────────────────────────────── */

export async function getSignedDownloadUrl(
  objectPath: string,
  expiresInSeconds = 60 * 60,
  bucketOverride?: string,
  orgId?: string,
) {
  const bucket = bucketOverride
    ? orgId
      ? await getBucketByName(bucketOverride, orgId)
      : getBucketByName(bucketOverride)
    : orgId
      ? await getGcsBucket(orgId)
      : getGcsBucket();
  try {
    const [url] = await bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInSeconds * 1000,
    });

    return url;
  } catch (error) {
    if (!isSigningPermissionError(error)) {
      throw error;
    }

    console.warn(
      `[storage] Falling back to app proxy download URL for ${objectPath}: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return getStorageProxyUrl(objectPath, expiresInSeconds, bucketOverride, orgId);
  }
}

export async function getSignedUploadUrl(
  objectPath: string,
  contentType: string,
  expiresInSeconds = 15 * 60,
  bucketOverride?: string,
  orgId?: string,
) {
  const bucket = bucketOverride
    ? orgId
      ? await getBucketByName(bucketOverride, orgId)
      : getBucketByName(bucketOverride)
    : orgId
      ? await getGcsBucket(orgId)
      : getGcsBucket();
  try {
    const [url] = await bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInSeconds * 1000,
      contentType,
    });

    return url;
  } catch (error) {
    if (!isSigningPermissionError(error)) {
      throw error;
    }

    console.warn(
      `[storage] Falling back to resumable upload URL for ${objectPath}: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    const uploadResponse = (await bucket
      .file(objectPath)
      .createResumableUpload({
        origin: getAppBaseUrl() || undefined,
        metadata: {
          contentType,
        },
      })) as unknown as [string];
    const url = uploadResponse[0];

    return url;
  }
}

/* ─── Data Operations ─────────────────────────────────────── */

/**
 * Download an object from GCS directly into a Buffer.
 */
export async function downloadToBuffer(
  objectPath: string,
  bucketOverride?: string,
  orgId?: string,
): Promise<Buffer> {
  const bucket = bucketOverride
    ? orgId
      ? await getBucketByName(bucketOverride, orgId)
      : getBucketByName(bucketOverride)
    : orgId
      ? await getGcsBucket(orgId)
      : getGcsBucket();
  const [buffer] = await bucket.file(objectPath).download();
  return buffer;
}

/**
 * Upload a Buffer to GCS with the given content type.
 * Returns the storage path (key) that was written.
 */
export async function uploadBuffer(
  objectPath: string,
  data: Buffer,
  contentType: string,
  metadata?: Record<string, string>,
  bucketOverride?: string,
  orgId?: string,
): Promise<string> {
  const bucket = bucketOverride
    ? orgId
      ? await getBucketByName(bucketOverride, orgId)
      : getBucketByName(bucketOverride)
    : orgId
      ? await getGcsBucket(orgId)
      : getGcsBucket();
  const file = bucket.file(objectPath);
  await file.save(data, {
    contentType,
    metadata: metadata ? { metadata } : undefined,
    resumable: false,
  });
  return objectPath;
}

/**
 * Delete an object from GCS (ignores "not found" errors).
 */
export async function deleteObject(
  objectPath: string,
  bucketOverride?: string,
  orgId?: string,
): Promise<void> {
  try {
    const bucket = bucketOverride
      ? orgId
        ? await getBucketByName(bucketOverride, orgId)
        : getBucketByName(bucketOverride)
      : orgId
        ? await getGcsBucket(orgId)
        : getGcsBucket();
    await bucket.file(objectPath).delete();
  } catch {
    // Ignore — object may already be gone
  }
}
