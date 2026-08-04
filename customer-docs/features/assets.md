# Assets

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans

## What it does

The Assets page is your media library. Every file you upload — image, PDF, document, video — is stored as an asset with metadata, AI tags, and a stable public URL.

## When to use it

- Uploading media for a campaign, product page, or design.
- Searching and tagging existing media.
- Sharing or copying URLs for a marketing email or website.

## Step-by-step

### Upload

1. Drag a file (or many) onto the Assets grid.
2. Or click **Upload** and pick from your device.
3. Or paste an image from clipboard (`Ctrl+V`).
4. Or click **Import from URL** and paste a remote image link.

Uploads go directly from your browser to the storage bucket via a signed URL — your file does not pass through our app server.

### Organize

- Drag assets into folders.
- Multi-select with `Shift` + click; right-click for batch actions.
- Use the search bar for tag/text/semantic queries.

### Open an asset

Click any tile. The drawer shows:
- The signed preview.
- Standard metadata (size, dimensions, format, EXIF).
- AI metadata (tags, dominant colors).
- **Asset ID** and **Asset URL** with one-click copy.
- Actions: download, share, edit in Design Studio, AI edit, move, delete.

### Share

Click **Share**. Choose expiry, password, and permission. See [Sharing](sharing.md).

### Get a stable public URL

Click **Asset URL** in the drawer. The URL is on the img-man domain and supports on-the-fly transforms — see [Public asset URLs](public-asset-url.md).

## Tips & limits

- Default upload size limit is **2 GB** per file.
- Supported types: all common image formats (JPEG, PNG, WebP, AVIF, GIF, HEIC, SVG), PDF, DOCX, XLSX, CSV, MP4.
- Auto-tagging runs in the background; tags appear within seconds for images.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Upload stuck at 99% | Network glitch on the final commit. | Retry. The browser resumes from a fresh signed URL. |
| AI tags missing | AI provider not configured or quota exceeded. | Check Settings → AI Providers. |
| Asset URL returns 404 | Asset is in Trash. | Restore from Trash or re-upload. |

## Related

- [Sharing](sharing.md)
- [Public asset URLs](public-asset-url.md)
- [Smart Albums](smart-albums.md)
- [AI Studio](ai-studio.md)
