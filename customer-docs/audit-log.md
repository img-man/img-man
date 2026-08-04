# Audit Log

> **Status:** PUBLISHED
> **Last updated:** 2026-04-18
> **Applies to:** All plans (advanced filters Pro+, immutable retention Enterprise)

## What it does

Records every security- and compliance-relevant action that happens inside your img-man organization — who did what, to what, from where, and when — and lets you search, export, and retain that history.

## When to use it

- Investigating a suspicious sign-in or a deleted asset.
- Producing evidence for SOC 2 / ISO 27001 / GDPR audits.
- Tracking who rotated an API key, changed billing, or shared an asset publicly.
- Building internal dashboards on top of your team's activity.

## What gets logged

Every event captures `actor` (user or API key), `target` (asset / folder / user / setting), `action`, `ip`, `userAgent`, `metadata`, and `createdAt`. The following actions are always recorded:

| Category | Actions | Example |
|---|---|---|
| **Auth** | `auth.signin`, `auth.signin.failed`, `auth.signout`, `auth.mfa.enabled`, `auth.mfa.disabled`, `auth.password.reset` | A teammate signs in from a new country. |
| **Roles & access** | `member.invited`, `member.role.changed`, `member.removed`, `share.link.created`, `share.link.revoked` | An owner promotes someone to admin. |
| **Provider config** | `provider.storage.added`, `provider.storage.removed`, `provider.ai.added`, `provider.ai.removed`, `provider.smtp.tested` | Switching from GCS to S3. |
| **API keys** | `apikey.created`, `apikey.rotated`, `apikey.revoked`, `apikey.scope.changed` | Rotating a leaked key. |
| **Migrations** | `migration.started`, `migration.completed`, `migration.failed` | Bulk-migrating 50k assets to a new bucket. |
| **Assets** | `asset.uploaded`, `asset.deleted`, `asset.restored`, `asset.shared`, `asset.unshared`, `asset.tagged`, `asset.moved` | Deleting a folder of 200 photos. |
| **Designs** | `design.created`, `design.published`, `design.deleted`, `design.exported` | Publishing a public design. |
| **AI** | `ai.image.generated`, `ai.image.edited`, `ai.bg.removed` | Running background removal. |
| **Billing** | `billing.plan.changed`, `billing.payment.method.updated`, `billing.invoice.downloaded` | Upgrading from Free to Pro. |
| **Admin** | `admin.settings.changed`, `admin.audit.exported`, `admin.retention.changed` | Lengthening retention from 90 to 180 days. |

The full schema lives in `src/models/activity-log.ts`; the query and risk-scoring engine lives in `src/lib/audit-trail.ts`.

## Step-by-step — Reading your audit log

1. **Open** _Settings → Security → Audit log_.
2. **Filter** by date range, user, action category, target id, or IP. (Pro+ exposes the full filter grid; Free shows the last 30 days of high-risk events.)
3. **Inspect** an entry to see the full metadata payload, the originating IP, and the user agent.
4. **Export** the current view to CSV or JSON for your records (Pro+).
5. **Pin** noteworthy events so they survive retention cleanup (Enterprise).

## Step-by-step — Configuring retention

1. **Open** _Settings → Security → Audit retention_.
2. **Choose** a retention window. Allowed values:
   - **Free / community self-host:** fixed at **90 days**.
   - **Pro:** 7 to 365 days.
   - **Enterprise:** 7 to 730 days, with optional **immutable / compliance mode** that prevents any deletion before TTL.
3. **Save.** Existing entries older than the new window are queued for deletion at the next nightly sweep.

## Programmatic access

- **REST:** `GET /api/v1/audit/entries` — paginated, filterable; same scopes as the dashboard.
- **Streaming:** `GET /api/v1/audit/stream` (Enterprise) — Server-Sent Events feed of new entries for SIEM ingestion.
- **Webhooks:** subscribe to `audit.entry.created` to forward events to Datadog, Splunk, or your own collector.

API key scope required: `audit.read`.

## Tips & limits

- The 90-day free retention covers the most common compliance windows. Anything longer requires Pro or Enterprise.
- Audit entries are **append-only**. Even an org owner cannot edit an existing entry; they can only shorten retention going forward.
- Failed sign-ins are logged with the **email attempted** but never with the password. IPs are stored verbatim; if you need them anonymized for GDPR, enable _Settings → Security → IP truncation_ (drops the last octet of IPv4 and the last 80 bits of IPv6).
- Bulk operations (e.g. deleting 5 000 assets at once) collapse into a single audit entry with a `count` field instead of 5 000 individual rows, so the log stays readable.
- The risk-scoring engine flags off-hours bulk deletes, repeated failed sign-ins, and unusual provider changes; flagged entries appear with a coloured badge in the UI.

## Related

- [Credential rotation](credential-rotation.md)
- [API keys](features/api-keys.md)
- [Self-hosting](self-hosting.md) — how to point audit storage at your own MongoDB.
