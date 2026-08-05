# Getting Started with img-man

> **Status:** DRAFT
> **Last updated:** 2026-04-26

## What img-man does

img-man is a media operating system. You upload images and PDFs, organize them, edit them with AI, design with them, and deliver them — all from one dashboard.

## 5-minute tour

1. **Sign in** at `/signin`. First-time users land on the onboarding tour automatically.
2. **Upload an asset.** Drag a file onto the Assets page, or click **Upload**.
3. **Open the asset.** Click any tile to see metadata, AI tags, and actions.
4. **Copy its URL.** Click **Asset URL** in the drawer. The link is an img-man-domain URL — share it anywhere.
5. **Resize on the fly.** Append `?w=400&format=webp` to the URL.
6. **Try Design Studio.** Click any image and choose **Edit in Design Studio**.
7. **Create an API key.** Settings → API Keys → **Create**. Use it from your backend or the SDK.

## Concepts to know

- **Asset** — any file (image, PDF, doc, video).
- **Folder** — a place to group assets.
- **Smart album** — a folder that auto-populates by a rule.
- **Share link** — a public URL with optional password and expiry.
- **Transform** — a query-string operation on an asset URL (`?w=`, `?h=`, `?format=`).

## Where to go next

- [Assets](features/assets.md)
- [Designs](features/designs.md)
- [Embed SDK](features/embed.md)
- API Playground — available in-app at `/dashboard/api-playground`.
- [FAQ](faq.md)
