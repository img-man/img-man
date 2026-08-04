# Credential Rotation

> **Status:** PUBLISHED
> **Last updated:** 2026-04-30
> **Applies to:** All self-hosted deployments and Cloud tenants that supply their own keys.

## What it does

Describes how to rotate the **Key Encryption Key (KEK)** that protects all credentials at rest in img-man, and how to rotate the underlying provider credentials themselves (storage bucket keys, OpenAI keys, Vertex API keys).

## When to rotate

- **KEK rotation:** every 90 days, immediately if the value may have leaked, or whenever an operator with KEK access leaves the team.
- **Provider credentials:** every 90 days, immediately on suspicion of leak, when revoking access for a cloud-account principal, or when changing buckets/regions.

## How credentials are encrypted

- Algorithm: **AES-256-GCM**.
- KEK source: `GCP_CREDENTIALS_ENCRYPTION_KEY` env var (preferred). Falls back to `NEXTAUTH_SECRET` if the dedicated var is unset.
- KEK derivation: `SHA-256(env_value)` → 32-byte key.
- Envelope on disk: `<prefix><iv-base64>.<tag-base64>.<ciphertext-base64>` — IV is 12 random bytes, tag is the GCM auth tag.
- Prefixes (so we can detect the key class without decrypting):
  - `enc:gcp-service-account:v1:` — GCP service-account JSON.
  - `enc:aws-credentials:v1:` — AWS access key + secret pair.
  - `enc:vertex-api-key:v1:` — Vertex AI key.
  - `enc:openai-api-key:v1:` — OpenAI key.

A leaked ciphertext is not enough to recover the secret — the attacker also needs the KEK env var.

## Rotation procedure

### 1. Rotate the KEK (env-var rotation)

This is a **dual-write** flow. Until step 4 you must keep the old KEK reachable so existing rows can be decrypted.

1. **Generate the new KEK.**
   ```bash
   openssl rand -base64 32
   ```
2. **Stage the new KEK as a fallback.** Set the new value in `GCP_CREDENTIALS_ENCRYPTION_KEY_NEXT` (operator convention; the runtime currently reads only `GCP_CREDENTIALS_ENCRYPTION_KEY`, so this step is a checkpoint for your secret manager).
3. **Re-encrypt every stored credential.** Run the rotation script (you may need to write it once for your deployment shape):
   ```bash
   # Pseudo-code; the script lives outside the repo today and reads/writes
   # the same envelopes the runtime uses (see src/lib/secret-crypto.ts).
   node scripts/rotate-kek.mjs --old "$OLD_KEK" --new "$NEW_KEK"
   ```
   The script must:
   - Iterate `Organization.storageConfig.gcpServiceAccount`, `.awsCredentials`, `.vertexApiKey`, and `aiProviderConfig.openAiApiKey`.
   - Decrypt with the old KEK, re-encrypt with the new KEK using the same prefix.
   - Write back atomically per organization.
4. **Promote the new KEK.** Replace `GCP_CREDENTIALS_ENCRYPTION_KEY` with the new value in your secret store and roll the application pods.
5. **Confirm.** Open one organization's Settings page; the storage and AI provider rows should still report "Connected".
6. **Revoke the old KEK.** Remove it from secret history and your password manager.

If you skip step 3 the next read will throw `Unable to decrypt stored credentials` for every org — recovery requires restoring the old KEK.

### 2. Rotate provider credentials (no KEK change)

GCP service-account JSON, AWS access keys, OpenAI keys, and Vertex API keys can be rotated independently of the KEK.

1. In the upstream provider console, generate a new credential.
2. In the img-man dashboard, open **Settings → Storage** (for GCP/AWS) or **Settings → AI Provider** (for OpenAI/Vertex).
3. Paste the new credential and click **Validate & Save**. img-man re-runs the connectivity check and writes a fresh AES-256-GCM envelope.
4. In the upstream provider console, **revoke the old credential**. Wait at least one signed-URL TTL (default 10 minutes, max 60) before deleting old keys to avoid breaking in-flight downloads.

## Tips & limits

- The fallback to `NEXTAUTH_SECRET` is for local development only. Production deployments **must** set `GCP_CREDENTIALS_ENCRYPTION_KEY` explicitly so the auth secret and the KEK can be rotated on independent schedules.
- Re-encryption is **per-organization** and idempotent — you can re-run the rotation script if a single org fails mid-rotation.
- Rotation is logged in the audit log (`provider.credential.rotated`, `kek.rotated`) — see `docs/AUDIT_LOG.md` once available.
- The eval Docker image generates an ephemeral KEK on first boot. Restarting that container will invalidate every stored credential. For anything beyond evaluation, persist the KEK.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| All orgs report "Unable to decrypt stored credentials" after a deploy. | KEK env var was changed without re-encrypting. | Restore the previous KEK env var, run the rotation script, then re-deploy with the new KEK. |
| Some orgs decrypt, others fail. | A partial rotation run was interrupted. | Re-run the rotation script — it skips already-re-encrypted envelopes (different IV prefix in the ciphertext header would expose this; today the safe path is "decrypt with new KEK first, fall back to old"). |
| Signed URLs 403 immediately after rotating provider credentials. | The old key was revoked before its TTL expired. | Wait the TTL out, regenerate URLs, or temporarily restore the old key. |

## Related

- [byoc.md](byoc.md) — Connecting buckets the first time.
- [configuration.md](configuration.md) — Env var reference, including `GCP_CREDENTIALS_ENCRYPTION_KEY`.
- [backup-restore.md](backup-restore.md) — Recovery order after a failed rotation.
