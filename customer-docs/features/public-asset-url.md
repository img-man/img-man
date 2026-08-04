# Public Asset URLs and On-the-Fly Transforms

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans

## What it does

Every asset has a stable, ImageMan-domain URL of the form `https://<your-imageman-host>/i/<asset-id>`. You can append query parameters to resize or convert the image without re-uploading.

## When to use it

- You want to embed an asset in a marketing site, email, or app and not expose your bucket.
- You need different sizes (thumbnail, hero, retina) of the same image.
- You want to convert from JPEG to WebP/AVIF for smaller payloads.

## Step-by-step

1. Open any asset in the dashboard.
2. In the asset drawer, click **Asset URL** (or the copy icon in the action bar). The clipboard now has your stable URL.
3. Paste it into your `<img src="...">` or your CMS.
4. To resize, append `?w=400`. To set a height too: `?w=400&h=300`. To change format: `?format=webp`.

## Supported transforms

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `w` | integer (1–4096) | — | Target width in px. |
| `h` | integer (1–4096) | — | Target height in px. |
| `format` | `jpeg` \| `png` \| `webp` \| `avif` | original | Output format. |
| `q` | integer (1–100) | 85 | Encoder quality. |
| `fit` | `cover` \| `contain` \| `fill` \| `inside` \| `outside` | `inside` | Resize strategy. |

## How it works

- **No transform?** The URL 302-redirects to a freshly signed storage URL. Your bytes are served directly by the CDN — fast and cheap.
- **With a transform?** img-man resizes on demand, caches the result for an hour at the edge, and streams it back.
- The signed storage URL behind the redirect rotates frequently. Your `/i/<id>` URL stays stable.

## Tips & limits

- The asset ID in the URL is the bearer credential — anyone with the link can fetch the asset. For private content, use a [share link](sharing.md) instead.
- Maximum dimension per axis is **4096 px**.
- Only image formats can be transformed; non-image assets (PDFs, etc.) redirect to the original.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| 404 from `/i/<id>` | Asset was deleted or wrong ID. | Re-copy the URL from the drawer. |
| Wrong domain in copied URL | `NEXT_PUBLIC_APP_URL` not set on the server. | Set `NEXT_PUBLIC_APP_URL` in your environment. |
| Transformed image is bigger than expected | `withoutEnlargement` is on; we never upscale. | Provide a smaller source or accept the upper bound. |

## Related

- [Sharing](sharing.md) — for private/expiring links.
- Transform rules — saved presets and signed-transform support are still on the roadmap.
