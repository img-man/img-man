# img-man Documentation

> **Audience:** People using the img-man dashboard, the REST API, and the embed.
> **Tone:** Plain English. Short sentences. Examples over theory.

Installing img-man for the first time? Start with **SETUP.md** in the
repository root — it covers install, environment, first login, and connecting a
client application.

---

## Quick links

- **Getting started** → [getting-started.md](getting-started.md)
- **Install & configure** → `SETUP.md` in the repository root
- **Embed in your own app** → [features/embed.md](features/embed.md)
- **API reference** → [api-reference.md](api-reference.md)
- **FAQ** → [faq.md](faq.md)

---

## By feature

These map 1:1 to dashboard sections.

### Library
- [Assets](features/assets.md) — Upload, browse, organise, search.
- [Trash & Vault](features/vault.md) — Recover or permanently delete assets during the retention window.
- [Duplicates](features/duplicates.md) — Find near-identical files and reclaim storage.

### Discovery
- [Smart Albums](features/smart-albums.md) — Auto-populated collections by rule.
- [People Albums](features/people.md) — Browse and name face-clustered albums.
- [Map](features/map.md) — Browse photos by GPS coordinates.
- [Analytics](features/analytics.md) — Bandwidth, access patterns, per-asset usage.

### Create
- [Designs](features/designs.md) — Canvas editor for social posts, banners, thumbnails.
- [AI Studio](features/ai-studio.md) — Generate, edit, upscale, expand, background-remove.
- [Tools](features/tools.md) — PDF and image utilities (merge, split, compress, OCR).

### Share & distribute
- [Sharing](features/sharing.md) — Public links, expiry, passwords.
- [Public asset URLs](features/public-asset-url.md) — `/i/<id>` with on-the-fly resize.
- [Named Transform Rules](features/transforms.md) — Reusable presets referenced by name.
- [Embed](features/embed.md) — Run the dashboard inside your own product.

### Administration
- [Team & Roles](features/team.md) — Members, groups, roles, section and folder access.
- [API Keys](features/api-keys.md) — Create, scope, revoke.
- [Usage](features/usage.md) — Storage, bandwidth, and AI job totals. No plans, no quotas.
- [Audit Log](audit-log.md) — Who did what, retention, exports.

---

## Deployment

- [Self-Hosting](self-hosting.md) — Production deployment, health checks, shutdown.
- [Configuration](configuration.md) — Every environment variable and when it matters.
- [Backup & Restore](backup-restore.md) — Snapshot, restore, and verify an instance.

## Bring your own cloud and keys

- [BYOC storage](byoc.md) — Connect your own bucket.
- [Storage providers](storage-providers.md) — Provider reference matrix.
- [AI providers](ai-providers.md) — Provider/capability matrix and BYOK setup.
- [Credential rotation](credential-rotation.md) — Rotate the KEK and stored credentials.
- [Migration](migration.md) — Import an existing bucket or DAM.

## Developer surface

- [API reference & quickstart](api-reference.md) — Auth, base URL, first endpoints.
- [API Playground](api-playground.md) — Send live requests from the browser.
- [API rate limits](api-rate-limits.md) — Per-org caps, headers, burst handling.
- [MCP](mcp.md) — Drive img-man from Claude Desktop, Cursor, Continue, Zed.
- [Agent](agent.md) — In-app agent, tool registry, RBAC enforcement.
- [Agent eval harness](agent-eval.md) — Pass-rate gate for the agent surface.
- [Contribute](contribute.md) — Local setup, validation, PR expectations.

## Privacy

- [Telemetry](telemetry.md) — img-man collects none. What leaves your server, and how to verify.
- [Privacy](privacy.md) — Data handling, deletion, encryption at rest, GDPR posture.

---

## Writing style

Every feature page follows [DOC_TEMPLATE.md](DOC_TEMPLATE.md):

1. **What it does** — one sentence.
2. **When to use it** — typical situations.
3. **Step-by-step** — numbered, screenshot-friendly.
4. **Tips & limits** — formats, max sizes, gotchas.
5. **Troubleshooting** — common errors with fixes.
6. **Related** — links to adjacent features.

Keep paragraphs short. Bold the noun in each step ("Click **Upload**.").

New pages must be added to this index **and** to `CUSTOMER_DOC_PAGES` in
`src/lib/customer-docs.ts` in the same change —
that registry is what renders `/docs` in the app.
