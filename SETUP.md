<!-- SPDX-License-Identifier: Apache-2.0 -->
# Setting up img-man

Everything you need to get a working img-man instance, from `git clone` to a
running embed inside your own application.

If you just want to know what img-man *is*, read the [README](README.md) first.

**Contents**

1. [Requirements](#1-requirements)
2. [Install and run](#2-install-and-run)
3. [Configure the environment](#3-configure-the-environment)
4. [First login](#4-first-login)
5. [Connect storage](#5-connect-storage)
6. [Connect an AI provider (optional)](#6-connect-an-ai-provider-optional)
7. [Connect your application](#7-connect-your-application)
8. [Deploying with Docker](#8-deploying-with-docker)
9. [Upgrading](#9-upgrading)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Requirements

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 22 or newer | `node --version` |
| MongoDB | 6.0 or newer | Local, Docker, or Atlas |
| Google Cloud Storage bucket | — | The only storage backend currently wired end-to-end |
| An AI provider key | — | Optional. Without one, AI features stay disabled; everything else works |

img-man is a single Next.js application. There is no separate worker, queue, or
cache to run.

### A note on the database

**Point img-man at an empty database.** It creates its own collections and
bootstraps an administrator on first sign-in. There is no import step and no
migration to run against an existing MongoDB — pointing it at a database that
already holds other application data is not supported.

---

## 2. Install and run

```bash
git clone https://github.com/img-man/img-man.git
```

```bash
cd img-man && npm install
```

```bash
cp .env.example .env
```

Fill in `.env` (see the next section), then:

```bash
npm run dev
```

img-man starts on **http://localhost:4000**.

For a production build:

```bash
npm run build && npm start
```

---

## 3. Configure the environment

Only four values matter to get started. Everything else in `.env.example` is
optional or has a working default.

### Required

```bash
# Where this instance is reachable
NEXTAUTH_URL="http://localhost:4000"
NEXT_PUBLIC_APP_URL="http://localhost:4000"

# Session signing secret — generate a fresh one, never reuse the example
NEXTAUTH_SECRET="…"

# An empty MongoDB database
MONGODB_URI="mongodb://localhost:27017/imgman"
MONGODB_DB="imgman"
```

Generate the secret with:

```bash
openssl rand -base64 32
```

### Storage (required before you can upload)

```bash
GCP_PROJECT_ID="your-project"
GCP_STORAGE_BUCKET="your-bucket"
GCP_SERVICE_ACCOUNT_JSON=""   # inline JSON, or use the path variable below
GCP_APP_CREDENTIALS_PATH=""   # path to a service-account .json file (local dev)
```

You can also connect a bucket from the UI after logging in — see
[Connect storage](#5-connect-storage). The environment variables are a
convenience for the first workspace.

### AI provider (optional)

```bash
DEFAULT_AI_PROVIDER="vertex"   # vertex | openai
GEMINI_API_KEY=""              # for Vertex / Gemini
OPENAI_API_KEY=""              # for OpenAI
```

Leave these blank and img-man runs fine — the AI Studio, auto-tagging, and
generative design tools simply stay switched off.

### First-boot administrator (recommended)

```bash
IMGMAN_BOOTSTRAP_EMAIL="you@yourcompany.com"
IMGMAN_BOOTSTRAP_PASSWORD="a-long-random-password"
```

Leave these blank and img-man falls back to the documented defaults below. In
both cases the account is locked into a forced credential change, but if your
instance is reachable from anywhere other than localhost you should set them
explicitly.

### Credential encryption

```bash
GCP_CREDENTIALS_ENCRYPTION_KEY=""
```

Per-workspace storage and AI credentials are encrypted at rest with AES-256-GCM
using a key derived from this value. It falls back to `NEXTAUTH_SECRET` when
unset, which is fine locally — **set it explicitly in production**, because
rotating your session secret would otherwise make stored credentials
undecryptable. See [credential rotation](customer-docs/credential-rotation.md).

---

## 4. First login

Open **http://localhost:4000** and sign in.

If you did not set `IMGMAN_BOOTSTRAP_*`, the default administrator is:

```text
Email:    admin@img-man.com
Password: Admin@12345
```

These credentials are published in this repository, so img-man treats the
account as compromised from the start: **you land on a forced
"Secure this deployment" screen and the dashboard will not open until you
replace the email and password.** Password rules are 12+ characters with upper,
lower, and a digit.

Changing the email signs you out — sign back in with the new address.

Once through, you land in an empty workspace. Nothing else is seeded.

---

## 5. Connect storage

**Settings → Storage.**

Two options:

- **Auto-provision** — img-man creates a dedicated GCS bucket for the workspace
  using the service-account credentials from your environment.
- **Bring your own bucket** — supply a bucket name and a service-account JSON.
  The credentials are validated, then encrypted and stored per workspace.

Uploads fail until one of these is configured.

---

## 6. Connect an AI provider (optional)

**Settings → AI.**

Paste a Vertex/Gemini or OpenAI key. Keys are stored encrypted per workspace and
never leave your deployment. img-man does not proxy AI calls through any hosted
service and does not meter usage — you are billed directly by your provider.

Per-feature control lives on the same screen: each AI capability can be set to
`enabled`, `disabled`, or `auto` (run automatically on upload), with a minimum
role.

---

## 7. Connect your application

This is the part most integrations care about: showing img-man **inside** your
own product, signed in as the user who is already signed in to your product.

The dashboard has a page that generates all of this pre-filled with your real
org values: **Settings → Client Setup**.

### How it works

1. Your server holds an img-man API key (`img_…`). It never reaches the browser.
2. When a user opens the embed, your server exchanges that key plus the user's
   email for a short-lived access token (`imgt_…`).
3. Your frontend puts that token in an iframe URL.
4. img-man opens as that user.

Users never see an img-man login screen and never create an img-man password.

### Step 1 — Create an API key

**Settings → API Keys → Create key.** Copy it once; it is hashed at rest and
cannot be shown again.

### Step 2 — Set your server environment

```bash
IMAGEMAN_BASE_URL="https://img-man.yourcompany.com"
IMAGEMAN_API_KEY="img_…"
```

### Step 3 — Add a token endpoint to your backend

Put it behind your own authentication so only your logged-in users can call it.

```js
app.post('/api/imageman/token', requireAuth, async (req, res) => {
  const r = await fetch(`${process.env.IMAGEMAN_BASE_URL}/api/v1/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.IMAGEMAN_API_KEY}`,
    },
    body: JSON.stringify({
      email: req.user.email,   // the identity img-man will run as
      name: req.user.name,
      expiresIn: '24h',        // 1h | 24h | 7d | 30d
    }),
  });

  const data = await r.json();
  if (!r.ok) return res.status(r.status).json({ success: false, error: data.error });

  return res.json({
    success: true,
    accessToken: data.accessToken,
    expiresAt: data.expiresAt,
    embedUrl: process.env.IMAGEMAN_BASE_URL,
  });
});
```

An email that img-man has never seen is provisioned automatically on its first
token, using the default role you pick under **Settings → Client Setup**. You do
not need a separate invite call.

### Step 4 — Embed the iframe

```jsx
const res = await fetch('/api/imageman/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: user.email, name: user.name }),
});
const { accessToken, embedUrl } = await res.json();

<iframe
  src={`${embedUrl}/embed/dashboard?token=${encodeURIComponent(accessToken)}`}
  style={{ width: '100%', height: '100vh', border: 0 }}
  allow="clipboard-write"
/>
```

That is the entire client-side integration.

### Embed URL options

| Parameter | Values | Purpose |
| --- | --- | --- |
| `token` | `imgt_…` | **Required.** The access token you just minted |
| `folder` | folder id | Scope the whole embed to one folder subtree |
| `theme` | `light` \| `dark` | Match your host application |
| `brand` | any string | Replace the img-man wordmark in the embed chrome |

### Restricting who can auto-join

**Settings → Client Setup** also holds an optional email-domain allowlist. With
`@yourcompany.com` in the list, a token request for an unrecognised outside
address is rejected instead of silently creating a user.

### Common mistakes

- Use `/embed/dashboard?token=…`, not `/?token=…` — the latter lands on the
  sign-in page.
- Never send `IMAGEMAN_API_KEY` to the browser. All key-bearing calls go through
  your own server.
- Brand-new users need an email. Phone-only identification works only for users
  that already exist.

---

## 8. Deploying with Docker

```bash
docker compose up -d
```

`docker-compose.yml` brings up img-man and a MongoDB instance. Supply the same
environment variables described above through your usual secret mechanism —
do not bake them into the image.

Health probes:

```text
GET /api/health/live     — process is up
GET /api/health/ready    — database reachable and configuration valid
```

Point your orchestrator's liveness probe at the first and its readiness probe at
the second.

---

## 9. Upgrading

```bash
git pull && npm install && npm run build
```

Schema changes are applied lazily on model load; there is no migration command
to run. Check the release notes before upgrading across a major version.

---

## 10. Troubleshooting

**`/api/health/ready` returns 503**
`MONGODB_URI` is missing, wrong, or the database is unreachable. The response
body names the failing check.

**Sign-in accepts nothing, even the documented default**
The bootstrap admin is only created when someone attempts to sign in with the
bootstrap email. Confirm `IMGMAN_BOOTSTRAP_EMAIL` matches what you are typing,
and check the server log for `[Auth]` lines.

**Stuck on "Secure this deployment"**
That is deliberate — the dashboard stays locked until the default credentials
are replaced. If the form rejects your current password, you are signed in as a
different user than you think; sign out and back in.

**Uploads fail with a storage error**
No bucket is connected. Go to **Settings → Storage**.

**The embed iframe shows "Authentication Failed"**
The token expired, was minted with a revoked API key, or was truncated in the
URL. Mint a fresh one and confirm you passed it through `encodeURIComponent`.

**The embed loads a sign-in page instead of the dashboard**
You used `/?token=…`. The correct path is `/embed/dashboard?token=…`.

**Session errors after changing `NEXTAUTH_SECRET`**
Expected. Existing session cookies can no longer be decrypted; users sign in
again. If you also relied on the secret for credential encryption, see
[credential rotation](customer-docs/credential-rotation.md) before rotating.
