# Duplicates

> **Status:** PUBLISHED
> **Last updated:** 2026-05-05
> **Applies to:** All plans

## What it does

Finds assets that share the same content (by perceptual hash) and groups them together so you can keep the canonical copy and delete the extras, recovering storage in the process.

## When to use it

- After a bulk import that may have brought in files you already have.
- Periodic library hygiene to reclaim storage quota.
- Before migrating to a new bucket — fewer duplicates means a faster, cheaper transfer.

## Step-by-step

### Review duplicates

1. Open **Duplicates** in the sidebar (under the Assets group).
2. img-man groups assets with identical content. Each group shows a thumbnail, file name, size, and how many copies exist.
3. Browse page by page if you have a large library; the list paginates 20 groups at a time.

### Delete a copy

1. Inside a duplicate group, click the **Delete** icon (trash) next to the copy you want to remove.
2. The copy is permanently deleted. The group disappears from the list once only one copy remains.

### Identify the original

- Look at the **Created** date to decide which copy came first.
- Check the folder name — the copy in the intended folder is usually the canonical one.

## Tips & limits

- Duplicate detection uses a perceptual hash, so two files are grouped only if their binary content is identical after decoding (not just similar-looking images).
- Only assets in the current organization are compared.
- Deleting a copy removes it from storage immediately; it also disappears from any folder or smart album it belonged to.
- If you soft-deleted an asset, it still appears in the Trash (**Trash** in the sidebar) even after you delete duplicates here. Empty the Trash to free the storage bytes.
- The statistics panel at the top of the page shows **Total duplicate assets** and **Estimated wasted storage** to help you prioritize.

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| No duplicates found | Library is already clean, or hashing hasn't finished. | Wait a few minutes after a bulk import, then refresh. |
| A group only shows one asset | The other copy was already deleted in this session. | Refresh the page. |
| Deleting fails | Network error or the asset was already removed. | Refresh and try again; check the browser console for details. |
| Storage stat didn't drop | Stats refresh asynchronously. | Reload the page or wait ~30 seconds. |

## Related

- [Assets](assets.md)
- [Smart Albums](smart-albums.md) — create rule-based views of your library.
- [Backup & restore](../backup-restore.md) — snapshot the library before running a large cleanup.
