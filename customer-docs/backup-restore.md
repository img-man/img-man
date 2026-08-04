# Backup & Restore

> **Status:** PUBLISHED
> **Last updated:** 2026-05-01
> **Applies to:** Self-host (cloud is fully managed)

## What it does

Captures everything you need to recover an img-man instance after a disaster: the MongoDB metadata, the storage-bucket pointers (or the bucket contents themselves if you don't use BYOC), and the encryption key (KEK) that unlocks stored credentials.

## When to use it

- Before upgrading between minor versions.
- Before changing the storage provider for an org.
- Disaster recovery drills (recommended quarterly).
- Migrating from one host / region to another.

## What to back up

| Component | Where | Recovery point |
|---|---|---|
| **MongoDB** | Your Mongo Atlas cluster or self-hosted replica set | Hourly snapshots, 30-day retention |
| **GCP / S3 bucket** (managed storage only) | Your cloud provider | Versioning enabled is enough |
| **KEK** (encryption key for stored credentials) | A secret manager (GCP Secret Manager / AWS Secrets Manager / Vault) | Rotate using [Credential rotation](credential-rotation.md) |
| **Per-org BYOC credentials** | Already encrypted at rest with the KEK; covered by the Mongo backup | — |
| **Audit log** | Already in MongoDB; covered by the Mongo backup | See [Audit log](audit-log.md) for retention |
| **Polotno license key** (if using Polotno SDK) | Your `.env` / secret manager | — |

## Step-by-step — Take a backup

1. **Snapshot MongoDB.**
   - Atlas: _Project → Backups → Take snapshot_.
   - Self-hosted: `mongodump --uri "$MONGODB_URI" --gzip --archive=imageman-$(date +%F).gz`.
2. **Verify bucket versioning.** GCP: `gcloud storage buckets describe gs://your-bucket --format="value(versioning.enabled)"`. AWS: `aws s3api get-bucket-versioning --bucket your-bucket`.
3. **Export the KEK** to a sealed envelope in your secret manager. **Do not** check it into git, even encrypted.
4. **Generate a diagnostics bundle** (see below) and store it alongside the snapshot.

Schedule the above weekly; for compliance modes (HIPAA, SOC 2 Type II) make it nightly.

## Step-by-step — Restore

1. **Provision** a new instance with matching `MONGODB_URI`, `KEK`, and `IMAGEMAN_BASE_URL`.
2. **Restore Mongo** from the snapshot.
   - Atlas: _Backups → Restore → Select snapshot_.
   - Self-hosted: `mongorestore --uri "$MONGODB_URI" --gzip --archive=imageman-2026-04-12.gz --drop`.
3. **Re-verify storage access.** Open _Settings → Storage → Test connection_; the BYOC credentials decrypt with the KEK and the test should pass without any manual re-entry.
4. **Run the smoke test** (see _Verifying a restore_ below).
5. **Re-issue API keys** for any clients whose key material was lost. Existing keys keep working as long as the Mongo restore included the keys collection.

## Diagnostics bundle

`/api/v1/admin/diagnostics` (Pro+) returns a redacted ZIP with:

- Build version, Node version, OS.
- Mongo connection state, replica-set members, index stats.
- Storage provider, bucket region, signed-URL roundtrip.
- AI provider list and last-success timestamp per model.
- Last 1 000 audit entries (already redacted via [credential redaction](credential-rotation.md)).
- Recent error stacks with secrets stripped.

Use it when you open a support ticket — it shaves hours off the back-and-forth.

## Verifying a restore

Run this checklist after every restore:

1. Sign in as an existing user.
2. Browse a folder; thumbnails load.
3. Generate a transform URL; the rendered image returns 200.
4. Trigger a small AI edit; credits deduct correctly.
5. Confirm a new audit entry appears with the restore action.

## Related

- [Self-hosting](self-hosting.md)
- [Credential rotation](credential-rotation.md)
- [Audit log](audit-log.md)
- [Migration](migration.md)
