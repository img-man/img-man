// SPDX-License-Identifier: Apache-2.0
import { connectToDatabase } from './db';
import { Organization } from '@/models';
import { decryptStoredSecret, encryptStoredSecret } from './secret-crypto';

const ENCRYPTED_CREDENTIALS_PREFIX = 'enc:gcp:v1:';
const ENCRYPTED_VERTEX_API_KEY_PREFIX = 'enc:vertex-api-key:v1:';

type ServiceAccountCredentials = {
  project_id?: string;
  [key: string]: unknown;
};

export interface OrgGcpConfig {
  projectId: string;
  bucket?: string;
  credentialsJson?: string;
}

export interface ServiceAccountAuthConfig {
  projectId: string;
  credentials?: ServiceAccountCredentials;
}

export interface ServiceAccountGoogleAuthOptions {
  credentials?: ServiceAccountCredentials;
  projectId: string;
  scopes: string[];
}

function getFallbackProjectId() {
  const projectId = process.env.GCP_PROJECT_ID ?? '';

  if (!projectId) {
    throw new Error('Missing GCP_PROJECT_ID in environment variables');
  }

  return projectId;
}

export function encryptStoredGcpCredentials(credentialsJson?: string) {
  if (!credentialsJson?.trim()) {
    return undefined;
  }

  if (credentialsJson.startsWith(ENCRYPTED_CREDENTIALS_PREFIX)) {
    return credentialsJson;
  }

  return encryptStoredSecret(credentialsJson.trim(), ENCRYPTED_CREDENTIALS_PREFIX);
}

export function decryptStoredGcpCredentials(credentialsValue?: string) {
  if (!credentialsValue?.trim()) {
    return undefined;
  }

  if (!credentialsValue.startsWith(ENCRYPTED_CREDENTIALS_PREFIX)) {
    return credentialsValue;
  }

  try {
    return decryptStoredSecret(credentialsValue, ENCRYPTED_CREDENTIALS_PREFIX);
  } catch {
    throw new Error('Unable to decrypt stored GCP credentials');
  }
}

export function encryptStoredVertexApiKey(apiKey?: string) {
  if (!apiKey?.trim()) {
    return undefined;
  }

  if (apiKey.startsWith(ENCRYPTED_VERTEX_API_KEY_PREFIX)) {
    return apiKey;
  }

  return encryptStoredSecret(apiKey.trim(), ENCRYPTED_VERTEX_API_KEY_PREFIX);
}

export function decryptStoredVertexApiKey(apiKeyValue?: string) {
  if (!apiKeyValue?.trim()) {
    return undefined;
  }

  if (!apiKeyValue.startsWith(ENCRYPTED_VERTEX_API_KEY_PREFIX)) {
    return apiKeyValue;
  }

  try {
    return decryptStoredSecret(apiKeyValue, ENCRYPTED_VERTEX_API_KEY_PREFIX);
  } catch {
    throw new Error('Unable to decrypt stored Vertex API key');
  }
}

function parseServiceAccountJson(credentialsJson?: string): ServiceAccountAuthConfig {
  const normalizedCredentials = decryptStoredGcpCredentials(credentialsJson);

  if (!normalizedCredentials?.trim()) {
    return { projectId: getFallbackProjectId() };
  }

  try {
    const parsed = JSON.parse(normalizedCredentials) as ServiceAccountCredentials;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid service account JSON');
    }

    return {
      projectId: typeof parsed.project_id === 'string' && parsed.project_id.trim()
        ? parsed.project_id
        : getFallbackProjectId(),
      credentials: parsed,
    };
  } catch {
    throw new Error('Invalid GCP service account JSON');
  }
}

export async function getOrgGcpConfig(orgId?: string): Promise<OrgGcpConfig> {
  if (!orgId) {
    return { projectId: getFallbackProjectId() };
  }

  await connectToDatabase();

  const org = await Organization.findById(orgId).select('storageConfig').lean();
  const storageConfig = org?.storageConfig as
    | { provider?: string; bucket?: string; credentials?: string; isByoc?: boolean }
    | undefined;

  // BYOC integrity guard: if the org is marked as BYOC but the customer's
  // service-account JSON is missing or empty, fall back would silently use
  // the platform default SA — which almost never has access to the customer
  // bucket and surfaces as a confusing "insufficient access" error from GCS.
  // Fail fast with a clear, actionable message instead.
  if (
    storageConfig?.isByoc &&
    storageConfig?.provider === 'gcp' &&
    !storageConfig?.credentials?.trim()
  ) {
    throw new Error(
      `BYOC is enabled for org "${orgId}" but no GCP service-account credentials are stored. ` +
        `Re-save the bucket connection in Settings → Storage to upload the customer JSON key.`,
    );
  }

  const parsed =
    storageConfig?.provider === 'gcp'
      ? parseServiceAccountJson(storageConfig.credentials)
      : { projectId: getFallbackProjectId() };

  return {
    projectId: parsed.projectId,
    bucket: storageConfig?.bucket?.trim() || undefined,
    credentialsJson:
      storageConfig?.provider === 'gcp'
        ? decryptStoredGcpCredentials(storageConfig.credentials?.trim())
        : undefined,
  };
}

export function resolveServiceAccountAuth(
  credentialsJson?: string,
): ServiceAccountAuthConfig {
  return parseServiceAccountJson(credentialsJson);
}

export function buildGoogleAuthOptions(
  credentialsJson?: string,
): ServiceAccountGoogleAuthOptions | undefined {
  if (!credentialsJson?.trim()) {
    return undefined;
  }

  const auth = parseServiceAccountJson(credentialsJson);

  return {
    credentials: auth.credentials,
    projectId: auth.projectId,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };
}
