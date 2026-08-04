# Bring Your Own Cloud (BYOC) Storage

> **Status:** PUBLISHED
> **Last updated:** 2026-04-30
> **Applies to:** All plans (self-hosted) and the Cloud Pro/Enterprise tiers

## What it does

img-man lets every organization plug in **its own** Google Cloud Storage bucket or AWS S3 bucket as the asset store. Files never leave your cloud account; img-man only stores metadata, thumbnails, and signed URLs in MongoDB.

## When to use it

- Your security/compliance team requires data to live in a specific cloud account or region.
- You already have a bucket with assets and want img-man to index them.
- You need predictable cloud bills under your existing committed-use discounts.

## Supported providers

| Provider | Status | Notes |
| --- | --- | --- |
| Google Cloud Storage (GCP) | ✅ Active | Service-account JSON, regional or multi-region. |
| Amazon S3 (AWS) | ✅ Active | Access key + secret, signed URLs (SigV4). |
| Azure Blob Storage | 🟡 Planned | Identifier reserved in `STORAGE_PROVIDERS`. |

## Step-by-step

### Connect a GCP bucket

1. In Google Cloud Console, create (or pick) a bucket. Enable **Uniform bucket-level access**.
2. Create a service account with the role **Storage Object Admin** scoped to that bucket.
3. Generate a JSON key for the service account.
4. In the img-man dashboard, open **Settings → Storage** and choose **Google Cloud Storage**.
5. Paste the JSON key and the bucket name. Click **Validate & Save**.
6. img-man runs a connectivity check (`storage.objects.list` + `storage.objects.create` against a test prefix) and rejects the credentials if they cannot read or write the bucket.

### Connect an S3 bucket

1. In AWS, create the bucket. Block public access stays **on**.
2. Create an IAM user with a policy that allows `s3:GetObject`, `s3:PutObject`, `s3:ListBucket`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>` and `arn:aws:s3:::<bucket>/*`.
3. Generate an access key + secret access key for the IAM user.
4. In the img-man dashboard, open **Settings → Storage** and choose **AWS S3**.
5. Paste the access key, secret, and region. Click **Validate & Save**.

## How credentials are stored

- Credentials are encrypted at rest with **AES-256-GCM** before being written to MongoDB.
- The Key Encryption Key (KEK) is derived from `GCP_CREDENTIALS_ENCRYPTION_KEY` (or `NEXTAUTH_SECRET` if the dedicated env var is not set) using SHA-256.
- IV and auth tag are stored alongside the ciphertext in the same envelope.
- Credentials are never logged or returned through the API. The settings UI only shows whether a key is set, not its value.
- See [credential-rotation.md](credential-rotation.md) for the rotation procedure.

## How signed URLs work

- All asset URLs returned by the dashboard or the API are **short-lived signed URLs**, generated on demand from your stored credentials.
- Default lifetime is 10 minutes; custom lifetimes are clamped to 60 minutes.
- The browser fetches bytes directly from your bucket, never through the img-man server.

## Tips & limits

- Switching the storage provider on an existing org **does not migrate** existing assets. Use the migration tools (see [migration.md](migration.md)) before flipping the switch.
- BYOC and BYOK (bring-your-own-AI-key) are independent. You can use a GCP bucket and OpenAI for AI, or vice-versa.
- For local development you may set `GCP_*` / `AWS_*` env vars on the process. These act as a default for an org that has not configured per-org credentials yet.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| `Validate & Save` returns "permission denied". | The service account / IAM user lacks Object Admin (GCP) or the policy listed above (AWS). | Re-issue credentials with the correct role. |
| Assets render as broken images after switching provider. | The new bucket is empty; img-man still references the old `storageKey`. | Run a migration (see [migration.md](migration.md)) or revert the provider. |
| `Unable to decrypt stored credentials`. | `GCP_CREDENTIALS_ENCRYPTION_KEY` (or fallback `NEXTAUTH_SECRET`) was changed without re-encrypting. | Restore the previous KEK or re-enter the credentials. See [credential-rotation.md](credential-rotation.md). |
| AWS signed URLs return 403 in the browser only. | The bucket has a CORS policy that blocks the dashboard origin. | Add an `AllowedOrigin` for your img-man host with `GET, PUT, HEAD` methods. |

## Related

- [credential-rotation.md](credential-rotation.md) — Rotate the KEK and stored credentials.
- [storage-providers.md](storage-providers.md) — Provider-by-provider reference matrix.
- [self-hosting.md](self-hosting.md) — Wiring env vars when you self-host.
- [backup-restore.md](backup-restore.md) — Recovery steps after a provider migration or credential loss.
