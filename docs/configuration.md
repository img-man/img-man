# Configuration

Every environment variable img-man reads, with source. This file mirrors
[`.env.example`](../.env.example) — if you add an env var to the code,
update `.env.example` **and** this document in the same PR.

Copy `.env.example` to `.env.local` (Next.js auto-loads it) or pass
variables via your orchestrator. Never commit real values.

## Core

| Variable | Required | Purpose | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | prod | Public base URL baked into client bundles | `NEXT_PUBLIC_*` is exposed to browsers — never put secrets in it |
| `MONGODB_URI` | **yes** | MongoDB connection string | Missing/blank → `/api/health/ready` returns 503 |
| `MONGODB_DB` | optional | Database name override | Default `img-man` |
| `NEXTAUTH_URL` | **yes** | Canonical URL NextAuth redirects to | Must match the browser-facing URL exactly (incl. scheme), or OAuth/cookies break |
| `NEXTAUTH_SECRET` | **yes** | Session/JWT signing | `openssl rand -base64 32`; rotating invalidates all sessions |
| `AUTH_TRUST_HOST` | compose/proxy | Trust `X-Forwarded-Host` behind proxies | Set `true` when deployed behind a reverse proxy |
| `PORT` | optional | Server port | Default `4000` in dev scripts; container uses `3000` |
| `HOSTNAME` | container | Bind address in Docker | Set by the image to `0.0.0.0` |
| `NODE_ENV` | runtime | `production` enables HSTS headers | Set by Docker image |

## First-boot administrator

| Variable | Required | Purpose |
| --- | --- | --- |
| `IMGMAN_BOOTSTRAP_EMAIL` | optional | Bootstrap admin email; empty = documented default |
| `IMGMAN_BOOTSTRAP_PASSWORD` | optional | Bootstrap admin password; empty = documented default |

The bootstrap account always forces a credential change before the
dashboard opens. Set both explicitly if the instance is reachable from
anywhere but localhost.

## Credential encryption

| Variable | Required | Purpose | Security |
| --- | --- | --- | --- |
| `GCP_CREDENTIALS_ENCRYPTION_KEY` | **yes in prod** | KEK (SHA-256 → AES-256-GCM) for per-org storage/AI credentials at rest | Falls back to `NEXTAUTH_SECRET` if unset — set it explicitly and keep it out of backups that travel with the DB. Rotation: `customer-docs/credential-rotation.md` |
| `ASSET_URL_SIGNING_SECRET` | compose/prod | Signs share/asset URLs (`/i/...`) | Rotate = all outstanding signed URLs die |

## OAuth providers (each optional; UI buttons appear only when configured)

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub sign-in |

## Object storage — default provider for the first org (BYOC)

Per-org credentials normally live encrypted in MongoDB (Settings →
Storage); these env vars are a first-boot convenience.

| Variable | Purpose |
| --- | --- |
| `GCP_PROJECT_ID` | GCP project owning the bucket |
| `GCP_STORAGE_BUCKET` / `GCS_BUCKET` | Bucket name (`GCS_BUCKET` is the legacy alias) |
| `GCP_SERVICE_ACCOUNT_JSON` | Inline service-account JSON (prefer file or vault) |
| `GCP_APP_CREDENTIALS_PATH` | Path to service-account JSON (local dev) |
| `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY`, `GCP_PRIVATE_KEY_ID` | Inline credential aliases; escape newlines as `\n` in `GCP_PRIVATE_KEY` |
| `AWS_REGION` | Region for S3 (default `us-east-1`) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | S3 credentials (use a least-privilege IAM user) |
| `S3_BUCKET` | S3 bucket name |

## AI (bring-your-own-key)

| Variable | Purpose |
| --- | --- |
| `DEFAULT_AI_PROVIDER` | `vertex` (default) \| `openai` \| `openrouter` \| `groq` |
| `GCP_VERTEX_LOCATION` | Vertex region, default `us-central1` |
| `GEMINI_IMAGE_MODEL` | Image model id, default `gemini-2.5-flash-image` |
| `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` | Gemini API keys |
| `OPENAI_API_KEY` | OpenAI |
| `OPENROUTER_API_KEY` | OpenRouter (placeholder — see docs referenced in `.env.example`) |
| `GROQ_API_KEY` | Groq (placeholder) |

AI features degrade cleanly when no key is present; nothing is sent to
third-party proxies.

## Optional integrations

| Variable | Purpose |
| --- | --- |
| `UNSPLASH_ACCESS_KEY` | Unsplash stock search |
| `PEXELS_API_KEY` | Pexels stock search |
| `GOOGLE_FONTS_API_KEY` | Font catalogue |
| `NEXT_PUBLIC_POLOTNO_KEY` | Polotno licence key (public — exposed in bundle) |

## Platform-admin surface (do not expose to tenants)

| Variable | Purpose | Security |
| --- | --- | --- |
| `ADMIN_JWT_SECRET` | Signs the private `/secure-account` platform-admin JWTs | Leave unset to keep the surface closed; rotate = all admin sessions die |

## Feature flags / runtime

| Variable | Purpose | Notes |
| --- | --- | --- |
| `ENABLE_ASSET_ANALYTICS` | Master switch for per-asset analytics capture | `"false"` default |
| `NEXTAUTH_DEBUG` | Verbose NextAuth logs | `"0"` default; `0` in production |
| `HEALTHCHECK_REQUIRE_STORAGE` | `/api/health/ready` also probes storage unless `"0"` | Docker Compose defaults it to `0` so a fresh stack is healthy without a bucket |
| `IMGMAN_FORCE_IPV4` | Pins outbound calls to IPv4 | Only for broken-IPv6 networks (`ECONNRESET` to storage/AI) |
| `NEXT_TELEMETRY_DISABLED` | Next.js telemetry off | Set `1` in the Docker image |

## Docker Compose extras

| Variable | Purpose |
| --- | --- |
| `IMAGEMAN_PORT` | Host port mapping (default `3000`) |

## Security checklist for production

- Set `NEXTAUTH_SECRET`, `ASSET_URL_SIGNING_SECRET`,
  `GCP_CREDENTIALS_ENCRYPTION_KEY` to fresh random values — never reuse
  compose placeholder defaults.
- Point `NEXTAUTH_URL` at the HTTPS URL; the app emits HSTS in production.
- Put the app behind TLS (reverse proxy or platform cert). MongoDB and the
  admin surface must not be publicly reachable.
- Rotate the bootstrap admin credentials at first login.
