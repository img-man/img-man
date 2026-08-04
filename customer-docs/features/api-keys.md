# API Keys

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans

## What it does

API keys let your code authenticate to the img-man REST API and the Embed SDK. Each key is scoped to your organization and to a permission level.

## When to use it

- You're building a backend integration.
- You're adding the Embed SDK to a frontend.
- You want to rotate credentials after a teammate leaves.

## Step-by-step

1. Go to **Settings → API Keys**.
2. Click **Create key**.
3. Pick a **scope**: `read`, `write`, or `admin`.
4. (Optional) Restrict by **allowed domains** for embed use.
5. Copy the key immediately — it is shown only once.
6. Use it as a header: `Authorization: Bearer IM_KEY_...`.

## Scopes

| Scope | What it allows |
| --- | --- |
| `read` | List/read assets, folders, tags. |
| `write` | All of `read` + upload, edit, delete. |
| `admin` | All of `write` + manage team, keys, billing. |

## Tips & limits

- Always store keys in a secrets manager. Never commit them to Git.
- Rotate every 90 days for production use.
- Use **separate keys** per integration so revocation is surgical.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| `401 Unauthorized` | Wrong key or revoked. | Create a new key. |
| `403 Forbidden` | Scope too low. | Issue a key with the right scope. |
| `CORS error` from browser | Origin not whitelisted on the key. | Add the origin under the key's allowed domains. |

## Related

- [Embed SDK](embed.md)
- API Playground — available in-app at `/dashboard/api-playground`.
