// SPDX-License-Identifier: Apache-2.0
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { getSignedUploadUrl } from '@/lib/storage';
import { existsSync } from 'fs';
import path from 'path';

type ReadinessCheckResult = {
 ok: boolean;
 status: 'up' | 'down';
 error?: string;
 prompt?: string;
};

type ReadyHealthOptions = {
 connectToDatabase?: () => Promise<unknown>;
 checkStorage?: () => Promise<ReadinessCheckResult>;
 requireStorage?: boolean;
};

function mapStorageErrorToPrompt(message: string) {
 const lower = message.toLowerCase();

 if (lower.includes('invalid_grant') && lower.includes('account not found')) {
    return 'Bucket configuration is not working: configured GCP service account was not found. Update service-account credentials in Settings -> Storage or fix GCP credential env values and restart.';
 }

 if (lower.includes('missing gcp_storage_bucket') || lower.includes('legacy gcs_bucket')) {
    return 'Bucket configuration is missing. Set GCP_STORAGE_BUCKET (or GCS_BUCKET) and restart, or connect a BYOC bucket in Settings -> Storage.';
 }

 if (lower.includes('missing gcp_project_id')) {
    return 'Bucket configuration is incomplete. Set GCP_PROJECT_ID and restart the service.';
 }

 if (lower.includes('unable to decrypt stored gcp credentials')) {
    return 'Stored bucket credentials cannot be decrypted. Re-save bucket credentials in Settings -> Storage.';
 }

 if (lower.includes('invalid gcp service account json')) {
    return 'Stored bucket service-account JSON is invalid. Re-save a valid service-account key in Settings -> Storage.';
 }

 return 'Bucket configuration is not working. Verify GCP project, bucket, and service-account credentials, then restart the service.';
}

async function checkStorageReadiness(): Promise<ReadinessCheckResult> {
 const credentialsPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GCP_APP_CREDENTIALS_PATH ||
    process.env.GCP_SERVICE_ACCOUNT_PATH;

 if (credentialsPath?.trim()) {
    const absolutePath = path.resolve(credentialsPath.trim());
    if (!existsSync(absolutePath)) {
     return {
        ok: false,
        status: 'down',
        error: `Storage credentials file was not found at ${absolutePath}`,
        prompt:
         'Bucket configuration is not working: credentials file path is invalid. Fix GOOGLE_APPLICATION_CREDENTIALS or GCP_APP_CREDENTIALS_PATH and restart.',
     };
    }
 }

 try {
    const probePath = `healthchecks/${Date.now()}.txt`;
    await getSignedUploadUrl(probePath, 'text/plain', 60);

    return { ok: true, status: 'up' };
 } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    return {
     ok: false,
     status: 'down',
     error: message,
     prompt: mapStorageErrorToPrompt(message),
    };
 }
}

export async function createReadyHealthResponse(options: ReadyHealthOptions = {}) {
 const connect = options.connectToDatabase ?? connectToDatabase;
 const checkStorage = options.checkStorage ?? checkStorageReadiness;
 const requireStorage =
    options.requireStorage ??
    (process.env.HEALTHCHECK_REQUIRE_STORAGE ?? '1') !== '0';

 try {
    await connect();

    const storage = requireStorage
     ? await checkStorage()
     : ({ ok: true, status: 'up' } as ReadinessCheckResult);

    if (!storage.ok) {
     return NextResponse.json(
        {
         ok: false,
         status: 'not-ready',
         database: 'up',
         storage: storage.status,
         error: storage.error,
         prompt: storage.prompt,
         timestamp: new Date().toISOString(),
        },
        { status: 503 },
     );
    }

  return NextResponse.json({
   ok: true,
   status: 'ready',
   database: 'up',
     storage: storage.status,
   timestamp: new Date().toISOString(),
  });
 } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
   {
    ok: false,
    status: 'not-ready',
    database: 'down',
        storage: 'down',
        error: message,
        prompt:
         'Not able to connect to DB. Check MONGODB_URI, MONGODB_DB, and network access for your database, then restart the service.',
    timestamp: new Date().toISOString(),
   },
   { status: 503 },
  );
 }
}