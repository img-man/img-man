# Analytics

> **Status:** PUBLISHED
> **Last updated:** 2026-04-26
> **Applies to:** All plans

## What it does

The Dashboard / Analytics page shows you what's happening across your organization at a glance: storage used, bandwidth served, top assets, recent uploads, AI activity, and share-link views.

## When to use it

- Monthly review of where storage and bandwidth are going.
- Spotting hot assets that deserve a CDN preset or a hero placement.
- Verifying that AI quotas haven't run out before a campaign.

## Sections

### Headline tiles

- **Assets** — total count + delta vs. last period.
- **Storage** — GB used / GB limit. Color-coded warning past 75% / 90%.
- **Bandwidth** — egress for the period.
- **AI jobs** — how many have run on this deployment.

### Top assets

Sorted by views, downloads, or transforms. Click an asset to open it in the drawer.

### Activity timeline

Recent uploads, edits, shares, and AI runs by user.

### Share-link performance

Each active share link with views, last access, and quick revoke.

## Tips & limits

- Counters update within ~60 s; hard refresh if you don't see the latest.
- CSV export of any chart is available from the **⋯** menu.
- Date range picker affects every panel on the page.

## Troubleshooting

| Problem | Cause | Fix |
| --- | --- | --- |
| Bandwidth tile shows zero | No public URLs hit yet for the range. | Pick a wider date range. |
| Chart shows dotted line | Data still aggregating. | Wait a few minutes. |
| Top assets list is empty | No view events recorded. | Confirm the share link or public URL is in use. |

## Related

- Plan & usage — available in-app under the dashboard billing surface.
- [Sharing](sharing.md)
- [Assets](assets.md)
