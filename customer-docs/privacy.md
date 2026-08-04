# Privacy and Data Handling

**Status:** PUBLISHED — 2026-05-06 | **Category:** Privacy & Compliance

This document explains how img-man handles the data you store and upload to the platform, your rights over that data, and the boundaries between what img-man controls and what you control.

---

## Self-hosted instances

If you run img-man yourself (Apache-2.0 open-source deployment), **you are the data controller** for everything stored in your instance. img-man (the project) has no access to your database, your storage bucket, or your assets.

Your responsibilities:
- Securing the server and network.
- Configuring database access controls.
- Managing backup and retention.
- Complying with applicable data-protection law for your jurisdiction and users.

---

## Cloud-support customers

If you are on the Cloud Setup & Operations Support plan, img-man acts as a **data processor** only for the configuration and diagnostic information you share during support interactions (e.g., a diagnostics bundle exported from the dashboard). Your asset data remains in your own storage bucket.

A Data Processing Agreement (DPA) template is available on request at `security@imageman.io`.

---

## What data img-man stores

| Data type | Where stored | Who controls it |
| --- | --- | --- |
| Asset files (images, videos, PDFs) | Your GCP / AWS bucket | You |
| Asset metadata (filenames, tags, dimensions, AI tags) | MongoDB in your deployment | You |
| User accounts and sessions | MongoDB in your deployment | You |
| Organisation settings and API keys | MongoDB in your deployment | You |
| BYOC / BYOK credentials | MongoDB (AES-256-GCM encrypted) | You (KEK is your `ENCRYPTION_KEY`) |
| Design files (Polotno JSON) | MongoDB in your deployment | You |
| Audit log entries | MongoDB in your deployment | You |
| Telemetry events (if opted in) | img-man telemetry endpoint | img-man (anonymized; see [Telemetry](telemetry.md)) |

---

## Right to deletion

### Soft delete (Trash)

When you delete an asset in the dashboard it is moved to **Trash** and held for 30 days before permanent deletion. During this window:
- The asset is not visible in your library.
- The asset is not accessible via its public URL or share link.
- You can restore it from **Trash & Vault** at any time.

### Hard delete (permanent)

After the 30-day retention window the asset is permanently deleted from MongoDB and from your storage bucket. This operation is not reversible.

You can also permanently delete an asset before the window expires by opening **Trash & Vault → Empty** or by selecting individual items and choosing **Delete permanently**.

### Bulk deletion and org deletion

Deleting your img-man organisation permanently queues all its assets, designs, metadata, API keys, and user memberships for immediate hard deletion. This cannot be undone.

To delete an org, go to **Settings → Danger Zone → Delete Organisation** and confirm by typing the org slug.

### User account deletion

Deleting your user account removes your profile, session history, and agent memory from all organisations you are a member of. Assets and designs you created remain under org ownership.

To request deletion of your user account, go to **Settings → Account → Delete Account**.

---

## Data residency

**Self-hosted:** Your data is in whatever region you deploy your server and storage bucket. img-man does not copy or replicate your data outside that region.

**Telemetry (opt-in):** Anonymized telemetry events are processed at `telemetry.imageman.io` which is hosted in the United States (GCP us-central1). No personal data or content is included in telemetry events.

---

## AI provider data

When you use AI features (auto-tag, background remove, generate, expand, etc.), img-man sends the relevant image data to your configured AI provider (Vertex AI or OpenAI) under your own API key. img-man does not retain the AI provider's response beyond the immediate operation. The AI provider's own privacy policy governs how they handle the image data during processing.

To minimise exposure, img-man sends only the minimum required data for each operation (e.g., a thumbnail for tagging, not the full-resolution original where the API supports it).

---

## Encryption at rest

BYOC credentials (GCP service account JSON, AWS access keys) and BYOK AI API keys are encrypted with AES-256-GCM before being stored in MongoDB. The encryption key (`ENCRYPTION_KEY` env var) is never stored in the database. See [Credential rotation](credential-rotation.md) for key rotation procedures.

All other data (asset metadata, user records, designs, audit logs) is stored unencrypted in MongoDB. Operators are responsible for enabling MongoDB encryption at rest if required by their compliance framework.

---

## Cookies and tracking

img-man uses one session cookie (`next-auth.session-token`) per authenticated user. This cookie is:
- HTTP-only (not accessible via JavaScript).
- Scoped to your instance's domain.
- Used only for authentication.

No third-party tracking cookies or pixels are used in the dashboard. If telemetry is enabled, the single outbound event described above is the only external call.

---

## GDPR posture

- **Self-hosted:** You are the data controller. Standard Contractual Clauses are not required because data transfer is solely within your own infrastructure.
- **Cloud-support plan:** img-man is your processor for support interactions only. DPA available on request.
- **Telemetry:** No personal data is included in telemetry events. Opt-out means zero data transfer.

---

## Contact

For privacy questions, deletion requests that cannot be completed through the dashboard, or DPA requests:

**Email:** `security@imageman.io`

**Related:** [Telemetry](telemetry.md) · [Audit log](audit-log.md) · [Backup & restore](backup-restore.md) · [Trash & Vault](features/vault.md)
