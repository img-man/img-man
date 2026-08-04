# Configuration

> **Status:** PUBLISHED
> **Last updated:** 2026-05-04
> **Applies to:** Community Self-Deploy

## What it does

Lists the main environment variables used by the current self-host setup so you can move from the default compose evaluation stack to local MongoDB or MongoDB Atlas without guessing at required keys. It also calls out the extra storage settings needed before storage-backed asset upload/download flows will work.

## When to use it

- You want to generate a reusable local env file.
- You want to point img-man at an existing MongoDB deployment.
- You want to configure social sign-in, custom ports, or a default storage bucket.

## Step-by-step

1. **Generate a starting file** — run `node --experimental-strip-types scripts/self-host-bootstrap.ts --file .env.self-host`.
2. **Edit the values you need** — keep the generated secrets, then replace database or auth settings for your environment.
3. **Pass the file to Compose** — run `docker compose --env-file .env.self-host up --build`.
4. **Restart after changes** — stop and start the stack again whenever you change env values.

## Common variables

| Variable | Required | Default for local eval | What it controls |
| --- | --- | --- | --- |
| `PORT` | Yes | `3000` | Internal app port inside the container. |
| `IMAGEMAN_PORT` | No | `3000` | Host port published by Docker Compose. |
| `NEXTAUTH_URL` | Yes | `http://localhost:3000` | Public base URL used by NextAuth and generated links. |
| `NEXTAUTH_SECRET` | Yes | Generated or compose default | Session signing and auth security. |
| `ASSET_URL_SIGNING_SECRET` | Recommended | Generated or compose default | Signed asset and fallback delivery URLs. |
| `AUTH_TRUST_HOST` | Yes | `true` | Allows host trust in self-host setups behind Docker/reverse proxies. |
| `MONGODB_URI` | Yes | `mongodb://localhost:27017/imageman` or compose default `mongodb://mongo:27017/imageman` | MongoDB connection string. |
| `MONGODB_DB` | No | `imageman` | Logical database name. |
| `GCP_PROJECT_ID` | Required for default GCP storage | unset | Default Google Cloud project used when an org is not configured for BYOC. |
| `GCP_STORAGE_BUCKET` | Required for default GCP storage | unset | Default bucket used for signed upload/download URLs outside BYOC. |
| `GCP_APP_CREDENTIALS_PATH` | Required for default GCP storage unless `GOOGLE_APPLICATION_CREDENTIALS` is already set | unset | Path to the service-account JSON used for default GCP storage access. |
| `HEALTHCHECK_REQUIRE_STORAGE` | No | `1` | When `1`, `/api/health/ready` requires both DB and storage checks to pass. Set to `0` to require DB only. |
| `GOOGLE_CLIENT_ID` | No | unset | Enables Google sign-in when paired with the secret. |
| `GOOGLE_CLIENT_SECRET` | No | unset | Enables Google sign-in when paired with the client ID. |
| `GITHUB_CLIENT_ID` | No | unset | Enables GitHub sign-in when paired with the secret. |
| `GITHUB_CLIENT_SECRET` | No | unset | Enables GitHub sign-in when paired with the client ID. |

## Tips & limits

- Keep generated secrets stable across restarts if you want persistent sessions.
- If you publish img-man on a non-default port, update both `IMAGEMAN_PORT` and `NEXTAUTH_URL`.
- The bootstrap script generates local-safe defaults, not production secrets management.
- Storage-backed asset uploads, signed downloads, and public share asset URLs need either the default GCP variables above or a BYOC bucket configured in the dashboard.
- Provider-specific storage and AI configuration is separate from the base self-host boot path.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Sign-in loops back to `/signin` | `NEXTAUTH_URL` or `NEXTAUTH_SECRET` changed unexpectedly. | Set stable values and restart the stack. |
| Readiness fails after swapping Mongo | The new `MONGODB_URI` is unreachable or incorrect. | Test the connection string separately, then restart Compose. |
| `/api/health/ready` returns `503` with a bucket/storage prompt | Storage credentials or bucket config is invalid (for example `invalid_grant: account not found`) while storage readiness is required. | Reconnect bucket credentials in Settings -> Storage or fix `GCP_PROJECT_ID`, `GCP_STORAGE_BUCKET`, and service-account credentials, then restart. |
| OAuth buttons do not show up | Provider variables are missing or incomplete. | Set both client ID and secret for the provider and restart. |

## Related

- [self-hosting.md](self-hosting.md)
- [faq.md](faq.md#self-hosting)
- [getting-started.md](getting-started.md)