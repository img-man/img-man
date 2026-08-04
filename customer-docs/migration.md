# Migration

> **Status:** DRAFT — feature in active development for `v0.12.0` (May 14–20).
> **Last updated:** 2026-04-30
> **Applies to:** All plans (self-hosted) and Cloud Pro/Enterprise.

## What it does

Imports an existing bucket (your own GCP / S3, or a third-party DAM such as Brandfolder/Canto) into img-man **without copying bytes** by default. img-man indexes objects in place: it records each object as an `Asset`, generates thumbnails on demand, and serves them via signed URLs straight from your bucket.

> **Note:** the migration UI and resumable indexer ship in **v0.12.0**. The capability matrix and the dry-run scanner contracts described here are the published contract that the implementation will conform to.

## When to use it

- You're moving from another DAM or from raw cloud storage into img-man.
- You already have thousands of objects in a bucket and want them browsable inside img-man.
- You want a non-destructive, resumable import that you can pause/cancel without losing progress.

## Capability matrix

| Source | Read | Index | Cost estimate before scan | Mutation (write/delete) |
|--------|------|-------|---------------------------|-------------------------|
| GCP bucket (yours) | ✅ | ✅ | ✅ | Opt-in per folder |
| AWS S3 bucket (yours) | ✅ | ✅ | ✅ | Opt-in per folder |
| Brandfolder | 🟡 Researching | 🟡 | 🟡 | ❌ |
| Canto | 🟡 Researching | 🟡 | 🟡 | ❌ |

Migrations are **read-only by default**. Mutations (renames, deletes, structural changes) require explicit per-folder opt-in inside the migration UI.

## Step-by-step

### 1. Connect the source

1. Open **Settings → Migrations → Connect Source**.
2. Pick the source provider and paste credentials (read-only is sufficient).
3. img-man validates with a single `List` call and stores credentials encrypted (same envelope as BYOC).

### 2. Dry-run scan + cost estimate

1. Choose a path/prefix to scan.
2. Click **Estimate**. img-man calls `List` with a small page size and projects:
   - Estimated total object count.
   - Estimated `List` + `Get` cost (in source-provider currency, using the per-1K request prices).
   - Estimated time to index at the configured concurrency.
3. **Any scan that would burst more than 1,000 `List`/`Get` calls is blocked until you confirm the cost estimate** in the UI. This protects you from runaway egress bills.

### 3. Start the migration

1. Click **Start Migration**. A `MigrationJob` document is created with `{ provider, prefix, cursor, status: 'running', counts, errors }`.
2. The resumable batch indexer walks the source in pages, upserts `Asset` rows by `(provider, key, hash)`, and reconstructs folder structure from object prefixes.
3. The UI streams progress: indexed / total / failed, ETA, current cursor.

### 4. Verify

When the job completes, click **Verification Report**:

- Bucket object count vs. img-man asset count.
- A sample of randomly selected assets with signed URLs you can click.
- A list of objects that failed indexing, with the underlying error.

### 5. Pause / resume / cancel

- **Pause** stops new pages from being scheduled; in-flight pages finish.
- **Resume** picks up from the saved cursor.
- **Cancel** stops the job and marks it `cancelled`. Already-indexed assets stay in img-man.

## Tips & limits

- Migrations are **non-destructive**: nothing in the source bucket is modified unless you explicitly opt in to mutations on a folder.
- Concurrency is capped per source provider to stay inside polite request rates.
- Re-running a migration on the same prefix is safe — upserts are keyed by `(provider, key, hash)`.
- Importing 1K objects on a healthy connection takes seconds; 10K objects takes a few minutes; tested up to 10K in v0.12.0 dry runs.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| "Cost estimate exceeds threshold" with no continue button. | The scan would burst more than 1K List/Get calls without confirmation. | Acknowledge the estimate in the UI to continue. |
| Job is stuck in `running` with no progress. | The source returned a transient 5xx and the indexer is back-pressuring. | Wait, then resume. The cursor is checkpointed every page. |
| Some objects failed with `mime/magic mismatch`. | Upload validation rejected an executable type. | Inspect the failed list; remove the offending objects from the source. |

## Related

- [storage-providers.md](storage-providers.md) — Provider reference.
- [byoc.md](byoc.md) — How buckets are connected in the first place.
- [credential-rotation.md](credential-rotation.md) — Rotating the source credentials.
