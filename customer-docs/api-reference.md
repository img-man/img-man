# API Reference & Quickstart

> **Status:** PUBLISHED
> **Last updated:** 2026-05-04
> **Applies to:** API key holders

## What it does

This page gives you the fastest path to the img-man REST API: how to authenticate, where to find the interactive docs, and the first endpoints most integrations use.

## When to use it

- You are building a backend or automation against img-man.
- You need to create folders, shares, or assets outside the dashboard UI.
- You want a stable starting point before moving to MCP or the Embed SDK.

## Step-by-step

1. Create an API key in **Settings → API Keys**.
   Use the smallest scope your integration needs.
2. Pick your base URL.
   For self-hosted deployments, this is your own img-man host such as `https://media.example.com`.
3. Send the key as a bearer token:
   ```bash
   curl -H "Authorization: Bearer IM_KEY_..." \
     https://<your-imageman-host>/api/v1/folders
   ```
4. Start with the common endpoints:
   ```bash
   curl -H "Authorization: Bearer IM_KEY_..." \
     https://<your-imageman-host>/api/v1/assets

   curl -X POST \
     -H "Authorization: Bearer IM_KEY_..." \
     -H "Content-Type: application/json" \
     -d '{"name":"Campaign 2026"}' \
     https://<your-imageman-host>/api/v1/folders

   curl -X POST \
     -H "Authorization: Bearer IM_KEY_..." \
     -H "Content-Type: application/json" \
     -d '{"targetType":"folder","targetId":"fld_123","permission":"view"}' \
     https://<your-imageman-host>/api/v1/shares
   ```
5. Use the in-app interactive docs when you need the full request/response shape.
   Open **API Playground** in the dashboard or visit `/dashboard/docs/api` on your img-man instance.

## Common endpoint groups

| Area | Endpoints |
| --- | --- |
| Assets | `GET/POST /api/v1/assets`, `GET/PATCH/DELETE /api/v1/assets/:id` |
| Folders | `GET/POST /api/v1/folders`, `GET/PATCH/DELETE /api/v1/folders/:id` |
| Shares | `GET/POST /api/v1/shares`, `GET/PATCH/DELETE /api/v1/shares/:token` |
| Faces | `GET /api/v1/faces`, `GET/PATCH /api/v1/faces/:faceHash`, `POST /api/v1/faces/search` |
| Team | `GET /api/v1/team`, `POST /api/v1/team/invite`, `PATCH/DELETE /api/v1/team/:memberId` |
| AI | `POST /api/v1/ai/{operation}` for generate, remove-object, retouch, bg-remove, upscale, and expand |

## Common examples

### Search assets by text

Use `q` for full-text asset search, then combine it with pagination, folder scoping, MIME filters, or sorting when needed.

```bash
curl -H "Authorization: Bearer IM_KEY_..." \
   "https://<your-imageman-host>/api/v1/assets?q=sunset&limit=10&sort=createdAt&sortDir=desc"
```

Common query parameters for `GET /api/v1/assets`:

- `q` — full-text asset search.
- `folderId` — restrict results to one folder.
- `mimeType` — prefix match such as `image/` or `image/png`.
- `page` and `limit` — pagination controls.
- `sort` and `sortDir` — supported sort fields are `createdAt`, `name`, `sizeBytes`, and `updatedAt`.

### Get a transform URL for an asset

If you already have an asset ID and want a backend-issued transform URL, call the transform helper endpoint:

```bash
curl -H "Authorization: Bearer IM_KEY_..." \
   "https://<your-imageman-host>/api/v1/assets/6650f1a2b3c4d5e6f7890123/transform?transforms=w-400,h-400,q-80,f-webp"
```

This returns a JSON payload with the final transform URL.

If you only need a stable public URL, you can also use the public asset route directly:

```text
https://<your-imageman-host>/i/6650f1a2b3c4d5e6f7890123?w=400&format=webp&q=80&fit=inside
```

Use the public URL route for embeds and CMS content. Use the authenticated transform endpoint when your backend wants img-man to build the transform URL for you first.

## Tips & limits

- Keep API keys server-side when possible. For browser embeds, use the published [Embed SDK](features/embed.md) instead of calling write endpoints directly from arbitrary client code.
- On self-hosted deployments, storage-backed upload flows require the storage variables documented in [configuration.md](configuration.md).
- Check [api-rate-limits.md](api-rate-limits.md) before running batch jobs or background migrations.
- Use the dashboard playground first when you are exploring a new endpoint because it shows the current request shape for your running version.
- For public delivery URLs and query-parameter transforms, see [features/public-asset-url.md](features/public-asset-url.md).

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| `401 Unauthorized` | Missing or invalid bearer token. | Reissue or rotate the key in **Settings → API Keys** and resend the request with `Authorization: Bearer ...`. |
| `403 Forbidden` | The key exists but lacks the required scope. | Create a new key with the minimum read/write permissions your integration needs. |
| Upload request returns a storage error | Self-host runtime is missing default storage config or BYOC settings. | Review [configuration.md](configuration.md) and [byoc.md](byoc.md), then retry after storage is configured. |
| You need the exact payload shape for an endpoint | This page is a quickstart, not the full schema reference. | Use the in-app API docs at `/dashboard/docs/api` or the API Playground. |

## Related

- [API keys](features/api-keys.md)
- [API rate limits](api-rate-limits.md)
- [Embed SDK](features/embed.md)
- [Public asset URL](features/public-asset-url.md)
- [Sharing](features/sharing.md)