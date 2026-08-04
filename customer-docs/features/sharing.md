# Sharing

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans

## What it does

Share links give a public URL to a single asset or a whole folder, optionally protected by a password and an expiry. Each share link tracks views.

## When to use it

- Sending a preview to a client without giving them dashboard access.
- Embedding an asset publicly with a known expiry.
- Letting a teammate download a folder of assets.

## Step-by-step

1. Open an asset (or right-click a folder) and choose **Share**.
2. Set:
   - **Expiry** — never, 24h, 7d, 30d, or custom.
   - **Password** — optional. Recipients enter it on the share page.
   - **Permission** — view-only or download.
3. Click **Create link** and copy the URL.

## Asset URL vs Share Link — when to use which

| You want… | Use |
| --- | --- |
| A stable embed URL on your own site, public to anyone | [Asset URL](public-asset-url.md) |
| A revocable, expiring, optionally-password-protected link | Share link (this page) |

## Tips & limits

- Each share link has its own expiry and password — revoking one doesn't affect the others.
- Anyone with the link + password can view; we don't require an img-man account.
- View counts update within a few minutes.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| "Link expired" | Expiry passed. | Create a new link. |
| Password not accepted | Trailing whitespace when pasting. | Re-enter manually. |
| Recipient sees a thumbnail but can't download | Permission set to view-only. | Edit the link and switch to download. |

## Related

- [Public asset URLs](public-asset-url.md)
- [Assets](assets.md)
