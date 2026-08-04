# Storage Providers

> **Status:** PUBLISHED
> **Last updated:** 2026-04-30
> **Applies to:** All plans

## What it does

img-man stores asset bytes in an object-storage bucket and stores asset **metadata** (id, name, tags, size, dimensions, dominant colors, embeddings, audit log…) in MongoDB. The bucket is owned by *you* and configured per-organization. This page is the reference for which providers are supported and how each one is wired.

## Provider matrix

| Provider | Status | Status check | Signed URLs | Direct browser upload | Notes |
|----------|--------|--------------|-------------|----------------------|-------|
| Google Cloud Storage (GCP) | ✅ Active | List + write probe | V4 signed URLs (GET/PUT) | ✅ | Default for the platform. |
| Amazon S3 (AWS) | ✅ Active | List + write probe | SigV4 signed URLs | ✅ | Region required. |
| Azure Blob Storage | 🟡 Planned | — | — | — | Identifier reserved. |

The table above is the supported public contract for customer deployments.

## How it's wired

```text
┌──────────────┐   per-org credentials   ┌──────────────────┐
│   Browser    │ ──── signed URL ────▶  │  Your bucket     │
└──────────────┘                         │  (GCP / S3)      │
       ▲                                 └──────────────────┘
       │   metadata + signed URLs
       │
┌──────────────┐
│  img-man    │ ── reads encrypted ──▶ MongoDB
│  app server  │     credentials
└──────────────┘
```

- The app server **never proxies asset bytes** in the steady state. Browsers fetch and upload directly to your bucket using short-lived signed URLs.
- Per-org credentials are encrypted with AES-256-GCM (see [credential-rotation.md](credential-rotation.md)).
- All storage operations follow the same platform path: validate credentials, mint short-lived signed URLs, then let the browser transfer bytes directly to your bucket.

## GCP details

- Auth: service-account JSON pasted in **Settings → Storage**. Stored encrypted.
- Roles required: `roles/storage.objectAdmin` on the target bucket.
- Defaults env vars (single-tenant bootstrap): `GCP_PROJECT_ID`, `GCS_BUCKET`, `GCP_SERVICE_ACCOUNT_JSON`.
- Region: any. For latency, host the bucket in the same region as the img-man compute.

## AWS S3 details

- Auth: access key + secret pair scoped to the target bucket. Stored encrypted.
- IAM policy minimum: `s3:GetObject`, `s3:PutObject`, `s3:ListBucket`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>` and `arn:aws:s3:::<bucket>/*`.
- Defaults env vars (single-tenant bootstrap): `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`.
- CORS: add an `AllowedOrigin` for your dashboard host with `GET, PUT, HEAD`.

## Switching providers

Switching the active provider does **not** copy existing objects across buckets. Either:

1. Use the [migration tools](migration.md) to copy objects between buckets first, then flip the provider.
2. Or accept that historical assets will return 404 on the new provider until you migrate them.

## Tips & limits

- Bucket names must be globally unique on AWS S3 and on GCP.
- Asset URLs returned by the API are signed and expire after 10 minutes by default (configurable up to 60 minutes).
- The eval Docker image (`Dockerfile.eval`) does not ship a bucket — it's metadata-only and assumes you'll plug in storage afterwards.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| `Validate & Save` reports "Bucket not reachable". | Network egress is blocked from the img-man host, or credentials lack list permissions. | Check VPC egress rules and the IAM policy. |
| Direct uploads work but downloads 403. | Signed-URL clock skew. | NTP-sync the img-man host. Tokens are time-bound. |
| AWS region mismatch. | Bucket lives in `us-east-2` but the credentials default to `us-east-1`. | Set the correct region in **Settings → Storage**. |

## Related

- [byoc.md](byoc.md) — End-user walkthrough for connecting buckets.
- [migration.md](migration.md) — Copying assets between providers.
- [credential-rotation.md](credential-rotation.md) — Rotating storage credentials.
