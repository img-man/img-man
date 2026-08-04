# Named Transform Rules

> **Status:** PUBLISHED
> **Last updated:** 2026-05-05
> **Applies to:** All plans

## What it does

Lets you save frequently used transform strings as named presets so you can reference them by name in URLs and the API instead of repeating the full parameter string every time.

## When to use it

- Enforcing consistent image sizes across a product catalogue (e.g. always deliver hero images at 1200 × 630, WebP, quality 85).
- Simplifying CMS integrations — editors pick a preset name rather than remembering transform syntax.
- A/B testing delivery quality by swapping a preset definition in one place instead of updating every embed URL.

## Step-by-step

### Create a named transform

1. Open **Settings → Transforms** in the sidebar.
2. Click **New transform rule**.
3. Give it a descriptive name (e.g. `hero-banner` or `thumbnail-square`).
4. Enter the transform string, e.g. `w-1200,h-630,q-85,f-webp,fit-cover`.
5. Optionally add a description for your team.
6. Click **Save**.

The rule is immediately available at `/i/<asset-id>?t=hero-banner`.

### Edit a rule

1. Click the **pencil** icon on the rule row.
2. Update the name, string, or description.
3. Save. Existing URLs using this preset name pick up the new definition instantly.

### Delete a rule

1. Click the **trash** icon.
2. Confirm. URLs that used this preset name will fall back to the default (original dimensions, original format) after deletion.

### Use a preset in a URL

```
https://your-org.imageman.app/i/<asset-id>?t=hero-banner
```

You can also stack a preset with additional overrides:

```
https://your-org.imageman.app/i/<asset-id>?t=hero-banner&q=70
```

The inline parameter takes precedence over the preset value for that key.

### Use a preset via the API

```http
GET /api/v1/assets/<id>/transform?transforms=t-hero-banner
```

## Available transform parameters

| Parameter | Description | Example |
|---|---|---|
| `w` | Width in px | `w-400` |
| `h` | Height in px | `h-300` |
| `q` | JPEG/WebP quality 1–100 | `q-85` |
| `f` | Output format | `f-webp`, `f-jpeg`, `f-png`, `f-avif` |
| `fit` | Resize mode | `fit-cover`, `fit-contain`, `fit-inside` |
| `ar` | Aspect ratio (width:height) | `ar-16:9` |
| `blur` | Gaussian blur radius | `blur-10` |
| `grayscale` | Convert to greyscale | `grayscale-true` |
| `rotate` | Rotation in degrees | `rotate-90` |

See [Public asset URLs and transforms](public-asset-url.md) for the full transform reference.

## Tips & limits

- Rule names must be URL-safe (letters, digits, hyphens, underscores). Spaces are not allowed.
- Preset names are case-sensitive in URLs.
- Up to 25 presets per organization on Free, unlimited on Pro.
- Deleting a widely used preset will break image delivery for every URL that referenced it. Prefer renaming or editing instead of deleting.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| Preset not applied | Typo in the preset name in the URL. | Check the name in **Settings → Transforms** and compare exactly. |
| Preset URL returns original dimensions | Preset was deleted. | Re-create it or update the URL to use inline parameters. |
| Cannot create more presets | Free plan limit (25) reached. | Delete unused presets or upgrade to Pro. |

## Related

- [Public asset URLs and transforms](public-asset-url.md) — full transform parameter reference.
- [API reference](../api-reference.md) — programmatic transform endpoint.
